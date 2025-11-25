import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import DOMPurify from "dompurify";
import { inferIntentDeterministic } from "../common/intent-engine";
import { taskPlanner } from "../common/task-planner";
import { TaskProgress } from "./components/TaskProgress";
import { VoiceFeedback } from "./components/VoiceFeedback";
import { ttsService } from "../common/tts-service";
import { RecordingPanel } from "./components/RecordingPanel";

/* -------------------------- Local panel-only types -------------------------- */
type Role = "user" | "assistant";
type Msg = { 
  id: string; 
  role: Role; 
  text: string; 
  ts: number;
  action?: { label: string; onClick: () => void };
};

type PanelIntent =
  | { type: "SCROLL"; direction: "up" | "down"; amount?: number }
  | { type: "OPEN_URL"; url: string }
  | { type: "SEARCH_WEB"; query: string }
  | { type: "SUMMARY" }
  | { type: "CLICK_LABEL"; label: string }
  | { type: "FILL_FIELD"; label: string; value: string }
  | { type: "PLAN_TASK"; goal: string }
  | { type: "EXECUTE_TASK_CHAIN"; chainId: string }
  | { type: "CANCEL_TASK"; chainId: string }
  | { type: "WAIT"; ms: number }
  | { type: "VALIDATE"; condition: string };

type AgentStatus = {
  id: string;
  title: string;
  tabId?: number | null;
  steps: number;
  progress: number;
  state: "queued" | "running" | "done" | "error";
  note?: string;
};

const SUPPORTED = [
  "en", "es", "ja", "fr", "de", "it", "pt", "ru", "zh", "hi", "ar", "ko", "nl", "tr", "pl", "sv", "da", "fi", "no", "el", "he", "th", "vi", "id", "ms", "cs", "hu", "ro", "sk", "uk", "bg", "hr", "lt", "sl", "et", "lv"
] as const;
type Lang2 = (typeof SUPPORTED)[number];

/* -------------------------- Ambient runtime typings ------------------------- */
declare global {
  interface Window {
    ai?: { 
      languageModel?: { create(opts: any): Promise<any> };
    };
    LanguageModel?: { create(opts: { languageCode: string }): Promise<any> };
    // Built-in AI Globals
    Translator?: { 
      create(opts: any): Promise<any>; 
      availability(opts: any): Promise<any>;
    };
    LanguageDetector?: { 
      create(opts?: any): Promise<any>; 
      availability(opts?: any): Promise<any>;
    };
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

/* --------------------------------- helpers --------------------------------- */
async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
  return tab;
}
function isContentEligible(url?: string) {
  if (!url) return false;
  return !(
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("about:") ||
    /^https:\/\/chromewebstore\.google\.com/.test(url)
  );
}
async function sendToContent(msg: unknown) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active tab");
  if (!isContentEligible(tab.url)) throw new Error("Page can’t receive messages");
  return chrome.tabs.sendMessage(tab.id, msg);
}

function getLM() {
  const w = window as any;
  if (w.ai?.languageModel) return w.ai.languageModel;
  if (w.ai?.assistant) return w.ai.assistant;
  if (w.LanguageModel) return w.LanguageModel;
  return null;
}

// Language Detection Helper
async function detectLanguage(text: string): Promise<string | null> {
  try {
    const w = window as any;
    const LD = w.LanguageDetector || w.ai?.languageDetector;
    if (!LD) return null;
    
    // Check availability
    const availability = await LD.availability();
    if (availability === 'no') return null;

    // Create detector
    const detector = await LD.create();
    const results = await detector.detect(text);
    
    // Results are sorted by confidence. Return top result if confidence > 0.4
    if (results && results.length > 0 && results[0].confidence > 0.4) {
      return results[0].detectedLanguage;
    }
  } catch (e) {
    console.warn("[LangDetect] Failed:", e);
  }
  return null;
}

// Translation Helper
async function translateToEnglish(text: string, sourceLang: string): Promise<string> {
  if (sourceLang === 'en' || !sourceLang) return text;
  
  try {
    const w = window as any;
    const TR = w.Translator || w.ai?.translator;
    if (!TR) return text;

    // Check availability first
    const availability = await TR.availability({
      sourceLanguage: sourceLang,
      targetLanguage: 'en'
    });

    if (availability === 'no') return text;

    // Create translator
    const translator = await TR.create({
      sourceLanguage: sourceLang,
      targetLanguage: 'en'
    });

    return await translator.translate(text);
  } catch (e) {
    console.warn("[Translate] Failed:", e);
    return text; // Fallback to original text
  }
}

/* -------------------- normalize unknown intent -> PanelIntent ---------------- */
function isPanelIntent(i: any): i is PanelIntent {
  return i && typeof i === "object" && typeof i.type === "string" &&
    ["SCROLL", "OPEN_URL", "SEARCH_WEB", "SUMMARY", "CLICK_LABEL", "FILL_FIELD", "PLAN_TASK", "EXECUTE_TASK_CHAIN", "CANCEL_TASK", "WAIT", "VALIDATE"].includes(i.type);
}
function normalizeIntent(raw: any): PanelIntent | undefined {
  if (!raw || typeof raw !== "object" || !raw.type) return undefined;
  switch (raw.type) {
    case "SCROLL":     return { type: "SCROLL", direction: raw.direction === "up" ? "up" : "down", amount: typeof raw.amount === "number" ? raw.amount : 0.8 };
    case "OPEN_URL":   return typeof raw.url === "string" && raw.url ? { type: "OPEN_URL", url: raw.url } : undefined;
    case "SEARCH_WEB": return typeof raw.query === "string" && raw.query ? { type: "SEARCH_WEB", query: raw.query } : undefined;
    case "SUMMARY":    return { type: "SUMMARY" };
    case "CLICK_LABEL":return typeof raw.label === "string" && raw.label ? { type: "CLICK_LABEL", label: raw.label } : undefined;
    case "FILL_FIELD": return typeof raw.label === "string" && typeof raw.value === "string" ? { type: "FILL_FIELD", label: raw.label, value: raw.value } : undefined;
    case "PLAN_TASK":  return typeof raw.goal === "string" && raw.goal ? { type: "PLAN_TASK", goal: raw.goal } : undefined;
    case "EXECUTE_TASK_CHAIN": return typeof raw.chainId === "string" && raw.chainId ? { type: "EXECUTE_TASK_CHAIN", chainId: raw.chainId } : undefined;
    case "CANCEL_TASK": return typeof raw.chainId === "string" && raw.chainId ? { type: "CANCEL_TASK", chainId: raw.chainId } : undefined;
    case "WAIT":       return typeof raw.ms === "number" && raw.ms >= 0 ? { type: "WAIT", ms: raw.ms } : undefined;
    case "VALIDATE":   return typeof raw.condition === "string" && raw.condition ? { type: "VALIDATE", condition: raw.condition } : undefined;
    default:           return undefined;
  }
}

/* -------------------------------- component -------------------------------- */
export default function App() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: crypto.randomUUID(), role: "assistant", text: 'Hi! I’m your on-device assistant. Try: “search hotels in DC and open the first result”.', ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Initializing…");
  const [lang2, setLang2] = useState<Lang2>("en");

  // voice
  const [isListening, setIsListening] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceModeActive, setVoiceModeActive] = useState(false); // Track if user activated voice mode
  const recRef = useRef<any>(null);
  const levelTimerRef = useRef<number | null>(null);
  
  // conversational mode
  const [conversationalMode, setConversationalMode] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant', text: string, timestamp: number}>>([]);
  const MAX_CONVERSATION_HISTORY = 10; // Keep last 10 exchanges for context

  // wake word & hands-free
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [isWakeWordListening, setIsWakeWordListening] = useState(false);
  const WAKE_WORD = "hey nano"; // Simple keyword matching
  const wakeWordRestartTimerRef = useRef<any>(null);

  // ASR dedupe & cooldown
  const lastProcessedUtteranceRef = useRef<string>("");
  const processingRef = useRef<boolean>(false);
  const lastIntentKeyRef = useRef<string>("");
  const lastActionAtRef = useRef<number>(0);
  const INTENT_COOLDOWN_MS = 1200;

  // Task automation
  const [currentChain, setCurrentChain] = useState<any>(null);
  const [isExecutingChain, setIsExecutingChain] = useState(false);

  // agent dashboard
  const [agents, setAgents] = useState<Record<string, AgentStatus>>({});

  // Tab navigation
  // const { currentTab, switchTab } = useTabs('chat');

  // LLM session
  const sessionRef = useRef<any>(null);

  // auto-scroll chat
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, busy]);

  /* ------------------------ Open Chrome internals ------------------------- */
  const openModelStatus = () => {
    chrome.tabs.create({ url: 'chrome://on-device-internals/' }, (tab) => {
      if (tab.id) {
        // Note: We can't programmatically click to switch tabs in chrome:// pages
        // User will need to manually click "Model Status" tab
        console.log('[Model] Opened chrome://on-device-internals/');
      }
    });
  };

  /* -------------------------- Initialize on mount -------------------------- */
  useEffect(() => {
    // Check model availability on startup and trigger download if needed
    (async () => {
      try {
        const lm = getLM();
        if (!lm) {
          setStatus("Prompt API not found");
          setMessages(m => [...m, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: `⚠️ Prompt API not available.\n\nPlease enable:\n1. Chrome Canary/Dev (v128+)\n2. chrome://flags/#optimization-guide-on-device-model\n3. chrome://flags/#prompt-api-for-gemini-nano\n\nThen restart Chrome.`,
            ts: Date.now(),
            action: { label: "📊 Check Model Status", onClick: openModelStatus }
          }]);
          return;
        }

        setStatus("Checking model…");
        const availability = await lm.capabilities?.();
        console.log('[Startup] Model availability:', availability);

        if (availability?.available === 'readily') {
          setStatus("Model Available");
          setMessages(m => [...m, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: `✅ Model ready! You can start using voice or text commands.`,
            ts: Date.now()
          }]);
        } else if (availability?.available === 'after-download') {
          setStatus("Downloading model…");
          const downloadMsgId = crypto.randomUUID();
          setMessages(m => [...m, {
            id: downloadMsgId,
            role: "assistant",
            text: `📥 Downloading on-device model...\n\n⏳ Size: ~22GB\n⏳ This may take 5-10 minutes\n\nProgress: Initializing...\n\n💡 Why this matters:\nThe AI model runs entirely on your device (no cloud!), ensuring your privacy and enabling offline use. This download is a one-time setup.`,
            ts: Date.now(),
            action: { label: "📊 View Download Progress", onClick: openModelStatus }
          }]);

          // Trigger download by creating session
          try {
            console.log('[Startup] Triggering model download...');
            const session = await lm.create({ languageCode: lang2 });
            sessionRef.current = session;
            
            setStatus("Model Available");
            setMessages(m => m.map(msg => 
              msg.id === downloadMsgId 
                ? { ...msg, text: `✅ Model downloaded successfully!\n\n🎉 Ready to use. Try voice or text commands now!\n\n💡 Your AI assistant now works offline and keeps your data private on your device.`, action: undefined }
                : msg
            ));
          } catch (error: any) {
            console.error('[Startup] Download failed:', error);
            setStatus("Download failed");
            setMessages(m => m.map(msg => 
              msg.id === downloadMsgId 
                ? { ...msg, text: `❌ Download failed: ${error.message}\n\nCheck the Model Status page for details and ensure you have 22GB+ free space.`, action: { label: "📊 Check Model Status", onClick: openModelStatus } }
                : msg
            ));
          }
        } else {
          setStatus("Model Unavailable");
          setMessages(m => [...m, {
            id: crypto.randomUUID(),
            role: "assistant",
            text: `⚠️ Model unavailable\n\n📋 Requirements:\n• Free disk space: 22+ GB\n• RAM: 4+ GB\n• Device capable: true\n• Feature enabled: true\n\n💡 Why check Model Status?\nThe diagnostics page shows exactly what's blocking the download (disk space, feature flags, device compatibility). It helps you quickly fix any issues.`,
            ts: Date.now(),
            action: { label: "📊 Check Model Status", onClick: openModelStatus }
          }]);
        }
      } catch (error: any) {
        console.error('[Startup] Model check failed:', error);
        setStatus("Model Unavailable");
      }
    })();
  }, []);

  /* -------------------------- Hotkey Listener -------------------------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Space to toggle voice
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        if (isListening) {
          stopASR();
          // If wake word was on, we should probably disable it temporarily or just stop active listening?
          // For now, stop everything to be safe
          setWakeWordEnabled(false); 
          setStatus("Voice stopped");
        } else {
          startASR();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening]);


  /* -------------------------- voice level (stable) -------------------------- */
  function startLevel() {
    stopLevel();
    levelTimerRef.current = window.setInterval(() => {
      // simple, low-noise level
      setVoiceLevel(v => (v * 0.6) + Math.random() * 40);
    }, 120);
  }
  function stopLevel() {
    if (levelTimerRef.current != null) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    setVoiceLevel(0);
  }

  /* --------------------------------- ASR ----------------------------------- */
  function startASR() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setStatus("Speech not supported."); return; }
    if (processingRef.current) return;

    // Activate voice mode when user starts voice input
    setVoiceModeActive(true);
    console.log('[Voice] Voice mode activated - responses will be spoken');

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = `${lang2}-${lang2.toUpperCase()}`;

    let runningFinal = ""; // accumulate only finals for display

    rec.onstart = () => {
      lastProcessedUtteranceRef.current = "";
      // Only show "Listening..." if we are NOT in passive wake-word mode
      if (!wakeWordEnabled || isListening) {
        setIsListening(true);
        startLevel();
        setStatus("Listening…");
      } else {
        setIsWakeWordListening(true);
        setStatus("Waiting for 'Hey Nano'...");
      }
    };
    rec.onerror = (e: any) => {
      // In wake word mode, ignore no-speech errors and restart
      if (wakeWordEnabled && (e.error === 'no-speech' || e.error === 'aborted')) {
        return; 
      }
      setStatus(`Mic error: ${e?.error ?? "unknown"}`);
    };
    rec.onend = () => {
      setIsListening(false);
      setIsWakeWordListening(false);
      stopLevel();
      recRef.current = null;
      
      // Auto-restart if wake word enabled and not explicitly stopped
      if (wakeWordEnabled) {
        setStatus("Restarting listener...");
        wakeWordRestartTimerRef.current = setTimeout(() => {
          startASR();
        }, 500);
      } else {
        setStatus("Stopped.");
      }
    };
    rec.onresult = async (ev: any) => {
      // Build interim + final strings just for UI, but only ACT on the newest final chunk
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) runningFinal += r[0].transcript;
        else interim += r[0].transcript;
      }
      
      // If in wake word mode (passive), don't update input unless active
      if (!wakeWordEnabled || isListening) {
        setInput((runningFinal + " " + interim).trim());
      }

      // Check for Wake Word in interim results for faster response
      if (wakeWordEnabled && !isListening) {
        const transcript = (runningFinal + " " + interim).toLowerCase();
        if (transcript.includes(WAKE_WORD)) {
          console.log('[Wake Word] Detected:', WAKE_WORD);
          setIsListening(true); // Switch to active mode
          setVoiceModeActive(true);
          startLevel();
          setStatus("Listening…");
          ttsService.speak("I'm listening", lang2); // Audio feedback
          
          // Clear buffer so we don't process "Hey Nano" as a command
          runningFinal = ""; 
          lastProcessedUtteranceRef.current = "";
          return;
        }
      }

      // If the LAST result in this batch is final, extract ONLY that segment and act once
      const last = ev.results[ev.results.length - 1];
      if (last?.isFinal) {
        const utterance = String(last[0]?.transcript || "").trim();
        if (!utterance) return;

        // If we are in wake word mode but haven't triggered yet, ignore final results
        if (wakeWordEnabled && !isListening) {
          return;
        }

        // de-duplicate exact same final chunk
        if (utterance === lastProcessedUtteranceRef.current) return;
        lastProcessedUtteranceRef.current = utterance;

        // process once
        await handleText(utterance);
      }
    };

    recRef.current = rec;
    try { rec.start(); } catch {}
  }

  function stopASR() {
    // Clear wake word restart timer
    if (wakeWordRestartTimerRef.current) {
      clearTimeout(wakeWordRestartTimerRef.current);
      wakeWordRestartTimerRef.current = null;
    }

    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
    setIsListening(false);
    setIsWakeWordListening(false);
    stopLevel();
    // Keep voice mode active even after stopping - user can continue conversation
  }

  /* ---------------------------- Voice response helper ------------------------- */
  const speakResponse = (text: string, lang: string = "en") => {
    if (voiceModeActive && text && text.trim()) {
      console.log(`[Voice] Speaking response (${lang}):`, text.substring(0, 50) + '...');
      ttsService.speak(text, lang).then(() => {
        // Auto-restart listening in conversational mode
        if (conversationalMode && !isListening) {
          console.log('[Conversational] Auto-restarting ASR after response');
          setTimeout(() => {
            if (!processingRef.current) {
              startASR();
            }
          }, 800); // Small delay for natural flow
        }
      }).catch(err => {
        console.error('[Voice] TTS error:', err);
      });
    }
  };

  /* ------------------------------ LLM session ------------------------------ */
  async function ensureSession(systemPrompt?: string) {
    if (sessionRef.current) {
      // If we need to update system prompt (e.g. for language), we might need a new session
      // For now, we'll just prepend instructions to the user prompt as the API doesn't support updating system prompt easily
      return sessionRef.current;
    }
    const lm = getLM();
    if (!lm) throw new Error("Prompt API not found (enable Gemini Nano).");
    
    setStatus("Checking model…");
    
    try {
      // Check model availability first
      const availability = await lm.capabilities?.();
      console.log('[Model] Availability check:', availability);
      
      if (availability?.available === 'no') {
        // Model not available - check for specific errors
        const errorMsg = availability?.reason || "Unknown reason";
        const isDiskSpace = errorMsg.toLowerCase().includes("space") || errorMsg.toLowerCase().includes("storage");
        
        setStatus("Model unavailable");
        setMessages(m => [...m, {
          id: crypto.randomUUID(),
          role: "assistant",
          text: isDiskSpace 
            ? `⚠️ Not enough disk space!\n\n💾 The device does not have enough space for downloading the on-device model.\n\n📋 Requirements:\n• Free up at least 22 GB of disk space\n• Current issue: ${errorMsg}\n\n💡 After freeing up space, restart Chrome and try again.`
            : `⚠️ On-device model not available.\n\n📋 Requirements:\n• Disk space: 22+ GB free\n• RAM: 4+ GB available\n• Chrome version: 128+\n• Feature enabled in chrome://flags\n\n❌ Issue: ${errorMsg}\n\n💡 Check the diagnostics page for details.`,
          ts: Date.now(),
          action: { label: "📊 Check Model Status", onClick: openModelStatus }
        }]);
        throw new Error(`Model not available: ${errorMsg}`);
      }
      
      if (availability?.available === 'after-download' || availability?.available === 'readily') {
        // Model needs download or is ready - create session with monitor
        const downloadMsgId = crypto.randomUUID();
        let lastProgress = -1;
        
        if (availability?.available === 'after-download') {
          setStatus("Downloading model… 0%");
          setMessages(m => [...m, {
            id: downloadMsgId,
            role: "assistant",
            text: `📥 Downloading model...\n\n⏳ Size: ~22GB\n⏳ Time: 5-10 minutes\n\nProgress: 0%\n\n💡 Why this matters:\nThis AI runs 100% on your device. No data sent to cloud servers. Works offline. Your conversations stay private.`,
            ts: Date.now(),
            action: { label: "📊 View Download Progress", onClick: openModelStatus }
          }]);
        }
        
        console.log('[Model] Creating session with monitor...');
        const s = await lm.create({ 
          languageCode: lang2,
          systemPrompt: systemPrompt || "You are a helpful assistant.",
          monitor(m: any) {
            m.addEventListener("downloadprogress", (e: any) => {
              const pct = Math.round((e.loaded || 0) * 100);
              if (pct !== lastProgress) {
                lastProgress = pct;
                setStatus(`Downloading model… ${pct}%`);
                console.log(`[Model] Download progress: ${pct}%`);
                
                // Update message with progress
                setMessages(msgs => msgs.map(msg => 
                  msg.id === downloadMsgId 
                    ? { ...msg, text: `📥 Downloading model...\n\n⏳ Size: ~22GB\n⏳ Time: 5-10 minutes\n\nProgress: ${pct}%\n\n💡 Why this matters:\nThis AI runs 100% on your device. No data sent to cloud servers. Works offline. Your conversations stay private.` }
                    : msg
                ));
              }
            });
            
            m.addEventListener("error", (e: any) => {
              console.error("[Model] Download error:", e);
              const errorMsg = e?.message || e?.error || "Download failed";
              setStatus(`Error: ${errorMsg}`);
              setMessages(msgs => msgs.map(msg => 
                msg.id === downloadMsgId 
                  ? { ...msg, text: `❌ Download failed!\n\n${errorMsg}\n\nPlease check:\n• Internet connection\n• Available disk space (22+ GB)\n• Chrome is up to date`, action: { label: "📊 Check Model Status", onClick: openModelStatus } }
                  : msg
              ));
            });
          }
        });
        
        sessionRef.current = s;
        setStatus("Model available");
        
        if (availability?.available === 'after-download') {
          setMessages(m => m.map(msg => 
            msg.id === downloadMsgId 
              ? { ...msg, text: `✅ Model downloaded!\n\n🎉 Ready to use. You can now send commands via voice or text.\n\n✨ Your private AI assistant is ready!`, action: undefined }
              : msg
          ));
        }
        
        return s;
      }
      
      // Fallback for other states
      setStatus("Creating session…");
      const s = await lm.create({ 
        languageCode: lang2,
        systemPrompt: systemPrompt || "You are a helpful assistant."
      });
      sessionRef.current = s;
      setStatus("Ready");
      
      return s;
    } catch (error: any) {
      console.error('[Model] Session creation failed:', error);
      
      // Check for specific error types
      const errorMsg = error?.message || String(error);
      if (errorMsg.toLowerCase().includes("space") || errorMsg.toLowerCase().includes("storage")) {
        setStatus("Error: Not enough disk space");
        setMessages(m => [...m, {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `⚠️ Error: The device does not have enough space for downloading the on-device model.\n\n💾 You need at least 22 GB of free disk space.\n\n📝 Steps to fix:\n1. Free up disk space\n2. Restart Chrome\n3. Try again`,
          ts: Date.now()
        }]);
      } else {
        setStatus("Error");
      }
      
      throw error;
    }
  }
  useEffect(() => {
    const s = sessionRef.current;
    if (!s) return;
    (async () => { try { await s?.close?.(); } catch {} try { s?.destroy?.(); } catch {} sessionRef.current = null; })();
  }, [lang2]);

  /* -------------------------- Agent dashboard utils ------------------------ */
  /* -------------------------- Agent dashboard utils ------------------------ */
  // Listen for background agent updates
  useEffect(() => {
    const onMessage = (msg: any) => {
      if (msg.type === "AGENTS_UPDATE" && msg.agent) {
        setAgents(prev => ({
          ...prev,
          [msg.agent.id]: {
            id: msg.agent.id,
            title: msg.agent.name || "Agent",
            steps: msg.agent.actions?.length || 0,
            progress: msg.agent.progress || 0,
            state: msg.agent.status,
            note: msg.agent.logs?.[msg.agent.logs.length - 1] || "",
            tabId: msg.agent.tabId
          }
        }));
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  /* ----------------------------- task execution ----------------------------- */
  async function executeTaskChain(goal: string) {
    try {
      setIsExecutingChain(true);
      setStatus("Planning tasks…");

      // Plan the task chain
      const chain = taskPlanner.planGoal(goal);
      setCurrentChain(chain);

      // Add message
      const msgId = crypto.randomUUID();
      setMessages((m) => [
        ...m,
        {
          id: msgId,
          role: "assistant",
          text: `🚀 Starting task chain: ${chain.name}\n📋 ${chain.tasks.length} steps planned`,
          ts: Date.now(),
        },
      ]);

      // Execute the chain
      await taskPlanner.executeChain(
        chain.id,
        async (task, _context) => {
          // Update UI
          setCurrentChain((c: any) =>
            c ? { ...c, tasks: c.tasks.map((t: any) => (t.id === task.id ? task : t)) } : null
          );

          // Handle different wait times between tasks
          if (task.intent.type === "WAIT") {
            await new Promise((resolve) => setTimeout(resolve, (task.intent as any).ms));
            return { type: "wait", duration: (task.intent as any).ms };
          }

          // Execute the intent
          const result = await executeIntent(task.intent);

          if (!result.ok) {
            throw new Error(result.text || "Intent execution failed");
          }

          return result;
        }
      );

      setStatus("Tasks completed!");
      setMessages((m) => [
        ...m.map((msg) =>
          msg.id === msgId
            ? {
                ...msg,
                text: `✅ Task chain completed!\n${chain.stats.completed}/${chain.stats.total} tasks done`,
              }
            : msg
        ),
      ]);
    } catch (err: any) {
      setStatus("Task execution failed");
      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: `❌ Task chain failed: ${err?.message || "Unknown error"}`,
        ts: Date.now(),
      }]);
    } finally {
      setIsExecutingChain(false);
    }
  }

  function cancelTaskChain() {
    if (currentChain) {
      taskPlanner.cancelChain(currentChain.id);
      setCurrentChain(null);
      setIsExecutingChain(false);
      setStatus("Task cancelled");
    }
  }

  /* ----------------------------- intent execute ---------------------------- */
  async function executeIntent(i: PanelIntent): Promise<{ ok: boolean; text?: string }> {
    try {
      switch (i.type) {
        case "OPEN_URL":   await chrome.tabs.create({ url: i.url }); return { ok: true };
        case "SEARCH_WEB": await chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(i.query)}` }); return { ok: true };
        case "SCROLL":     await sendToContent({ type: "SCROLL", direction: i.direction, amount: i.amount ?? 0.8 }); return { ok: true };
        case "SUMMARY": {
          const res: any = await sendToContent({ type: "SUMMARY" });
          return res?.text ? { ok: true, text: String(res.text) } : { ok: false };
        }
        case "CLICK_LABEL":await sendToContent({ type: "CLICK_LABEL", label: i.label }); return { ok: true };
        case "FILL_FIELD": await sendToContent({ type: "FILL_FIELD", label: i.label, value: DOMPurify.sanitize(i.value) }); return { ok: true };
        case "WAIT": await new Promise(resolve => setTimeout(resolve, (i as any).ms)); return { ok: true };
        case "PLAN_TASK": {
          void executeTaskChain((i as any).goal);
          return { ok: true };
        }
        case "EXECUTE_TASK_CHAIN":
        case "CANCEL_TASK":
        case "VALIDATE":
          // These are handled separately or not directly executed
          return { ok: false, text: "Intent not directly executable" };
      }
      return { ok: false };
    } catch (e: any) {
      return { ok: false, text: e?.message || "dispatch failed" };
    }
  }

  /* ------------------------- cooldown & routing guard ---------------------- */
  function shouldAct(intent: PanelIntent) {
    const now = Date.now();
    const key =
      intent.type === "SCROLL"     ? `${intent.type}:${intent.direction}` :
      intent.type === "OPEN_URL"   ? `${intent.type}:${intent.url}` :
      intent.type === "SEARCH_WEB" ? `${intent.type}:${intent.query}` :
      intent.type === "CLICK_LABEL"? `${intent.type}:${intent.label}` :
      intent.type === "FILL_FIELD" ? `${intent.type}:${intent.label}` :
      intent.type; // SUMMARY

    const withinCooldown = now - lastActionAtRef.current < INTENT_COOLDOWN_MS;
    const sameAsLast = key === lastIntentKeyRef.current;

    if (withinCooldown && sameAsLast) return false;
    lastActionAtRef.current = now;
    lastIntentKeyRef.current = key;
    return true;
  }

  /* -------------------------------- routing -------------------------------- */
  async function handleText(raw: string) {
    const text = DOMPurify.sanitize((raw || input).trim());
    if (!text || processingRef.current) return;

    processingRef.current = true; // prevent re-entrancy while handling
    setInput(""); setBusy(true);

    const uid = crypto.randomUUID(); const aid = crypto.randomUUID();
    setMessages(m => [...m, { id: uid, role: "user", text, ts: Date.now() }, { id: aid, role: "assistant", text: "…", ts: Date.now() }]);

    try {
      // 1. Detect Language
      const detectedLang = await detectLanguage(text) || lang2;
      console.log(`[Lang] Detected: ${detectedLang}`);

      // 2. Translate to English for Intent Detection (if needed)
      let englishText = text;
      if (detectedLang !== 'en') {
        englishText = await translateToEnglish(text, detectedLang);
        console.log(`[Lang] Translated to English: ${englishText}`);
      }

      // 3. Infer Intent (using English text)
      let intent = normalizeIntent(inferIntentDeterministic(englishText));

      // AI Intent Classification Fallback (Smart Router)
      if (!intent) {
        try {
          const lm = getLM();
          if (lm) {
            // Quick check if model is ready
            const caps = await lm.capabilities?.();
            if (caps?.available === 'readily') {
              setStatus("Analyzing intent...");
              const session = await lm.create({ 
                systemPrompt: "You are an intent classifier. Classify the user input as either 'TASK' (requires browsing, searching, or actions) or 'CHAT' (general question, greeting, or fact). Reply with ONLY 'TASK' or 'CHAT'."
              });
              const classification = await session.prompt(englishText);
              session.destroy();
              
              console.log(`[Intent] AI classified as: ${classification}`);
              
              if (classification.trim().toUpperCase().includes("TASK")) {
                intent = { type: "PLAN_TASK", goal: englishText };
              }
            }
          }
        } catch (e) {
          console.warn("[Intent] AI classification failed, falling back to chat", e);
        }
      }

      if (intent && isPanelIntent(intent) && shouldAct(intent)) {
        // Handle multi-step task planning
        if (intent.type === "PLAN_TASK") {
          setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: "🚀 Sending task to background agent..." } : msg));
          
          // Send to background agent
          chrome.runtime.sendMessage({ 
            type: "AGENTS_CREATE", 
            goal: (intent as any).goal 
          });

          // Switch to Agents tab to show progress
          setActiveTab('agents');
          setStatus("Ready.");
        } else if (intent.type === "SUMMARY") {
          const acted = await executeIntent(intent);
          if (acted.ok && acted.text) {
            const s = await ensureSession(`You are a helpful assistant. Reply in ${detectedLang}.`);
            setStatus("Summarizing page…");
            const prompt = `Provide a concise summary in ${detectedLang} of the following text:\n\n${acted.text.slice(0, 6000)}`;
            
            let out = "";
            if (typeof s.promptStreaming === "function") {
              for await (const chunk of s.promptStreaming(prompt)) {
                out += chunk; setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: out } : msg));
              }
            } else {
              const r = await s.prompt(prompt);
              out = typeof r === "string" ? r : r?.text ?? String(r ?? "");
              setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: out } : msg));
            }
            speakResponse(out, detectedLang);
            setStatus("Ready.");
          } else {
            const errorMsg = "⚠️ Could not read page";
            setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: errorMsg } : msg));
            speakResponse(errorMsg, detectedLang); // Speak error in voice mode
          }
        } else {
          // Simple actions - just execute without creating an agent entry
          const acted = await executeIntent(intent);
          const actionResult = acted.ok ? "✅ Done." : `⚠️ ${acted.text || "Failed"}`;
          setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: actionResult } : msg));
          speakResponse(actionResult, detectedLang); // Speak action result in voice mode
          setStatus("Ready.");
        }
      } else {
        // Not actionable → normal on-device chat
        const s = await ensureSession(`You are a helpful assistant. Always reply in ${detectedLang}.`); 
        setStatus("Thinking…");
        
        // Build context-aware prompt in conversational mode
        let prompt = `(Reply in ${detectedLang}) ${text}`;
        
        if (conversationalMode && conversationHistory.length > 0) {
          const context = conversationHistory.slice(-6).map(h => 
            `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`
          ).join('\n');
          prompt = `Previous conversation:\n${context}\n\nUser: ${text}\n\nReply in ${detectedLang}:`;
          console.log('[Conversational] Including context:', conversationHistory.length, 'turns');
        }
        
        let out = "";
        if (typeof s.promptStreaming === "function") {
          for await (const chunk of s.promptStreaming(prompt)) {
            out += chunk; setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: out } : msg));
          }
        } else {
          const r = await s.prompt(prompt);
          out = typeof r === "string" ? r : r?.text ?? String(r ?? "");
          setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: out } : msg));
        }
        
        // Update conversation history
        if (conversationalMode) {
          setConversationHistory(prev => {
            const updated = [
              ...prev,
              { role: 'user' as const, text, timestamp: Date.now() },
              { role: 'assistant' as const, text: out, timestamp: Date.now() }
            ];
            // Keep only last N exchanges
            return updated.slice(-MAX_CONVERSATION_HISTORY);
          });
        }
        
        speakResponse(out, detectedLang);
        setStatus("Ready.");
      }
    } catch (e: any) {
      const errorMsg = "⚠️ " + (e?.message || "Unknown error");
      setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: errorMsg } : msg));
      speakResponse(errorMsg, "en"); // Speak error in voice mode
      setStatus("Error.");
    } finally {
      setBusy(false);
      processingRef.current = false;
    }
  }

  /* ---------------------------------- UI ----------------------------------- */
  const [activeTab, setActiveTab] = useState<"chat" | "agents" | "recordings">("chat");

  return (
    <div className="w-full max-w-[420px] h-full max-h-[90vh] flex flex-col text-[13px] text-zinc-900 dark:text-zinc-100 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
      {/* Header */}
      <header className="px-3 py-2 border-b border-zinc-200/70 dark:border-zinc-800/70 flex items-center gap-2">
        <div className="font-semibold">Nano Assistant</div>

        <div className={clsx(
          "ml-2 px-2 py-[2px] rounded-full text-[11px] font-medium",
          status.startsWith("Error")
            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
        )}>
          {status}
        </div>

        {/* stable level meter (no blinking button) */}
        <div className="ml-2 h-5 flex items-end gap-[2px]">
          {isListening && [1,2,3,4,5].map(i => (
            <div key={i} className="w-[3px] bg-blue-500 rounded-sm" style={{ height: `${Math.max(4, (voiceLevel * 0.5) + Math.random() * 6)}px` }} />
          ))}
        </div>

        <select
          className="ml-auto rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1"
          value={lang2}
          onChange={(e) => setLang2((e.target.value as Lang2) || "en")}
        >
          <option value="en">EN</option>
          <option value="es">ES</option>
          <option value="ja">JA</option>
        </select>

        <button
          onClick={() => {
            setConversationalMode(!conversationalMode);
            if (!conversationalMode) {
              setConversationHistory([]); // Clear history when enabling
              console.log('[Conversational] Mode enabled - auto-restart after responses');
            } else {
              console.log('[Conversational] Mode disabled');
            }
          }}
          className={clsx(
            "ml-2 rounded-md border px-3 py-1 text-xs font-medium transition-colors",
            conversationalMode
              ? "border-purple-500 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200"
              : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          )}
          title={conversationalMode ? "Conversational mode ON - Auto-restarts listening" : "Enable conversational mode"}
        >
          {conversationalMode ? "💬 Conversational" : "💬"}
        </button>

        <button
          onClick={() => {
            if (wakeWordEnabled) {
              setWakeWordEnabled(false);
              stopASR();
            } else {
              setWakeWordEnabled(true);
              startASR(); // Start immediately in passive mode
            }
          }}
          className={clsx(
            "ml-2 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
            wakeWordEnabled
              ? "border-emerald-500 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          )}
          title={wakeWordEnabled ? "Hands-Free ON - Listening for 'Hey Nano'" : "Enable Hands-Free (Wake Word)"}
        >
          👋
        </button>

        <button
          onClick={() => setMessages([{ id: crypto.randomUUID(), role: "assistant", text: "Cleared. How can I help?", ts: Date.now() }])}
          className="ml-2 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Clear chat"
        >
          🧹
        </button>
      </header>

      {/* Tab Bar */}
      <div className="flex border-b border-zinc-200/70 dark:border-zinc-800/70">
        <button
          onClick={() => setActiveTab("chat")}
          className={clsx(
            "flex-1 py-2 text-center font-medium transition-colors",
            activeTab === "chat"
              ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          )}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab("agents")}
          className={clsx(
            "flex-1 py-2 text-center font-medium transition-colors",
            activeTab === "agents"
              ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          )}
        >
          Agents
        </button>
        <button
          onClick={() => setActiveTab("recordings" as any)}
          className={clsx(
            "flex-1 py-2 text-center font-medium transition-colors",
            activeTab === "recordings"
              ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          )}
        >
          🎥 Recordings
        </button>
      </div>

      {/* Voice mode indicator */}
      {voiceModeActive && (
        <div className="px-3 py-2 bg-purple-100 dark:bg-purple-900/20 border-l-4 border-purple-600 text-sm flex items-center gap-2">
          <span>🎤</span>
          <span className="font-medium text-purple-900 dark:text-purple-100">Voice mode active</span>
          <span className="text-xs text-purple-700 dark:text-purple-300">— I'll speak my responses</span>
        </div>
      )}

      {/* Wake Word indicator */}
      {isWakeWordListening && !voiceModeActive && (
        <div className="px-3 py-2 bg-emerald-100 dark:bg-emerald-900/20 border-l-4 border-emerald-500 text-sm flex items-center gap-2">
          <span>👋</span>
          <span className="font-medium text-emerald-900 dark:text-emerald-100">Hands-Free Active</span>
          <span className="text-xs text-emerald-700 dark:text-emerald-300">— Say "Hey Nano" to start</span>
        </div>
      )}

      {/* Conversational mode indicator */}
      {conversationalMode && (
        <div className="px-3 py-2 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 border-l-4 border-blue-500 text-sm flex items-center gap-2">
          <span>💬</span>
          <span className="font-medium text-blue-900 dark:text-blue-100">Conversational mode</span>
          <span className="text-xs text-blue-700 dark:text-blue-300">— I'll remember context & auto-restart listening</span>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        
        {/* AGENTS TAB */}
        {activeTab === "agents" && (
          <div className="absolute inset-0 overflow-y-auto p-3 space-y-4">
            {/* Task Progress (Task Chains) */}
            {currentChain ? (
              <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-blue-50 dark:bg-blue-900/10 overflow-hidden">
                 <div className="px-3 py-2 border-b border-zinc-200/50 dark:border-zinc-700/50 font-medium text-blue-900 dark:text-blue-100">
                   Active Mission
                 </div>
                <TaskProgress 
                  chain={currentChain} 
                  isExecuting={isExecutingChain}
                  onCancel={() => cancelTaskChain()}
                />
              </section>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                No active missions.
              </div>
            )}

            {/* Background Agents List */}
            <section>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Background Agents</div>
              {Object.values(agents).length === 0 && <div className="text-[11px] text-zinc-500 italic">No background agents running.</div>}
              <div className="flex flex-col gap-2">
                {Object.values(agents).map(ag => (
                  <div key={ag.id} className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2 bg-white dark:bg-zinc-900">
                    <div className="flex items-center justify-between text-[12px]">
                      <div className="font-medium">{ag.title}</div>
                      <div className={clsx(
                        "px-1.5 py-[1px] rounded text-[10px]",
                        ag.state === "running" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                          : ag.state === "done" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                      )}>{ag.state}</div>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-blue-600 dark:bg-blue-500" style={{ width: `${ag.progress}%` }} />
                    </div>
                    {ag.note && <div className="mt-1 text-[11px] text-zinc-500">{ag.note}</div>}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* RECORDINGS TAB */}
        {activeTab === "recordings" && (
          <div className="absolute inset-0 overflow-hidden">
            <RecordingPanel />
          </div>
        )}

        {/* CHAT TAB */}

        <div className={clsx("flex-1 flex flex-col overflow-hidden", activeTab !== "chat" && "hidden")}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scroll-smooth">
            {messages.map(m => <Bubble key={m.id} {...m} />)}
            {busy && (
              <div className="flex items-end gap-2">
                <Avatar role="assistant" />
                <div className="rounded-2xl rounded-bl-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-2"><span className="typing-dots" /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Controls */}
          <div className="border-t border-zinc-200/70 dark:border-zinc-800/70 p-2 bg-white dark:bg-zinc-950">
            <div className="flex gap-2">
              <textarea
                className="flex-1 resize-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder='Try: "search hotels in DC and open the first result"'
                value={input}
                onChange={(e) => setInput(DOMPurify.sanitize(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleText(input); } }}
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => (isListening ? stopASR() : startASR())}
                  className={clsx(
                    "rounded-lg px-3 py-2 font-semibold",
                    isListening ? "bg-red-600 text-white" : "bg-zinc-900 text-white dark:bg-zinc-700"
                  )}
                  title={isListening ? "Stop voice" : "Start voice"}
                >
                  {isListening ? "Stop" : "Voice"}
                </button>
                <button
                  onClick={() => void handleText(input)}
                  disabled={!input.trim() || busy}
                  className={clsx(
                    "rounded-lg px-3 py-2 font-semibold",
                    (!input.trim() || busy) ? "bg-zinc-300 text-zinc-500 cursor-not-allowed" : "bg-blue-600 text-white"
                  )}
                  title="Send"
                >
                  Send
                </button>
              </div>
            </div>

            {/* quick tools */}
            <div className="mt-2 flex gap-2">
              <button
                onClick={async () => {
                  try { const res: any = await sendToContent({ type: "PING" }); setStatus(res?.ok ? "Agent reachable" : "No content script"); }
                  catch (e: any) { setStatus(e?.message?.includes("Page can’t receive") ? "This page can’t run content scripts" : "Ping failed"); }
                }}
                className="rounded-md px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >📡 Ping</button>

              <button
                onClick={async () => {
                  try {
                    // Simple scan without adding to agent list
                    const res: any = await sendToContent({ type: "AGENT_SCAN" });
                    setMessages(m => [...m, { id: crypto.randomUUID(), role: "assistant", ts: Date.now(),
                      text: `Scan:\n• title: ${res?.insights?.title}\n• links: ${res?.insights?.elements?.filter?.((e: any) => e.role === "link")?.length ?? 0}` }]);
                  } catch (e: any) {
                    setMessages(m => [...m, { id: crypto.randomUUID(), role: "assistant", ts: Date.now(), text: "⚠️ " + (e?.message || "Scan failed") }]);
                  }
                }}
                className="rounded-md px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >🔍 Scan</button>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Feedback Overlay */}
      <VoiceFeedback />
    </div>
  );
}

/* ------------------------------- UI widgets -------------------------------- */
function Avatar({ role }: { role: Role }) {
  return (
    <div className={clsx(
      "size-7 rounded-full flex items-center justify-center select-none",
      role === "user" ? "bg-blue-600 text-white" : "bg-zinc-200 dark:bg-zinc-700"
    )}>
      {role === "user" ? "🧑" : "✨"}
    </div>
  );
}
function Bubble({ role, text, ts, action }: Msg) {
  const isUser = role === "user";
  const copy = async () => { try { await navigator.clipboard.writeText(text); } catch {} };
  return (
    <div className={clsx("flex items-end gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <Avatar role="assistant" />}
      <div className={clsx("max-w-[78%] group relative", isUser ? "order-2" : "order-1")}>
        <div className={clsx(
          "rounded-2xl px-3 py-2 whitespace-pre-wrap leading-relaxed shadow-sm",
          isUser ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm"
                 : "bg-zinc-100 dark:bg-zinc-800 rounded-bl-sm text-zinc-900 dark:text-zinc-100"
        )}>
          {text}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors"
          >
            {action.label}
          </button>
        )}
        <div className={clsx("flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1",
          isUser ? "justify-end" : "justify-start")}>
          <time className="text-[10px] text-zinc-500">{new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
          <button onClick={copy} className="text-[10px] text-blue-600 hover:underline">Copy</button>
        </div>
      </div>
      {isUser && <Avatar role="user" />}
    </div>
  );
}
