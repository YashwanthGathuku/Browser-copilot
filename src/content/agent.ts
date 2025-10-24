/// <reference types="@types/chrome" />

/**
 * Content “Agent” – page scanning + low-level action execution.
 * Safe for strict TypeScript.
 */

import DOMPurify from "dompurify";
import { visualFeedback } from "../common/visual-feedback";
import type {
  ElementRole,
  ElementDescriptor,
  PageInsights,
  Action,
  AgentPlan
} from "../types/agent-types";

// Tiny banner so you know it injected
console.log("%c[Nano Agent] content script loaded", "color:#10b981");

// Optional debug hook
;(window as any).__NANO_AGENT__ = {
  ping: () => "[Nano Agent] pong",
  scan: () => scanPage(),
  elements: () => extractElements(),
};

/* -------------------------------- helpers -------------------------------- */

function $all<T extends Element = Element>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

function txt(el?: Element | null): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function accName(el: Element): string {
  // aria-labelledby
  const labelBy = el.getAttribute("aria-labelledby");
  if (labelBy) {
    const ref = document.getElementById(labelBy);
    if (ref) return txt(ref);
  }
  // aria-label
  const aria = el.getAttribute("aria-label");
  if (aria) return aria.trim();

  // visible text (HTML element only)
  if (el instanceof HTMLElement && el.innerText) return el.innerText.trim();

  // alt
  const alt = el.getAttribute("alt");
  if (alt) return alt.trim();

  return "";
}

function uniqueSelector(el: Element): string {
  // Prefer clean id
  if (el.id && !/\s/.test(el.id)) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let node: Element | null = el;
  while (node && parts.length < 5) {
    let seg = node.tagName.toLowerCase();
    if (node.classList.length) {
      seg += "." + Array.from(node.classList)
      .slice(0, 2)
      .map((c) => CSS.escape(c))
      .join(".");
    }
    const parentEl: Element | null = node.parentElement;

    if (parentEl) {
      const idx = Array.from(parentEl.children).indexOf(node) + 1;
      seg += `:nth-child(${idx})`;
    }
    parts.unshift(seg);
    node = parentEl;
  }
  return parts.join(" > ");
}

/* ------------------------------- extraction ------------------------------- */

function headingTexts(): string[] {
  return ["h1", "h2", "h3"].flatMap((h) => $all(h).map(txt)).filter(Boolean).slice(0, 10);
}

function firstParagraphs(): string[] {
  return $all("main p, article p, p").map(txt).filter((t) => t.length > 40).slice(0, 5);
}

function extractElements(): ElementDescriptor[] {
  const items: ElementDescriptor[] = [];
  const add = (role: ElementRole, el: Element, extras: Partial<ElementDescriptor> = {}) => {
    const title = accName(el) || txt(el);
    if (!title) return;
    items.push({
      role,
      title,
      selector: uniqueSelector(el),
      ...(el instanceof HTMLAnchorElement ? { href: el.href } : {}),
      ...extras,
    });
  };

  // Links, buttons
  $all<HTMLAnchorElement>("a[href]").slice(0, 200).forEach((a) => add("link", a, { subtitle: txt(a) }));
  $all<HTMLButtonElement>("button").slice(0, 200).forEach((b) => add("button", b));

  // Inputs / selects / textareas
  $all<HTMLInputElement>("input").slice(0, 100).forEach((i) => add("input", i));
  $all<HTMLSelectElement>("select").slice(0, 50).forEach((s) => add("select", s));
  $all<HTMLTextAreaElement>("textarea").slice(0, 50).forEach((t) => add("textarea", t));

  // Heuristic cards
  $all<HTMLElement>('.card,.result,.listing,[role="article"],[role="listitem"]').slice(0, 100).forEach((c) => {
    const title = (c.querySelector("h3,h2,h1")?.textContent || accName(c) || "").trim();
    if (title) items.push({ role: "card", title, subtitle: txt(c), selector: uniqueSelector(c) });
  });

  // De-dupe by role|title|hrefOrSelector
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = `${i.role}|${i.title}|${i.href ?? i.selector}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function detectDateControls() {
  const checkIn =
    document.querySelector<HTMLInputElement>('input[type="date"][name*="in"], input[name*="checkin"]') ||
    document.querySelector<HTMLInputElement>('input[aria-label*="check in" i]');
  const checkOut =
    document.querySelector<HTMLInputElement>('input[type="date"][name*="out"], input[name*="checkout"]') ||
    document.querySelector<HTMLInputElement>('input[aria-label*="check out" i]');

  return {
    hasDateInputs: !!(checkIn || checkOut),
    dateSelectors: {
      checkIn: checkIn ? uniqueSelector(checkIn) : undefined,
      checkOut: checkOut ? uniqueSelector(checkOut) : undefined,
    },
  };
}

/* ------------------------------- public API ------------------------------- */



export function scanPage(): PageInsights {
  const insights: PageInsights = {
    url: location.href,
    title: document.title,
    headings: headingTexts(),
    topText: firstParagraphs(),
    elements: extractElements(),
    controls: detectDateControls(),
  };

  try {
    visualFeedback.showFeedback({
      type: "highlight",
      message: `🕵️ Scanned ${insights.elements.length} elements`,
      duration: 2000,
    });
  } catch {
    // visual feedback optional
  }

  // Optional Chrome Labs Summarizer (avoid TS errors via any-cast)
  const cAny = chrome as any;
  if (cAny?.summarizer?.summarize) {
    cAny
      .summarizer
      .summarize({ text: document.body.innerText.slice(0, 5000), maxTokens: 100 })
      .then((summary: any) => console.log("[Nano Agent] Auto-summary:", summary.text))
      .catch(() => {});
  }

  return insights;
}

export async function executeAction(action: Action): Promise<{ ok: boolean; result?: any }> {
  const cssEscape = (CSS as any)?.escape ?? ((s: string) => s.replace(/["\\]/g, "\\$&"));

  for (let attempts = 0; attempts < 3; attempts++) {
    try {
      switch (action.kind) {
        case "NAVIGATE": {
          location.href = action.url;
          return { ok: true };
        }

        case "SCROLL": {
          if (action.to === "top") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else if (action.to === "bottom") {
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          } else {
            const dy = (action.amount ?? 0.8) * window.innerHeight;
            window.scrollBy({ top: dy, behavior: "smooth" });
          }
          try {
            visualFeedback.showFeedback({
              type: "scroll",
              message: `Scrolling ${action.to ?? "down"}`,
              duration: 1500,
            });
          } catch {}
          return { ok: true };
        }

        case "CLICK": {
          let el: HTMLElement | null = null;

          if (action.selector) {
            el = document.querySelector<HTMLElement>(action.selector);
          }
          if (!el && action.text) {
            const t = cssEscape(action.text);
            el =
              (document.querySelector(
                `[aria-label*="${t}" i], [title*="${t}" i]`
              ) as HTMLElement) || null;
          }
          if (!el) return { ok: false, result: "Element not found" };

          try {
            visualFeedback.showFeedback({
              type: "click",
              element: el,
              message: `Clicked ${action.text || action.selector}`,
              duration: 2000,
            });
          } catch {}
          el.click();
          return { ok: true };
        }

        case "TYPE": {
          if (!action.selector) return { ok: false, result: "Missing selector" };
          const input =
            document.querySelector<HTMLInputElement | HTMLTextAreaElement>(action.selector);
          if (!input) return { ok: false, result: "Input not found" };

          input.focus();
          input.value = DOMPurify.sanitize(action.value ?? "");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          try {
            visualFeedback.showFeedback({
              type: "fill",
              element: input,
              message: `Typed into ${action.label || action.selector}`,
              duration: 2000,
            });
          } catch {}
          return { ok: true };
        }

        case "SET_DATE": {
          if (!action.selector) return { ok: false, result: "Missing selector" };
          const dateInput = document.querySelector<HTMLInputElement>(action.selector);
          if (!dateInput) return { ok: false, result: "Date input not found" };

          dateInput.value = action.valueISO;
          dateInput.dispatchEvent(new Event("change", { bubbles: true }));
          return { ok: true };
        }

        case "SELECT_OPTION": {
          if (!action.selector) return { ok: false, result: "Missing selector" };
          if (!action.optionText) return { ok: false, result: "Missing optionText" };

          const select = document.querySelector<HTMLSelectElement>(action.selector);
          if (!select) return { ok: false, result: "Select not found" };

          const target = action.optionText.trim().toLowerCase();
          const opt = Array.from(select.options).find(
            (o) => (o.textContent || "").trim().toLowerCase() === target
          );
          if (!opt) return { ok: false, result: "Option not found" };

          select.value = opt.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          return { ok: true };
        }

        case "SUBMIT": {
          const sel = action.selector || "form";
          const form = document.querySelector<HTMLFormElement>(sel);
          if (!form) return { ok: false, result: "Form not found" };
          form.requestSubmit();
          return { ok: true };
        }

        default:
          return { ok: false, result: "Unknown action type" };
      }
    } catch (e) {
      console.warn(`Retry ${attempts + 1}:`, e);
      if (attempts === 2) return { ok: false, result: e };
    }
  }
  return { ok: false, result: "Max retries exceeded" };
}

/** Execute a batch then re-scan for insights */
export async function executeAgentActions(actions: Action[]): Promise<{ ok: boolean; insights?: PageInsights }> {
  for (const a of actions) {
    const r = await executeAction(a);
    if (!r.ok) return { ok: false };
  }
  const insights = scanPage();
  return { ok: true, insights };
}
