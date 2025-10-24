import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import DOMPurify from "dompurify";
import { inferIntentDeterministic } from "../common/intent-engine";

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
    <div className="h-[600px] w-[380px] flex flex-col text-[13px] bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
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

        {/* voice bars */}
        <div className="ml-2 h-5 flex items-end gap-[2px]">
          {isListening && [1,2,3,4,5].map(i => (
            <div key={i} className="w-[3px] bg-blue-500 rounded-sm" style={{ height: `${Math.max(4, (voiceLevel / 2) + Math.random() * 8)}px` }} />
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
          onClick={() => setMessages([{ id: crypto.randomUUID(), role: "assistant", text: "Cleared. How can I help?", ts: Date.now() }])}
          className="ml-2 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Clear chat"
        >
          🧹
        </button>
      </header>

      {/* Agent dashboard */}
      <section className="px-3 py-2 border-b border-zinc-200/70 dark:border-zinc-800/70">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Active Agents</div>
        {Object.values(agents).length === 0 && <div className="text-[11px] text-zinc-500">No agents running.</div>}
        <div className="flex flex-col gap-2">
          {Object.values(agents).map(ag => (
            <div key={ag.id} className="rounded-md border border-zinc-200 dark:border-zinc-700 p-2">
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scroll-smooth">
        {messages.map(m => <Bubble key={m.id} role={m.role} text={m.text} ts={m.ts} />)}
        {busy && (
          <div className="flex items-end gap-2">
            <Avatar role="assistant" />
            <div className="rounded-2xl rounded-bl-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-2"><span className="typing-dots" /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Controls */}
      <div className="border-t border-zinc-200/70 dark:border-zinc-800/70 p-2">
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
              className={clsx("rounded-lg px-3 py-2 font-semibold", isListening ? "bg-red-600 text-white" : "bg-zinc-900 text-white dark:bg-zinc-700")}
              title={isListening ? "Stop voice" : "Start voice"}
            >
              {isListening ? "Stop" : "Voice"}
            </button>
            <button
              onClick={() => void handleText(input)}
              disabled={!input.trim() || busy}
              className={clsx("rounded-lg px-3 py-2 font-semibold", (!input.trim() || busy) ? "bg-zinc-300 text-zinc-500 cursor-not-allowed" : "bg-blue-600 text-white")}
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
            className="rounded-md px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >🔍 Scan</button>
        </div>
      </div>
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
function Bubble({ role, text, ts }: { role: Role; text: string; ts: number }) {
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
