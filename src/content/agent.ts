// // src/content/agent.ts

// // ---- Agent banner ----
// console.log("%c[Nano Agent] content script loaded", "color:#10b981");

// // expose a tiny debug hook to the page console
// // (Open page DevTools → Console → type: window.__NANO_AGENT__)
// ;(window as any).__NANO_AGENT__ = {
//   ping: () => "[Nano Agent] pong",
// };

// import type { Action, ElementDescriptor, PageInsights } from "../types/agent-types";

// const $all = <T extends Element = Element>(sel: string, root: ParentNode = document) =>
//   Array.from(root.querySelectorAll<T>(sel));

// const txt = (el?: Element | null) => (el?.textContent || "").replace(/\s+/g, " ").trim();
// const accName = (el: Element) =>
//   (el.getAttribute("aria-label")
//     || (el.getAttribute("aria-labelledby")
//         ? txt(document.getElementById(el.getAttribute("aria-labelledby")!))
//         : "")
//     || (el as HTMLElement).innerText
//     || el.getAttribute("alt")
//     || "").replace(/\s+/g, " ").trim();

// function priceFrom(s: string): number | undefined {
//   const m = s.replace(/,/g, "").match(/(?:\$|₹|€|£)\s?(\d+(?:\.\d+)?)/);
//   if (!m) return;
//   const n = parseFloat(m[1]); return Number.isFinite(n) ? n : undefined;
// }
// function ratingFrom(s: string): number | undefined {
//   const d10 = s.match(/(\d+(?:\.\d+)?)\s*\/\s*10/);
//   if (d10) return Math.min(5, (parseFloat(d10[1]) / 10) * 5);
//   const d5 = s.match(/(\d+(?:\.\d+)?)\s*\/\s*5/);
//   if (d5) return Math.min(5, parseFloat(d5[1]));
//   const lone = s.match(/\b(\d\.\d)\b/);
//   if (lone) {
//     const v = parseFloat(lone[1]);
//     return v <= 5 ? v : Math.min(5, (v / 10) * 5);
//   }
//   return;
// }

// function uniqueSelector(el: Element): string {
//   if (el.id) return `#${CSS.escape(el.id)}`;
//   const path: string[] = [];
//   let node: Element | null = el;
//   while (node && path.length < 5) {
//     let sel = node.nodeName.toLowerCase();
//     if (node.classList.length) sel += "." + [...node.classList].slice(0, 2).map(CSS.escape).join(".");
//     const nth = Array.from(node.parentElement?.children || []).indexOf(node) + 1;
//     sel += `:nth-child(${nth})`;
//     path.unshift(sel); node = node.parentElement;
//   }
//   return path.join(" > ");
// }

// function headingTexts(): string[] {
//   return ["h1","h2","h3"].flatMap(h => $all(h).map(txt)).filter(Boolean).slice(0, 10);
// }

// function firstParagraphs(): string[] {
//   return $all("main p, article p, .content p, p").map(txt).filter(t => t.length > 40).slice(0, 5);
// }

// function extractElements(): ElementDescriptor[] {
//   const items: ElementDescriptor[] = [];

//   const add = (role: ElementDescriptor["role"], el: Element, extras: Partial<ElementDescriptor> = {}) => {
//     const title = accName(el) || txt(el);
//     if (!title) return;
//     items.push({
//       role, title,
//       selector: uniqueSelector(el),
//       ...(el instanceof HTMLAnchorElement ? { href: el.href } : {}),
//       ...extras
//     });
//   };

//   // Links and buttons
//   $all<HTMLAnchorElement>("a[href]").slice(0, 200).forEach(a => {
//     add("link", a, { subtitle: txt(a) });
//   });
//   $all<HTMLButtonElement>("button").slice(0, 200).forEach(b => add("button", b));

//   // Inputs / selects
//   $all<HTMLInputElement>("input").slice(0, 100).forEach(i => add("input", i));
//   $all<HTMLSelectElement>("select").slice(0, 50).forEach(s => add("select", s));
//   $all<HTMLTextAreaElement>("textarea").slice(0, 50).forEach(t => add("textarea", t));

//   // Card-ish elements (heuristic)
//   $all<HTMLElement>('.card,.result,.listing,[role="article"],[role="listitem"]')
//     .slice(0, 100).forEach(c => {
//       const title = (c.querySelector("h3,h2,h1")?.textContent || accName(c) || "").trim();
//       const price = priceFrom(c.textContent || "");
//       const rating = ratingFrom(c.textContent || "");
//       if (title) items.push({ role: "card", title, subtitle: txt(c), selector: uniqueSelector(c), price, rating });
//     });

//   // Attach price/rating for obvious elements
//   for (const it of items) {
//     if (it.price == null) it.price = priceFrom(it.title + " " + (it.subtitle || ""));
//     if (it.rating == null) it.rating = ratingFrom(it.title + " " + (it.subtitle || ""));
//   }

//   // de-dupe by (role+title+href)
//   const seen = new Set<string>();
//   return items.filter(i => {
//     const k = `${i.role}|${i.title}|${i.href ?? i.selector}`;
//     if (seen.has(k)) return false;
//     seen.add(k); return true;
//   });
// }

// function detectDateControls() {
//   const checkIn =
//     document.querySelector<HTMLInputElement>('input[type="date"][name*="in"], input[name*="checkin"]')
//     || document.querySelector<HTMLInputElement>('input[aria-label*="check in" i]');
//   const checkOut =
//     document.querySelector<HTMLInputElement>('input[type="date"][name*="out"], input[name*="checkout"]')
//     || document.querySelector<HTMLInputElement>('input[aria-label*="check out" i]');
//   return {
//     hasDateInputs: !!(checkIn || checkOut),
//     dateSelectors: {
//       checkIn: checkIn ? uniqueSelector(checkIn) : undefined,
//       checkOut: checkOut ? uniqueSelector(checkOut) : undefined
//     }
//   };
// }

// function scanPage(): PageInsights {
//   return {
//     url: location.href,
//     title: document.title,
//     headings: headingTexts(),
//     topText: firstParagraphs(),
//     elements: extractElements(),
//     controls: detectDateControls()
//   };
// }

// /* ------------------------- Executor for Action[] ------------------------- */
// function q<T extends Element>(selector?: string): T | null {
//   if (!selector) return null;
//   return document.querySelector<T>(selector);
// }

// function clickByText(text: string): boolean {
//   const lower = text.trim().toLowerCase();
//   const candidates = $all<HTMLElement>("a,button,[role='button'],input[type='submit']");
//   const el = candidates.find(e => (accName(e) || txt(e)).toLowerCase().includes(lower));
//   if (!el) return false;
//   el.scrollIntoView({ behavior: "smooth", block: "center" }); el.click();
//   return true;
// }

// function setDate(selector: string, valueISO: string): boolean {
//   const el = q<HTMLInputElement>(selector);
//   if (!el) return false;
//   el.focus(); el.value = valueISO;
//   el.dispatchEvent(new Event("input", { bubbles: true }));
//   el.dispatchEvent(new Event("change", { bubbles: true }));
//   return true;
// }

// function typeInto(selector?: string, label?: string, value?: string): boolean {
//   let el: HTMLInputElement | HTMLTextAreaElement | null = null;
//   if (selector) el = q(selector);
//   if (!el && label) {
//     const lowers = label.toLowerCase();
//     const inputs = $all<HTMLInputElement | HTMLTextAreaElement>("input,textarea");
//     el = inputs.find(i => {
//       const nm = (i.name || i.id || i.placeholder || accName(i) || "").toLowerCase();
//       return nm.includes(lowers);
//     }) || null;
//   }
//   if (!el || value == null) return false;
//   el.focus(); (el as any).value = value;
//   el.dispatchEvent(new Event("input", { bubbles: true }));
//   return true;
// }

// function selectOption(selector?: string, label?: string, optionText?: string): boolean {
//   let el: HTMLSelectElement | null = null;
//   if (selector) el = q(selector);
//   if (!el && label) {
//     const lowers = label.toLowerCase();
//     el = $all<HTMLSelectElement>("select").find(s => {
//       const nm = (s.name || s.id || accName(s) || "").toLowerCase();
//       return nm.includes(lowers);
//     }) || null;
//   }
//   if (!el || !optionText) return false;
//   const opt = Array.from(el.options).find(o => o.textContent?.trim().toLowerCase() === optionText.toLowerCase());
//   if (!opt) return false;
//   el.value = opt.value;
//   el.dispatchEvent(new Event("change", { bubbles: true }));
//   return true;
// }

// async function exec(actions: Action[]): Promise<{ ok: boolean }> {
//   for (const a of actions) {
//     switch (a.kind) {
//       case "NAVIGATE":
//         location.href = a.url;
//         return { ok: true }; // navigation ends further actions
//       case "SCROLL":
//         if (a.to === "top") window.scrollTo({ top: 0, behavior: "smooth" });
//         else if (a.to === "bottom") window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
//         else window.scrollBy({ top: (a.amount ?? 0.8) * window.innerHeight, behavior: "smooth" });
//         break;
//       case "CLICK":
//         if (a.selector) q<HTMLElement>(a.selector)?.click();
//         else if (a.text && !clickByText(a.text)) {/* noop */}
//         break;
//       case "TYPE":
//         typeInto(a.selector, a.label, a.value);
//         break;
//       case "SET_DATE":
//         setDate(a.selector, a.valueISO);
//         break;
//       case "SELECT_OPTION":
//         selectOption(a.selector, a.label, a.optionText);
//         break;
//       case "SUBMIT":
//         (a.selector ? q<HTMLFormElement>(a.selector) : document.querySelector("form"))?.requestSubmit?.();
//         break;
//     }
//   }
//   return { ok: true };
// }

// /* ------------------------------ Messaging API ------------------------------ */

// // If you don't already have it, add this line or install chrome-types:
// declare const chrome: any;

// // Narrow message shape so TS can discriminate on `type`
// type IncomingMsg =
//   | { type: "PING" }
//   | { type: "AGENT_SCAN" }
//   | { type: "AGENT_EXECUTE"; actions?: Action[] }
//   | { type: "SUMMARY" }
//   | { type: string; [k: string]: any };

// chrome.runtime.onMessage.addListener((
//   req: IncomingMsg,
//   _sender: chrome.runtime.MessageSender,
//   sendResponse: (response?: any) => void
// ): boolean => {
//   (async () => {
//     try {
//       switch (req?.type) {
//         case "PING": {
//           sendResponse({ ok: true });
//           break;
//         }
//         case "AGENT_SCAN": {
//           const insights = scanPage();
//           sendResponse({ ok: true, insights });
//           break;
//         }
//         case "AGENT_EXECUTE": {
//           const res = await exec(req.actions || []);
//           sendResponse(res); // { ok: boolean }
//           break;
//         }
//         case "SUMMARY": {
//           const text = document.body?.innerText || "";
//           sendResponse({ ok: true, text });
//           break;
//         }
//         default: {
//           sendResponse({ ok: false, error: "Unknown message type" });
//         }
//       }
//     } catch (e: any) {
//       sendResponse({ ok: false, error: e?.message || String(e) });
//     }
//   })();

//   // Tell Chrome we're responding asynchronously.
//   return true;
// });


// src/content/agent.ts
/// <reference types="chrome-types" />
// If you don't use chrome-types, you can `npm i -D @types/chrome` and replace the reference with "chrome".
declare const chrome: typeof globalThis.chrome;

type SendResponse = (response?: any) => void;
// Simple banner so you know the agent injected
console.log("%c[Nano Agent] content script loaded", "color:#10b981");

// Expose a tiny debug hook in the page console:
// > window.__NANO_AGENT__.ping()
;(window as any).__NANO_AGENT__ = { ping: () => "[Nano Agent] pong" };

// --- helpers ---
type ExecResult = { ok: boolean; text?: string };

function scanPage() {
  const headings = Array.from(document.querySelectorAll("h1,h2"))
    .map(h => h.textContent?.trim())
    .filter(Boolean) as string[];

  const links = Array.from(document.links)
    .slice(0, 40)
    .map(a => ({ text: a.textContent?.trim() || a.href, href: a.href }));

  const fields = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea")
  )
    .slice(0, 40)
    .map(el => ({
      placeholder: el.placeholder,
      name: (el as HTMLInputElement).name,
      type: (el as HTMLInputElement).type,
    }));

  return { title: document.title, url: location.href, headings, links, fields };
}

// --- message interface ---
chrome.runtime.onMessage.addListener(
    (req: any, _sender: chrome.runtime.MessageSender, send: SendResponse) => {
      (async () => {
        try {
          if (!req || !req.type) return;
  
          if (req.type === "PING") { send({ ok: true, from: "content-script" }); return; }
  
          if (req.type === "SUMMARY") {
            const text = document.body?.innerText || "";
            send({ ok: true, text });
            return;
          }
  
          if (req.type === "SCROLL") {
            const direction = req.direction === "up" ? -1 : 1;
            const amount = typeof req.amount === "number" ? req.amount : 0.8;
            window.scrollBy({ top: direction * window.innerHeight * amount, behavior: "smooth" });
            send({ ok: true });
            return;
          }
  
          if (req.type === "AGENT_SCAN") {
            send({ ok: true, insights: scanPage() });
            return;
          }
  
          send({ ok: false, error: "unknown message type" });
        } catch (e: any) {
          send({ ok: false, error: e?.message || "agent failed" });
        }
      })();
  
      // IMPORTANT: keep channel open for async `send(...)`
      return true;
    }
  );
  