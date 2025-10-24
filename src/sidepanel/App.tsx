import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import DOMPurify from "dompurify";
import { inferIntentDeterministic } from "../common/intent-engine";
import { 
  Mic, 
  MicOff, 
  Send, 
  Trash2, 
  Radio, 
  ScanLine, 
  Sparkles,
  User,
  Loader2,
  Copy,
  Check
} from "lucide-react";

/* -------------------------- Local panel-only types -------------------------- */
type Role = "user" | "assistant";
type Msg = { id: string; role: Role; text: string; ts: number };

type PanelIntent =
  | { type: "SCROLL"; direction: "up" | "down"; amount?: number }
  | { type: "OPEN_URL"; url: string }
  | { type: "SEARCH_WEB"; query: string }
  | { type: "SUMMARY" }
  | { type: "CLICK_LABEL"; label: string }
  | { type: "FILL_FIELD"; label: string; value: string };

type AgentStatus = {
  id: string;
  title: string;
  tabId?: number | null;
  steps: number;
  progress: number;
  state: "queued" | "running" | "done" | "error";
  note?: string;
};

const SUPPORTED = ["en", "es", "ja"] as const;
type Lang2 = (typeof SUPPORTED)[number];

/* -------------------------- Ambient runtime typings ------------------------- */
declare global {
  interface Window {
    ai?: { languageModel?: { create(opts: any): Promise<any> } };
    LanguageModel?: { create(opts: { languageCode: string }): Promise<any> };
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
function getLM(): any {
  return window.ai?.languageModel || window.LanguageModel || null;
}

/* -------------------- normalize unknown intent -> PanelIntent ---------------- */
function isPanelIntent(i: any): i is PanelIntent {
  return i && typeof i === "object" && typeof i.type === "string" &&
    ["SCROLL", "OPEN_URL", "SEARCH_WEB", "SUMMARY", "CLICK_LABEL", "FILL_FIELD"].includes(i.type);
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
  const [status, setStatus] = useState("Idle");
  const [lang2, setLang2] = useState<Lang2>("en");

  // voice
  const [isListening, setIsListening] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const recRef = useRef<any>(null);
  const animRef = useRef<number | null>(null);

  // agent dashboard
  const [agents, setAgents] = useState<Record<string, AgentStatus>>({});

  // LLM session
  const sessionRef = useRef<any>(null);

  // auto-scroll chat
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, busy]);

  /* ------------------------------ voice vis -------------------------------- */
  function startVoiceVis() {
    const tick = () => { setVoiceLevel((v) => (v + 13) % 100); animRef.current = requestAnimationFrame(tick); };
    animRef.current = requestAnimationFrame(tick);
  }
  function stopVoiceVis() {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    animRef.current = null; setVoiceLevel(0);
  }

  /* --------------------------------- ASR ----------------------------------- */
  function startASR() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setStatus("Speech not supported."); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true;
    rec.lang = `${lang2}-${lang2.toUpperCase()}`;

    let final = "";
    rec.onstart = () => { setIsListening(true); startVoiceVis(); setStatus("Listening…"); };
    rec.onerror = (e: any) => setStatus(`Mic error: ${e?.error ?? "unknown"}`);
    rec.onend   = () => { setIsListening(false); stopVoiceVis(); setStatus("Stopped."); recRef.current = null; };
    rec.onresult = async (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
      }
      const text = (final + " " + interim).trim();
      setInput(text);
      if (ev.results[ev.results.length - 1]?.isFinal) await handleText(text);
    };
    recRef.current = rec; try { rec.start(); } catch {}
  }
  function stopASR() {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null; setIsListening(false); stopVoiceVis();
  }

  /* ------------------------------ LLM session ------------------------------ */
  async function ensureSession() {
    if (sessionRef.current) return sessionRef.current;
    const lm = getLM();
    if (!lm) throw new Error("Prompt API not found (enable Gemini Nano).");
    setStatus("Creating session…");
    // ✅ Chrome’s current Prompt API only accepts { languageCode }
    const s = await lm.create({ languageCode: lang2 });
    sessionRef.current = s; setStatus("Ready.");
    return s;
  }
  useEffect(() => {
    const s = sessionRef.current;
    if (!s) return;
    (async () => { try { await s?.close?.(); } catch {} try { s?.destroy?.(); } catch {} sessionRef.current = null; })();
  }, [lang2]);

  /* -------------------------- Agent dashboard utils ------------------------ */
  function addAgent(title: string, steps = 1, tabId?: number | null) {
    const id = Math.random().toString(36).slice(2, 6);
    setAgents(a => ({ ...a, [id]: { id, title, steps, progress: 0, state: "running", tabId } }));
    setMessages(m => [...m, { id: crypto.randomUUID(), role: "assistant", text: `🤖 Started: ${title}  Steps: ${steps}`, ts: Date.now() }]);
    return id;
  }
  function stepAgent(id: string, pct: number, note?: string) {
    setAgents(a => ({ ...a, [id]: { ...a[id], progress: Math.min(100, Math.max(a[id]?.progress ?? 0, pct)), note } }));
  }
  function finishAgent(id: string, ok: boolean, note?: string) {
    setAgents(a => ({ ...a, [id]: { ...a[id], state: ok ? "done" : "error", progress: 100, note } }));
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
      }
      return { ok: false };
    } catch (e: any) {
      return { ok: false, text: e?.message || "dispatch failed" };
    }
  }

  /* -------------------------------- routing -------------------------------- */
  async function handleText(raw: string) {
    const text = DOMPurify.sanitize((raw || input).trim());
    if (!text) return;

    setInput(""); setBusy(true);
    const uid = crypto.randomUUID(); const aid = crypto.randomUUID();
    setMessages(m => [...m, { id: uid, role: "user", text, ts: Date.now() }, { id: aid, role: "assistant", text: "…", ts: Date.now() }]);

    try {
      const intent = normalizeIntent(inferIntentDeterministic(text));

      if (intent && isPanelIntent(intent)) {
        if (intent.type === "SUMMARY") {
          const acted = await executeIntent(intent);
          if (acted.ok && acted.text) {
            const s = await ensureSession();
            setStatus("Summarizing page…");
            let out = "";
            if (typeof s.promptStreaming === "function") {
              for await (const chunk of s.promptStreaming(`Provide a concise summary:\n\n${acted.text.slice(0, 6000)}`)) {
                out += chunk; setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: out } : msg));
              }
            } else {
              const r = await s.prompt(`Provide a concise summary:\n\n${acted.text.slice(0, 6000)}`);
              out = typeof r === "string" ? r : r?.text ?? String(r ?? "");
              setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: out } : msg));
            }
            setStatus("Ready."); setBusy(false); return;
          }
        } else {
          const title =
            intent.type === "SCROLL"     ? `Scroll ${intent.direction}` :
            intent.type === "OPEN_URL"   ? "Navigate" :
            intent.type === "SEARCH_WEB" ? "Search" :
            intent.type === "CLICK_LABEL"? `Click "${intent.label}"` :
            intent.type === "FILL_FIELD" ? `Fill "${intent.label}"` : intent.type;

          const agId = addAgent(title, 1);
          stepAgent(agId, 40);
          const acted = await executeIntent(intent);
          stepAgent(agId, 90);
          finishAgent(agId, acted.ok, acted.text);
          setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: acted.ok ? "✅ Done." : `⚠️ ${acted.text || "Failed"}` } : msg));
          setStatus("Ready."); setBusy(false); return;
        }
      }

      // Not actionable → normal on-device chat
      const s = await ensureSession(); setStatus("Thinking…");
      let out = "";
      if (typeof s.promptStreaming === "function") {
        for await (const chunk of s.promptStreaming(text)) {
          out += chunk; setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: out } : msg));
        }
      } else {
        const r = await s.prompt(text);
        out = typeof r === "string" ? r : r?.text ?? String(r ?? "");
        setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: out } : msg));
      }
      setStatus("Ready.");
    } catch (e: any) {
      setMessages(m => m.map(msg => msg.id === aid ? { ...msg, text: "⚠️ " + (e?.message || "Unknown error") } : msg));
      setStatus("Error.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------------------------------- UI ----------------------------------- */
  return (
    <div className="h-[600px] w-[380px] flex flex-col text-[13px] bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="p-1.5 rounded-lg bg-blue-600 shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="font-bold text-base text-gray-900 dark:text-white">
              Nano Assistant
            </div>
          </div>

          <select
            className="rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-medium shadow-sm hover:border-blue-400 dark:hover:border-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={lang2}
            onChange={(e) => setLang2((e.target.value as Lang2) || "en")}
          >
            <option value="en">🌐 EN</option>
            <option value="es">🌐 ES</option>
            <option value="ja">🌐 JA</option>
          </select>

          <button
            onClick={() => setMessages([{ id: crypto.randomUUID(), role: "assistant", text: "Cleared. How can I help?", ts: Date.now() }])}
            className="p-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all shadow-sm"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4 text-gray-600 dark:text-zinc-400" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium",
            status.startsWith("Error")
              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
              : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200"
          )}>
            <div className={clsx(
              "w-1.5 h-1.5 rounded-full",
              status.startsWith("Error") ? "bg-red-500" : "bg-green-500 animate-pulse"
            )} />
            {status}
          </div>

          {/* voice bars */}
          {isListening && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
              <div className="h-4 flex items-end gap-[2px]">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-[3px] bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" style={{ height: `${Math.max(4, (voiceLevel / 2) + Math.random() * 10)}px`, animationDelay: `${i * 100}ms` }} />
                ))}
              </div>
              <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300 ml-1">Listening</span>
            </div>
          )}
        </div>
      </header>

      {/* Agent dashboard */}
      {Object.values(agents).length > 0 && (
        <section className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900">
          <div className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            Active Agents
          </div>
          <div className="flex flex-col gap-2">
            {Object.values(agents).map(ag => (
              <div key={ag.id} className="rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 shadow-sm">
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <div className="font-medium text-gray-800 dark:text-zinc-100">{ag.title}</div>
                  <div className={clsx(
                    "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
                    ag.state === "running" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                      : ag.state === "done" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
                  )}>{ag.state}</div>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
                  <div className={clsx(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    ag.state === "done" ? "bg-green-500"
                      : ag.state === "error" ? "bg-red-500"
                      : "bg-blue-600"
                  )} style={{ width: `${ag.progress}%` }} />
                </div>
                {ag.note && <div className="mt-1.5 text-[11px] text-gray-600 dark:text-zinc-400 italic">{ag.note}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scroll-smooth bg-gray-50 dark:bg-zinc-900">
        {messages.map(m => <Bubble key={m.id} role={m.role} text={m.text} ts={m.ts} />)}
        {busy && (
          <div className="flex gap-3 mb-4 animate-fade-in">
            <div className="flex-shrink-0">
              <Avatar role="assistant" />
            </div>
            <div className="flex flex-col gap-1 items-start">
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm">
                <span className="typing-dots" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Controls */}
      <div className="border-t border-gray-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900 shadow-lg">
        <div className="flex gap-2 mb-2">
          <textarea
            className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-600 dark:focus:border-blue-600 transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-500"
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
                "rounded-xl px-3 py-2 font-medium text-sm transition-all shadow-sm hover:shadow flex items-center justify-center gap-1.5",
                isListening 
                  ? "bg-red-600 text-white hover:bg-red-700 ring-2 ring-red-400 ring-offset-2 dark:ring-offset-zinc-900" 
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
              title={isListening ? "Stop voice" : "Start voice"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={() => void handleText(input)}
              disabled={!input.trim() || busy}
              className={clsx(
                "rounded-xl px-3 py-2 font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-1.5",
                (!input.trim() || busy) 
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-500" 
                  : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow"
              )}
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* quick tools */}
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try { const res: any = await sendToContent({ type: "PING" }); setStatus(res?.ok ? "Agent reachable" : "No content script"); }
              catch (e: any) { setStatus(e?.message?.includes("Page can’t receive") ? "This page can’t run content scripts" : "Ping failed"); }
            }}
            className="flex-1 rounded-lg px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-all shadow-sm font-medium text-xs flex items-center justify-center gap-1.5"
          >
            <Radio className="w-3.5 h-3.5" />
            Ping
          </button>

          <button
            onClick={async () => {
              try {
                const agId = addAgent("Scan page", 1);
                stepAgent(agId, 40);
                const res: any = await sendToContent({ type: "AGENT_SCAN" });
                stepAgent(agId, 90); finishAgent(agId, true);
                setMessages(m => [...m, { id: crypto.randomUUID(), role: "assistant", ts: Date.now(),
                  text: `Scan:\n• title: ${res?.insights?.title}\n• links: ${res?.insights?.elements?.filter?.((e: any) => e.role === "link")?.length ?? 0}` }]);
              } catch (e: any) {
                setMessages(m => [...m, { id: crypto.randomUUID(), role: "assistant", ts: Date.now(), text: "⚠️ " + (e?.message || "Scan failed") }]);
              }
            }}
            className="flex-1 rounded-lg px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-all shadow-sm font-medium text-xs flex items-center justify-center gap-1.5"
          >
            <ScanLine className="w-3.5 h-3.5" />
            Scan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- UI widgets -------------------------------- */
function Avatar({ role }: { role: Role }) {
  return (
    <div className={clsx(
      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
      role === "user" 
        ? "bg-blue-600 text-white" 
        : "bg-gray-200 dark:bg-zinc-700"
    )}>
      {role === "user" ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
    </div>
  );
}

function Bubble({ role, text, ts }: { role: Role; text: string; ts: number }) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const copy = async () => { 
    try { 
      await navigator.clipboard.writeText(text); 
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {} 
  };
  return (
    <div className={clsx("flex gap-3 mb-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0">
          <Avatar role="assistant" />
        </div>
      )}
      <div className={clsx("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div className="group relative">
          <div className={clsx(
            "relative px-4 py-3 rounded-2xl max-w-[85%] break-words whitespace-pre-wrap text-[14px] leading-relaxed shadow-sm transition-all duration-200",
            isUser 
              ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm" 
              : "bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-tl-sm border border-gray-200 dark:border-zinc-700"
          )}>
            <p className="m-0">{text}</p>
          </div>
          <div className={clsx(
            "flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            isUser ? "justify-end" : "justify-start"
          )}>
            <time className="text-[11px] text-gray-500 dark:text-gray-400">
              {new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </time>
            <button 
              onClick={copy} 
              className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-700"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {isUser && (
        <div className="flex-shrink-0">
          <Avatar role="user" />
        </div>
      )}
    </div>
  );
}
