// src/sidepanel/App.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

// If your project doesn't include chrome types, this keeps TS happy.
declare const chrome: any;

/* ------------------------------ helpers ------------------------------ */

function getLM(): any {
  // Prefer the spec surface if present
  return (globalThis as any).ai?.languageModel || (globalThis as any).LanguageModel || null;
}

type Role = "user" | "assistant";
type Msg = { id: string; role: Role; text: string; ts: number };

const SUPPORTED = ["en", "es", "ja"] as const;
type Lang2 = (typeof SUPPORTED)[number];

async function activeTabId(): Promise<number | null> {
  if (typeof chrome === "undefined" || !chrome.tabs) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function sendToContent(msg: unknown) {
  const id = await activeTabId();
  if (!id) throw new Error("No active tab");
  return chrome.tabs.sendMessage(id, msg);
}

/* --------------------------- intent detection --------------------------- */

type Intent =
  | { type: "SCROLL"; direction: "up" | "down"; amount?: number }
  | { type: "SEARCH"; query: string }
  | { type: "OPEN_URL"; url: string }
  | { type: "SUMMARY" }
  | { type: "NONE" };

function parseIntent(raw: string): Intent {
  const text = raw.trim().toLowerCase();

  if (/^summari[sz]e\b/.test(text) || /\bsummary\b/.test(text)) {
    return { type: "SUMMARY" };
  }

  if (/^scroll (down|up)\b/.test(text)) {
    const dir = text.includes("down") ? "down" : "up";
    return { type: "SCROLL", direction: dir, amount: 0.8 };
  }

  // “search for …”, “google …”
  const mSearch =
    text.match(/^search (?:for )?(.*)$/) ||
    text.match(/^google (.*)$/) ||
    text.match(/^find (.*)$/);
  if (mSearch && mSearch[1].trim()) {
    return { type: "SEARCH", query: mSearch[1].trim() };
  }

  // “open …” or a naked domain
  const mOpen = text.match(/^open (.*)$/);
  if (mOpen && mOpen[1].trim()) {
    const target = normalizeUrl(mOpen[1].trim());
    return { type: "OPEN_URL", url: target };
  }
  if (/^[a-z0-9.-]+\.(com|org|net|io|ai|dev|edu|gov)(\/.*)?$/i.test(text)) {
    return { type: "OPEN_URL", url: normalizeUrl(text) };
  }

  return { type: "NONE" };
}

function normalizeUrl(s: string) {
  try {
    // if already valid url with protocol
    new URL(s);
    return s;
  } catch {
    return `https://${s.replace(/^https?:\/\//, "")}`;
  }
}

/* ------------------------------ component ------------------------------ */

export default function App() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Hi! I’m your on-device assistant. How can I help?",
      ts: Date.now(),
    },
  ]);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [lang2, setLang2] = useState<Lang2>("en");

  const sessionRef = useRef<any>(null);

  // mic
  const recRef = useRef<any>(null);
  const listeningRef = useRef(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, busy, progress]);

  /* --------------------------- Prompt API session --------------------------- */

  const modelOpts = useMemo(
    () => ({
      expectedInputs: [{ type: "text", languages: [lang2] }],
      expectedOutputs: [{ type: "text", languages: [lang2] }],
      languageCode: lang2,
      monitor(m: any) {
        m.addEventListener("downloadprogress", (e: any) => {
          const pct = Math.round((e.loaded || 0) * 100);
          setProgress(pct);
          setStatus(`Downloading model… ${pct}%`);
        });
        m.addEventListener("error", () => setStatus("Model download error"));
      },
    }),
    [lang2]
  );

  async function ensureSession() {
    if (sessionRef.current) return sessionRef.current;
    const lm = getLM();
    if (!lm) throw new Error("Prompt API not found in this profile");

    setStatus("Creating session…");
    const s = await lm.create(modelOpts);
    sessionRef.current = s;
    setProgress(null);
    setStatus("Ready");
    return s;
  }

  // Dispose on language change
  useEffect(() => {
    (async () => {
      const s = sessionRef.current;
      if (!s) return;
      try {
        if (s.close) await s.close();
        else if (s.destroy) s.destroy();
      } catch {}
      sessionRef.current = null;
    })();
  }, [lang2]);

  /* --------------------------------- mic ---------------------------------- */

  function startASR() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setStatus("Speech not supported in this context");
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = `${lang2}-${lang2.toUpperCase()}`;

    let final = "";
    rec.onstart = () => {
      listeningRef.current = true;
      setStatus("Listening…");
    };
    rec.onerror = (e: any) => setStatus(`Mic error: ${e?.error ?? "unknown"}`);
    rec.onend = () => {
      listeningRef.current = false;
      setStatus("Stopped");
      recRef.current = null;
    };
    rec.onresult = async (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const textNow = (final + " " + interim).trim();
      setInput(textNow);

      // when the latest chunk is final, try to act
      if (ev.results[ev.results.length - 1]?.isFinal) {
        const autoActed = await handleIntentFromText(textNow);
        if (autoActed) {
          final = "";
          setInput("");
        }
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {}
  }

  function stopASR() {
    try {
      recRef.current?.stop();
    } catch {}
    recRef.current = null;
  }

  /* --------------------------------- send --------------------------------- */

  async function handleIntentFromText(text: string) {
    const intent = parseIntent(text);
    if (intent.type === "NONE") return false;

    // We display the original text as a user message,
    // and we’ll replace the assistant placeholder with progress/output.
    await send(text, /*forceLLM*/ false, intent);
    return true;
  }

  async function send(raw?: string, forceLLM = false, intent?: Intent) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;

    setBusy(true);
    setInput("");

    const uid = crypto.randomUUID();
    const aid = crypto.randomUUID();

    setMessages((m) => [
      ...m,
      { id: uid, role: "user", text, ts: Date.now() },
      { id: aid, role: "assistant", text: "…", ts: Date.now() },
    ]);

    try {
      // 1) Try to execute an intent (unless we explicitly force LLM chat)
      const inferred = intent ?? (forceLLM ? ({ type: "NONE" } as Intent) : parseIntent(text));
      if (inferred.type !== "NONE") {
        const acted = await executeIntent(inferred);
        if (inferred.type === "SUMMARY" && acted?.text) {
          // summarize page text via LLM
          const s = await ensureSession();
          setStatus("Summarizing page…");
          let out = "";
          if (typeof s.promptStreaming === "function") {
            for await (const chunk of s.promptStreaming(
              `Provide a concise summary:\n\n${acted.text.slice(0, 6000)}`
            )) {
              out += chunk;
              setMessages((m) => m.map((msg) => (msg.id === aid ? { ...msg, text: out } : msg)));
            }
          } else {
            const r = await s.prompt(`Provide a concise summary:\n\n${acted.text.slice(0, 6000)}`);
            out = typeof r === "string" ? r : r?.text ?? String(r ?? "");
            setMessages((m) => m.map((msg) => (msg.id === aid ? { ...msg, text: out } : msg)));
          }
          setStatus("Ready");
          setBusy(false);
          return;
        }

        // If action happened and there’s nothing else to say
        if (acted && acted.ok && !acted.text) {
          setMessages((m) =>
            m.map((msg) => (msg.id === aid ? { ...msg, text: "✅ Done." } : msg))
          );
          setStatus("Ready");
          setBusy(false);
          return;
        }
      }

      // 2) Fall back to normal LLM chat
      const s = await ensureSession();
      setStatus("Thinking…");

      let out = "";
      if (typeof s.promptStreaming === "function") {
        for await (const chunk of s.promptStreaming(text)) {
          out += chunk;
          setMessages((m) => m.map((msg) => (msg.id === aid ? { ...msg, text: out } : msg)));
        }
      } else {
        const res = await s.prompt(text);
        out = typeof res === "string" ? res : res?.text ?? String(res ?? "");
        setMessages((m) => m.map((msg) => (msg.id === aid ? { ...msg, text: out } : msg)));
      }
      setStatus("Ready");
    } catch (e: any) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === aid ? { ...msg, text: "⚠️ " + (e?.message || "Unknown error") } : msg
        )
      );
      setStatus("Error");
    } finally {
      setBusy(false);
    }
  }

  async function executeIntent(i: Intent): Promise<{ ok: boolean; text?: string }> {
    try {
      switch (i.type) {
        case "SCROLL": {
          await sendToContent({ type: "SCROLL", direction: i.direction, amount: i.amount ?? 0.8 });
          return { ok: true };
        }
        case "SEARCH": {
          const url = `https://www.google.com/search?q=${encodeURIComponent(i.query)}`;
          await chrome.tabs.create?.({ url });
          return { ok: true };
        }
        case "OPEN_URL": {
          await chrome.tabs.create?.({ url: i.url });
          return { ok: true };
        }
        case "SUMMARY": {
          const res = await sendToContent({ type: "SUMMARY" }); // content returns { ok, text }
          return res?.text ? { ok: true, text: String(res.text) } : { ok: false };
        }
        default:
          return { ok: false };
      }
    } catch (err) {
      // If content script isn’t injected you’ll get “Could not establish connection…”
      throw err;
    }
  }

  function clearChat() {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Cleared. How can I help?",
        ts: Date.now(),
      },
    ]);
  }

  /* --------------------------------- UI ---------------------------------- */

  return (
    <div className="h-[600px] w-[380px] flex flex-col text-[13px] bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
      {/* Header */}
      <header className="px-3 py-2 border-b border-zinc-200/70 dark:border-zinc-800/70 flex items-center gap-2">
        <div className="font-semibold">Nano Assistant</div>
        <div
          className={clsx(
            "ml-2 px-2 py-[2px] rounded-full text-[11px] font-medium",
            progress !== null
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
              : status.startsWith("Error")
              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
          )}
        >
          {progress !== null ? `Downloading ${progress}%` : status}
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
          onClick={clearChat}
          className="ml-2 rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Clear chat"
        >
          🧹
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scroll-smooth">
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.text} ts={m.ts} />
        ))}

        {/* typing indicator */}
        {busy && (
          <div className="flex items-end gap-2">
            <Avatar role="assistant" />
            <div className="rounded-2xl rounded-bl-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-2">
              <span className="typing-dots" />
            </div>
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
            placeholder="Say it or type it…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={() => (listeningRef.current ? stopASR() : startASR())}
              className={clsx(
                "rounded-lg px-3 py-2 font-semibold",
                listeningRef.current ? "bg-red-600 text-white" : "bg-zinc-900 text-white dark:bg-zinc-700"
              )}
              title={listeningRef.current ? "Stop voice" : "Start voice"}
            >
              {listeningRef.current ? "Stop" : "Voice"}
            </button>
            <button
              onClick={() => void send()}
              disabled={!input.trim() || busy}
              className={clsx(
                "rounded-lg px-3 py-2 font-semibold",
                !input.trim() || busy ? "bg-zinc-300 text-zinc-500 cursor-not-allowed" : "bg-blue-600 text-white"
              )}
              title="Send"
            >
              Send
            </button>
          </div>
        </div>

        <details className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          <summary className="cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200">
            Voice tips
          </summary>
          <div className="mt-1 space-y-1 text-[10px]">
            <div>• “scroll down / scroll up”</div>
            <div>• “search for nvidia gtc”</div>
            <div>• “open nvidia.com” or “nvidia.com”</div>
            <div>• “summarize” (summarizes the current page)</div>
          </div>
        </details>
      </div>
    </div>
  );
}

/* -------------------------------- UI bits -------------------------------- */

function Avatar({ role }: { role: Role }) {
  return (
    <div
      className={clsx(
        "size-7 rounded-full flex items-center justify-center select-none",
        role === "user" ? "bg-blue-600 text-white" : "bg-zinc-200 dark:bg-zinc-700"
      )}
    >
      {role === "user" ? "🧑" : "✨"}
    </div>
  );
}

function Bubble({ role, text, ts }: { role: Role; text: string; ts: number }) {
  const isUser = role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <div className={clsx("flex items-end gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <Avatar role="assistant" />}
      <div className={clsx("max-w-[78%] group relative", isUser ? "order-2" : "order-1")}>
        <div
          className={clsx(
            "rounded-2xl px-3 py-2 whitespace-pre-wrap leading-relaxed shadow-sm",
            isUser
              ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm"
              : "bg-zinc-100 dark:bg-zinc-800 rounded-bl-sm text-zinc-900 dark:text-zinc-100"
          )}
        >
          {text}
        </div>
        <div
          className={clsx(
            "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          <time className="text-[10px] text-zinc-500">
            {new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
          <button onClick={copy} className="text-[10px] text-blue-600 hover:underline">
            Copy
          </button>
        </div>
      </div>
      {isUser && <Avatar role="user" />}
    </div>
  );
}
