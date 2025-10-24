// src/background/index.ts
/// <reference types="chrome-types" />

/**
 * BACKGROUND (service worker) — Agent Manager
 * - Plans (via Prompt API if available, else rule-based)
 * - Creates agents (one per goal)
 * - Assigns/creates tabs
 * - Runs actions sequentially
 * - Streams AGENTS_UPDATE to sidepanel
 */

type Action =
  | { kind: "CLICK"; selector?: string; text?: string }
  | { kind: "TYPE"; selector?: string; label?: string; value: string }
  | { kind: "SELECT_OPTION"; selector: string; optionText: string }
  | { kind: "SET_DATE"; selector: string; valueISO: string }
  | { kind: "SUBMIT"; selector?: string }
  | { kind: "SCROLL"; amount?: number; to?: "top" | "bottom" }
  | { kind: "NAVIGATE"; url: string }
  | { kind: "SUMMARY" };

type AgentStatus = "idle" | "running" | "done" | "error" | "canceled" | "paused";

type Agent = {
  id: string;
  name: string;
  goal: string;
  status: AgentStatus;
  createdAt: number;
  progress: number; // 0..100
  tabId?: number;
  actions: Action[];
  currentIndex: number;
  logs: string[];
  error?: string;
  canceled?: boolean;
};

type MsgCreate = { type: "AGENTS_CREATE"; goal: string; preferNewTab?: boolean; urlHint?: string };
type MsgList = { type: "AGENTS_LIST" };
type MsgDetails = { type: "AGENTS_DETAILS"; id: string };
type MsgCancel = { type: "AGENTS_CANCEL"; id: string };

const agents = new Map<string, Agent>();

// ---------- Prompt API helpers (optional) ----------
function getLM(): any | null {
  const aiLM = (globalThis as any).ai?.languageModel || (globalThis as any).LanguageModel;
  return aiLM || null;
}

async function planWithLLM(goal: string): Promise<Action[]> {
  const lm = getLM();
  if (!lm) return planRuleBased(goal);

  // Robust: do not rely on streaming in service worker.
  const session = await lm.create?.({ languageCode: "en" }).catch(() => null);
  if (!session) return planRuleBased(goal);

  try {
    const prompt = `
You are a browser automation planner. Convert the user's goal into a JSON array of actions.
Allowed actions (with fields): 
- NAVIGATE { "url": "https://..." }
- SEARCH (emit as NAVIGATE with "https://www.google.com/search?q=...") 
- SCROLL { "to":"top"|"bottom" } or { "amount": 0.8 }
- CLICK { "text": "visible label" } or { "selector": "..." }
- TYPE { "selector": "...", "value": "..." }
- SELECT_OPTION { "selector": "...", "optionText": "..." }
- SET_DATE { "selector": "...", "valueISO": "YYYY-MM-DD" }
- SUBMIT {}

Return ONLY valid JSON.

Goal: "${goal}"
`;
    const out = await session.prompt(prompt);
    const text = typeof out === "string" ? out : out?.text ?? "";
    const clean = text.trim().replace(/^```json|```$/g, "");
    const parsed = JSON.parse(clean);
    // Normalize SEARCH to NAVIGATE
    const normalized: Action[] = (parsed as any[]).map((a) => {
      if (a.kind === "SEARCH" && a.query) {
        return { kind: "NAVIGATE", url: `https://www.google.com/search?q=${encodeURIComponent(a.query)}` };
      }
      return a;
    });
    return normalized;
  } catch {
    return planRuleBased(goal);
  } finally {
    try { await session.close?.(); } catch {}
  }
}

// Very simple fallback planner
function planRuleBased(goal: string): Action[] {
  const g = goal.toLowerCase();

  // open url
  const urlMatch = g.match(/\b(https?:\/\/[^\s]+|[a-z0-9-]+\.[a-z]{2,})(\/\S*)?/i);
  if (urlMatch) {
    const url = urlMatch[0].startsWith("http") ? urlMatch[0] : `https://${urlMatch[0]}`;
    return [{ kind: "NAVIGATE", url }];
  }

  // search
  const searchMatch = g.match(/(?:search (?:for )?|find )(.*)/i);
  if (searchMatch) {
    const q = searchMatch[1].trim();
    return [{ kind: "NAVIGATE", url: `https://www.google.com/search?q=${encodeURIComponent(q)}` }];
  }

  // summarize
  if (g.includes("summarize") || g.includes("summary")) {
    return [{ kind: "SUMMARY" }];
  }

  // scroll commands
  if (g.includes("scroll down")) return [{ kind: "SCROLL", amount: 0.8 }];
  if (g.includes("scroll up")) return [{ kind: "SCROLL", amount: -0.8 }];

  // default: search the goal
  return [{ kind: "NAVIGATE", url: `https://www.google.com/search?q=${encodeURIComponent(goal)}` }];
}

// ---------- Tab helpers ----------
async function ensureTab(preferNewTab?: boolean, urlHint?: string): Promise<number> {
  if (preferNewTab || urlHint) {
    const t = await chrome.tabs.create({ url: urlHint || "about:blank", active: true });
    return t.id!;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) return tab.id;
  const t = await chrome.tabs.create({ url: "about:blank", active: true });
  return t.id!;
}

// ---------- Agent lifecycle ----------
function broadcast(agent: Agent) {
  chrome.runtime.sendMessage({ type: "AGENTS_UPDATE", agent }).catch(() => {});
}

async function runAgent(agent: Agent) {
  if (agent.status === "canceled") return;
  agent.status = "running";
  broadcast(agent);

  for (let i = agent.currentIndex; i < agent.actions.length; i++) {
    if (agent.canceled) break;
    const action = agent.actions[i];
    agent.currentIndex = i;

    agent.logs.push(`▶ ${action.kind}`);
    broadcast(agent);

    try {
      // Map action -> content messages
      let ok = false;
      const tabId = agent.tabId!;
      if (action.kind === "NAVIGATE") {
        await chrome.tabs.update(tabId, { url: action.url });
        // wait until page completes
        await waitForTabComplete(tabId);
        ok = true;
      } else if (action.kind === "SCROLL") {
        ok = await sendToContent(tabId, { type: "SCROLL", amount: action.amount ?? 0.8, direction: (action.amount ?? 0) < 0 ? "up" : "down" });
      } else if (action.kind === "CLICK") {
        if (action.selector) {
          ok = await sendToContent(tabId, { type: "CLICK_SELECTOR", selector: action.selector });
        } else if (action.text) {
          ok = await sendToContent(tabId, { type: "CLICK_LABEL", label: action.text });
        }
      } else if (action.kind === "TYPE") {
        ok = await sendToContent(tabId, { type: "FILL_FIELD", label: action.label ?? "", value: action.value, selector: action.selector });
      } else if (action.kind === "SET_DATE") {
        ok = await sendToContent(tabId, { type: "SET_DATE", selector: action.selector, valueISO: action.valueISO });
      } else if (action.kind === "SELECT_OPTION") {
        ok = await sendToContent(tabId, { type: "SELECT_OPTION", selector: action.selector, optionText: action.optionText });
      } else if (action.kind === "SUBMIT") {
        ok = await sendToContent(tabId, { type: "SUBMIT", selector: action.selector });
      } else if (action.kind === "SUMMARY") {
        const res = await sendToContent(tabId, { type: "SUMMARY" });
        ok = !!res?.ok;
        if (res?.text) agent.logs.push(`📄 Page text captured (${res.text.length} chars)`);
      }

      if (!ok) throw new Error("content-script action failed");

      agent.progress = Math.round(((i + 1) / agent.actions.length) * 100);
      agent.logs.push("✅ step ok");
      broadcast(agent);
    } catch (e: any) {
      agent.status = "error";
      agent.error = e?.message || String(e);
      agent.logs.push(`❌ ${agent.error}`);
      broadcast(agent);
      return;
    }
  }

  if (agent.canceled) {
    agent.status = "canceled";
  } else {
    agent.status = "done";
    agent.progress = 100;
  }
  broadcast(agent);
}

async function waitForTabComplete(tabId: number): Promise<void> {
  // Basic wait for "complete"
  for (let i = 0; i < 40; i++) {
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (t?.status === "complete") return;
    await new Promise(r => setTimeout(r, 500));
  }
}

async function sendToContent(tabId: number, payload: any): Promise<boolean | any> {
  try {
    const res = await chrome.tabs.sendMessage(tabId, payload);
    if (typeof res === "object" && res && "ok" in res) return (res as any).ok ? res : false;
    return !!res;
  } catch {
    return false;
  }
}

// ---------- Message bus ----------
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg: MsgCreate | MsgList | MsgDetails | MsgCancel, 
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void): boolean => {
  (async () => {
    if (msg.type === "AGENTS_CREATE") {
      const id = crypto.randomUUID();
      const tabId = await ensureTab(msg.preferNewTab, msg.urlHint);
      const actions = await planWithLLM(msg.goal);

      const agent: Agent = {
        id,
        name: `Agent ${id.slice(0, 4)}`,
        goal: msg.goal,
        status: "idle",
        createdAt: Date.now(),
        progress: 0,
        tabId,
        actions,
        currentIndex: 0,
        logs: [`🎯 Goal: ${msg.goal}`, `📑 Steps: ${actions.length}`],
      };
      agents.set(id, agent);
      broadcast(agent);

      // start
      runAgent(agent);
      sendResponse({ ok: true, id, agent });
      return;
    }

    if (msg.type === "AGENTS_LIST") {
      sendResponse({ ok: true, agents: Array.from(agents.values()) });
      return;
    }

    if (msg.type === "AGENTS_DETAILS") {
      sendResponse({ ok: true, agent: agents.get(msg.id) || null });
      return;
    }

    if (msg.type === "AGENTS_CANCEL") {
      const a = agents.get(msg.id);
      if (a) {
        a.canceled = true;
        a.status = "canceled";
        broadcast(a);
      }
      sendResponse({ ok: true });
      return;
    }
  })();

  return true; // async
});
