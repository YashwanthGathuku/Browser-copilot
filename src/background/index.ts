// src/background/index.ts
/// <reference types="chrome-types" />
import { handleRecordingMessage } from './recording-handlers';

/**
 * BACKGROUND (service worker) — Agent Manager
 * - Plans (via Prompt API if available, else rule-based)
 * - Creates agents (one per goal)
 * - Coordinates execution
 */

type Action =
  | { kind: "NAVIGATE"; url: string }
  | { kind: "OPEN_TAB"; url: string }
  | { kind: "CLOSE_TAB" }
  | { kind: "SCROLL"; to?: "top" | "bottom"; amount?: number }
  | { kind: "CLICK"; text?: string; selector?: string }
  | { kind: "TYPE"; selector: string; value: string; label?: string }
  | { kind: "SELECT_OPTION"; selector: string; optionText: string }
  | { kind: "SET_DATE"; selector: string; valueISO: string }
  | { kind: "SUBMIT"; selector?: string }
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
  tabStack?: number[]; // Stack of active tabs for this agent
  actions: Action[];
  currentActionIndex: number;
  logs: string[];
  canceled?: boolean;
  error?: string;
  currentIndex: number; // Duplicate of currentActionIndex, keeping for compatibility
};

type BackgroundMessage =
  | { type: "AGENTS_CREATE"; goal: string; preferNewTab?: boolean; urlHint?: string }
  | { type: "AGENTS_LIST" }
  | { type: "AGENTS_DETAILS"; id: string }
  | { type: "AGENTS_CANCEL"; id: string }
  | { type: "CAPTURE_SCREENSHOT" }
  | { type: "VISUAL_REASONING_FIND_ELEMENT"; description: string; visualContext: any }
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "REPLAY_RECORDING"; recordingId: string }
  | { type: "GET_RECORDINGS" }
  | { type: "DELETE_RECORDING"; recordingId: string }
  | { type: "EXPORT_RECORDING"; recordingId: string; format: string };

async function planWithLLM(goal: string, visionContext?: any): Promise<Action[]> {
  let session: any = null;
  try {
    const lm = (self as any).ai?.languageModel;
    if (!lm) throw new Error("No LM");

    session = await lm.create({
      systemPrompt: "You are a browser automation agent. Plan actions to achieve the goal."
    });

    const prompt = `
Plan actions for: "${goal}"
${visionContext ? `Context: ${JSON.stringify(visionContext).slice(0, 1000)}...` : ''}
Available actions:
- NAVIGATE { "url": "https://..." }
- OPEN_TAB { "url": "https://..." } (opens new tab and switches to it)
- CLOSE_TAB {} (closes current tab and switches to previous)
- SCROLL { "to":"top"|"bottom" } or { "amount": 0.8 }
- CLICK { "text": "visible label" } or { "selector": "..." }
- TYPE { "selector": "...", "value": "..." }
- SELECT_OPTION { "selector": "...", "optionText": "..." }
- SET_DATE { "selector": "...", "valueISO": "YYYY-MM-DD" }
- SUBMIT {}

Return ONLY valid JSON array of actions.
`;
    const out = await session.prompt(prompt);
    const text = typeof out === "string" ? out : out?.text ?? "";
    const clean = text.trim().replace(/^```json|```$/g, "");
    const parsed = JSON.parse(clean);
    // Normalize SEARCH to NAVIGATE
    const normalized: Action[] = (parsed as any[]).map((a) => {
      if (a.kind === "SEARCH" && (a as any).query) {
        return { kind: "NAVIGATE", url: `https://www.google.com/search?q=${encodeURIComponent((a as any).query)}` };
      }
      return a;
    });
    return normalized;
  } catch {
    return planRuleBased(goal);
  } finally {
    try { await session?.close?.(); } catch {}
    try { await session?.destroy?.(); } catch {}
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

// ---------- Storage helpers ----------
async function getAgents(): Promise<Map<string, Agent>> {
  const res = await chrome.storage.local.get("agents");
  if (res.agents) {
    try {
      return new Map(JSON.parse(res.agents));
    } catch {
      return new Map();
    }
  }
  return new Map();
}

async function saveAgents(agents: Map<string, Agent>) {
  await chrome.storage.local.set({ agents: JSON.stringify(Array.from(agents.entries())) });
}

async function getAgent(id: string): Promise<Agent | undefined> {
  const agents = await getAgents();
  return agents.get(id);
}

async function updateAgent(agent: Agent) {
  const agents = await getAgents();
  agents.set(agent.id, agent);
  await saveAgents(agents);
  broadcast(agent);
}

function getLM() {
  return (self as any).ai?.languageModel;
}

// ---------- Agent lifecycle ----------
function broadcast(agent: Agent) {
  chrome.runtime.sendMessage({ type: "AGENTS_UPDATE", agent }).catch(() => {});
}

async function runAgent(agentId: string) {
  // Re-fetch agent to ensure we have latest state
  let agent = await getAgent(agentId);
  if (!agent) return;

  if (agent.status === "canceled") return;
  
  agent.status = "running";
  // Ensure tabStack exists (migration)
  if (!agent.tabStack && agent.tabId) {
    agent.tabStack = [agent.tabId];
  }
  await updateAgent(agent);

  // We loop by index. Note: if SW dies, we restart.
  // Ideally, we'd have a mechanism to resume from current index on startup.
  // For now, we just ensure state is saved after every step.
  
  for (let i = agent.currentIndex; i < agent.actions.length; i++) {
    // Refresh state check in case it was canceled mid-loop
    agent = await getAgent(agentId);
    if (!agent || agent.canceled) break;

    const action = agent.actions[i];
    agent.currentIndex = i;
    agent.currentActionIndex = i;

    agent.logs.push(`▶ ${action.kind}`);
    await updateAgent(agent);

    try {
      // Map action -> content messages
      let ok = false;
      const tabId = agent.tabId!;
      
      if (action.kind === "NAVIGATE") {
        await chrome.tabs.update(tabId, { url: action.url });
        // wait until page completes
        await waitForTabComplete(tabId);
        ok = true;
      } else if (action.kind === "OPEN_TAB") {
        const t = await chrome.tabs.create({ url: action.url, active: true });
        const newTabId = t.id!;
        agent.tabId = newTabId;
        if (!agent.tabStack) agent.tabStack = [];
        agent.tabStack.push(newTabId);
        await waitForTabComplete(newTabId);
        ok = true;
      } else if (action.kind === "CLOSE_TAB") {
        if (agent.tabId) await chrome.tabs.remove(agent.tabId);
        if (!agent.tabStack) agent.tabStack = [];
        agent.tabStack.pop(); // remove current
        const prev = agent.tabStack[agent.tabStack.length - 1];
        if (prev) {
            agent.tabId = prev;
            await chrome.tabs.update(prev, { active: true });
        } else {
            // No tabs left?
            agent.tabId = undefined;
        }
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
      await updateAgent(agent);
    } catch (e: any) {
      agent.status = "error";
      agent.error = e?.message || String(e);
      agent.logs.push(`❌ ${agent.error}`);
      await updateAgent(agent);
      return;
    }
  }

  // Final check
  agent = await getAgent(agentId);
  if (!agent) return;

  if (agent.canceled) {
    agent.status = "canceled";
  } else if (agent.status !== "error") {
    agent.status = "done";
    agent.progress = 100;
  }
  await updateAgent(agent);
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

chrome.runtime.onMessage.addListener((msg: BackgroundMessage, 
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void): boolean => {
  
  // 1. Try recording handler first
  if (handleRecordingMessage(msg, sender, sendResponse)) {
    return true;
  }

  (async () => {
    if (msg.type === "AGENTS_CREATE") {
      const id = crypto.randomUUID();
      const tabId = await ensureTab(msg.preferNewTab, msg.urlHint);
      
      // Fetch Vision Context (Accessibility Tree)
      let visionContext = null;
      try {
        // Wait for tab to be ready if it's new
        if (msg.preferNewTab || msg.urlHint) {
           await waitForTabComplete(tabId);
        }
        const insights: any = await sendToContent(tabId, { type: "SCAN_PAGE" }); // Assuming SCAN_PAGE returns insights
        if (insights && insights.accessibilityTree) {
          visionContext = insights.accessibilityTree;
          console.log("[Background] Vision Context captured:", visionContext);
        }
      } catch (e) {
        console.warn("[Background] Failed to capture vision context:", e);
      }

      const actions = await planWithLLM(msg.goal, visionContext);

      const agent: Agent = {
        id,
        name: `Agent ${id.slice(0, 4)}`,
        goal: msg.goal,
        status: "idle",
        createdAt: Date.now(),
        progress: 0,
        tabId,
        tabStack: [tabId],
        actions,
        currentIndex: 0,
        currentActionIndex: 0,
        logs: [`🎯 Goal: ${msg.goal}`, `📑 Steps: ${actions.length}`],
      };
      
      const agents = await getAgents();
      agents.set(id, agent);
      await saveAgents(agents);
      
      broadcast(agent);

      // start
      runAgent(id);
      sendResponse({ ok: true, id, agent });
      return;
    }

    if (msg.type === "AGENTS_LIST") {
      const agents = await getAgents();
      sendResponse({ ok: true, agents: Array.from(agents.values()) });
      return;
    }

    if (msg.type === "AGENTS_DETAILS") {
      const agent = await getAgent(msg.id);
      sendResponse({ ok: true, agent: agent || null });
      return;
    }

    if (msg.type === "AGENTS_CANCEL") {
      const agent = await getAgent(msg.id);
      if (agent) {
        agent.canceled = true;
        agent.status = "canceled";
        await updateAgent(agent);
      }
      sendResponse({ ok: true });
      return;
    }

    // Screenshot capture for visual reasoning
    if (msg.type === "CAPTURE_SCREENSHOT") {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          const screenshot = await chrome.tabs.captureVisibleTab(tabs[0].windowId || undefined, {
            format: 'png'
          });
          sendResponse({ screenshot });
        } else {
          sendResponse({ error: 'No active tab found' });
        }
      } catch (error: any) {
        sendResponse({ error: error.message });
      }
      return;
    }

    // Visual reasoning: find element by description
    if (msg.type === "VISUAL_REASONING_FIND_ELEMENT") {
      try {
        const lm = getLM();
        if (!lm) {
          sendResponse({ error: 'Language model not available' });
          return;
        }

        const session = await lm.create({
          systemPrompt: 'You are a visual reasoning assistant. Analyze screenshots and accessibility trees to find elements. Return ONLY the CSS selector, nothing else.'
        });

        const prompt = `Find the element matching this description: "${msg.description}"\n\nAccessibility tree:\n${JSON.stringify(msg.visualContext.accessibilityTree, null, 2)}\n\nReturn only the CSS selector.`;
        
        const response = await session.prompt(prompt);
        const selector = typeof response === 'string' ? response.trim() : response?.text?.trim() || '';
        
        await session.close();
        sendResponse({ selector });
      } catch (error: any) {
        sendResponse({ error: error.message });
      }
      return;
    }
  })();

  return true; // async
});
