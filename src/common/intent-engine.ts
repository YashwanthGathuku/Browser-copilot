// src/common/intent-engine.ts

import type { Intent } from "./intents";

const urlRE = /^(https?:\/\/[^\s]+)$/i;

export function inferIntentDeterministic(text: string): Intent | null {
  const t = text.trim().toLowerCase();

  // Handle simple commands FIRST (before multi-step detection)
  if (/^scroll (down|up)/.test(t)) {
    return { type: "SCROLL", direction: t.includes("down") ? "down" : "up" };
  }
  
  if (t.startsWith("open ")) {
    const rest = text.slice(5).trim();
    // If it looks like a URL, open it directly (don't treat as multi-step)
    if (urlRE.test(rest)) return { type: "OPEN_URL", url: rest };
    // Otherwise treat as search
    return { type: "SEARCH_WEB", query: rest };
  }
  
  if (/^search /.test(t)) return { type: "SEARCH_WEB", query: text.slice(7).trim() };
  if (/summary|summarize|tl;dr/.test(t)) return { type: "SUMMARY" };

  // fill/ click by label
  const fill = t.match(/^fill (.+?)=(.+)$/);
  if (fill) return { type: "FILL_FIELD", label: fill[1].trim(), value: fill[2].trim() };
  const click = t.match(/^click (.+)$/);
  if (click) return { type: "CLICK_LABEL", label: click[1].trim() };

  // NOW check for multi-step task planning (after all simple commands)
  if (isMultiStepGoal(text)) {
    return { type: "PLAN_TASK", goal: text };
  }

  return null;
}

/**
 * Detect if text is a multi-step goal that should be planned
 * More selective - only for genuinely complex goals
 */
function isMultiStepGoal(text: string): boolean {
  const t = text.toLowerCase();

  // Only trigger for VERY specific complex patterns with multiple constraints
  
  // Travel/booking patterns - must have BOTH dates AND other details
  if (/(book|find|search).*(hotel|flight|accommodation|room).*(from|to|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov).*\b(for|with|and)\b/i.test(t)) {
    // Only if it has multiple constraint types
    const hasDateOrTime = /\b(from|to|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov)\b/i.test(t);
    const hasCapacity = /\b(for\s+\d+|people|guests|adults|person)\b/i.test(t);
    const hasAmenity = /\b(with|and)\s+(pool|spa|wifi|gym|parking|ocean|view|star)/i.test(t);
    
    if (hasDateOrTime && (hasCapacity || hasAmenity)) {
      return true;
    }
  }

  // Shopping / Finding patterns (Relaxed)
  // Matches: "find cheapest X on amazon", "search for X on google", "buy X on ebay"
  if (/(find|search|look for|buy|shop|get).*(on|in|at)\s+(amazon|google|ebay|web|internet|site)/i.test(t)) {
    return true;
  }

  // Price constraint patterns (Relaxed)
  // Matches: "cheapest coffee maker", "best headphones under $100"
  if (/(cheapest|best|affordable|budget).*(under|over|less than|more than|\$)/i.test(t)) {
    return true;
  }

  // Form completion patterns - only if explicitly mentioned
  if (/(fill|complete|submit).*(form|application|booking).*(with|and).+(.+)/i.test(t)) {
    return true;
  }

  // Multi-segment explicit patterns (separated by semicolon or multiple "then")
  if (/(\bstep\s*\d|then|after|next|;|,)/.test(text)) {
    const steps = text.split(/[;,]|then|after/).filter((s) => s.trim().length > 0);
    if (steps.length > 1) {
      return true;
    }
  }

  return false;
}
