// src/common/intent-engine.ts

import type { Intent } from "./intents";

const urlRE = /^(https?:\/\/[^\s]+)$/i;

export function inferIntentDeterministic(text: string): Intent | null {
  const t = text.trim().toLowerCase();

  if (/^scroll (down|up)/.test(t)) {
    return { type: "SCROLL", direction: t.includes("down") ? "down" : "up" };
  }
  if (t.startsWith("open ")) {
    const rest = text.slice(5).trim();
    if (urlRE.test(rest)) return { type: "OPEN_URL", url: rest };
    return { type: "SEARCH_WEB", query: rest };
  }
  if (/^search /.test(t)) return { type: "SEARCH_WEB", query: text.slice(7).trim() };
  if (/summary|summarize|tl;dr/.test(t)) return { type: "SUMMARY" };

  // fill/ click by label
  const fill = t.match(/^fill (.+?)=(.+)$/);
  if (fill) return { type: "FILL_FIELD", label: fill[1].trim(), value: fill[2].trim() };
  const click = t.match(/^click (.+)$/);
  if (click) return { type: "CLICK_LABEL", label: click[1].trim() };

  return null;
}
