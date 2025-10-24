// src/common/agent.ts

import type { Action, AgentPlan, AgentType } from "../types/agent-types";

type LM = {
  create: (opts: any) => Promise<any>;
  prompt?: (s: string, opts?: any) => Promise<any>;
  promptStreaming?: (s: string, opts?: any) => AsyncGenerator<string>;
};

// works in sidepanel/background pages
function getLM(): LM | null {
  const g: any = globalThis as any;
  return g.ai?.languageModel || g.LanguageModel || null;
}

function cleanJson(s: string): string {
  return s
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

export interface Agent {
  type: AgentType;
  plan: (query: string, lang: string) => Promise<AgentPlan>;
  execute: (actions: Action[], tabId: number) => Promise<{ ok: boolean }>;
}

export async function createAgent(type: AgentType, lang: string): Promise<Agent> {
  const lm = getLM();
  if (!lm) throw new Error("Prompt API (Gemini Nano) not available in this context");

  // Keep sessions tiny/specific (sidepanel)
  const session = await lm.create({ languageCode: lang });

  const SYSTEMS: Record<AgentType, string> = {
    orchestrator: `
You orchestrate multi-step browsing. Output ONLY valid JSON matching:
{
  "summary": "string",
  "questions": ["..."]?,
  "suggestions": [
    {
      "title": "string",
      "reason": "string?",
      "agent": "navigation|interaction|analysis",
      "actions": [ /* array of actions: CLICK/TYPE/SELECT_OPTION/SET_DATE/SUBMIT/SCROLL/NAVIGATE */ ]
    }
  ]
}
    `,
    navigation: `Plan only NAVIGATE or SCROLL actions. Output JSON array of actions.`,
    interaction: `Plan CLICK/TYPE/SELECT_OPTION/SET_DATE/SUBMIT actions. Output JSON array of actions.`,
    analysis: `Plan SUMMARY-oriented steps as {"summary": "...","suggestions":[...]} or [] if none.`,
  };

  return {
    type,
    async plan(query: string, languageCode: string) {
      const raw = await session.prompt(`${SYSTEMS[type]}\n\nUser: ${query}\nLanguage: ${languageCode}`);
      const text = typeof raw === "string" ? raw : raw?.text ?? String(raw ?? "");
      return JSON.parse(cleanJson(text)) as AgentPlan;
    },

    async execute(actions: Action[], tabId: number) {
      // Delegate DOM work to the content script
      const res = await chrome.tabs.sendMessage(tabId, { type: "AGENT_EXECUTE", actions });
      return { ok: !!(res && (res as any).ok) };
    }
  };
}
