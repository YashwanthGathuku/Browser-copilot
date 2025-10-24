// src/content/index.ts
import type { Action } from "../types/agent-types";
import { executeAction, scanPage } from "./agent"; // your content helpers

import DOMPurify from "dompurify";

type ContentMsg =
  | { type: "PING" }
  | { type: "SCROLL"; amount?: number; direction?: "up" | "down" }
  | { type: "OPEN_URL"; url: string }
  | { type: "SEARCH_WEB"; query: string }
  | { type: "SUMMARY" }
  | { type: "CLICK_LABEL"; label: string }
  | { type: "CLICK_SELECTOR"; selector: string }
  | { type: "FILL_FIELD"; label?: string; value: string; selector?: string }
  | { type: "SET_DATE"; selector: string; valueISO: string }
  | { type: "SELECT_OPTION"; selector: string; optionText: string }
  | { type: "SUBMIT"; selector?: string }
  | { type: "DEMO" };

type SendResponse = (response?: unknown) => void;

const $all = <T extends Element = Element>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

const textOf = (el?: Element | null) => (el?.textContent || "").replace(/\s+/g, " ").trim();

function findByText(label: string): HTMLElement | null {
  const lower = label.toLowerCase();
  const candidates = $all<HTMLElement>("a,button,input,[role='button'],span");
  for (const el of candidates) {
    const t = (el.getAttribute("aria-label") || el.getAttribute("title") || textOf(el)).toLowerCase();
    if (t.includes(lower)) return el;
  }
  return null;
}

chrome.runtime.onMessage.addListener((req: ContentMsg, _sender: chrome.runtime.MessageSender, send: SendResponse) => {
  (async () => {
    if (req.type === "PING") {
      send({ ok: true, ctx: "content" });
      return;
    }

    if (req.type === "SCROLL") {
      const amount = (req.amount ?? 0.8) * window.innerHeight * (req.direction === "up" ? -1 : 1);
      window.scrollBy({ top: amount, behavior: "smooth" });
      send({ ok: true });
      return;
    }

    if (req.type === "OPEN_URL") {
      location.href = DOMPurify.sanitize(req.url);
      return;
    }

    if (req.type === "SEARCH_WEB") {
      const q = DOMPurify.sanitize(req.query);
      location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      return;
    }

    if (req.type === "SUMMARY") {
      const text = document.body ? document.body.innerText || "" : "";
      send({ ok: true, text });
      return;
    }

    if (req.type === "CLICK_LABEL") {
      const el = findByText(req.label);
      if (el) { el.click(); send({ ok: true }); }
      else send({ ok: false, error: "not found" });
      return;
    }

    if (req.type === "CLICK_SELECTOR") {
      const el = document.querySelector(req.selector) as HTMLElement | null;
      if (el) { el.click(); send({ ok: true }); }
      else send({ ok: false, error: "not found" });
      return;
    }

    if (req.type === "FILL_FIELD") {
      const val = DOMPurify.sanitize(req.value);
      let input: HTMLInputElement | HTMLTextAreaElement | null = null;

      if (req.selector) {
        input = document.querySelector(req.selector) as any;
      } else if (req.label) {
        const all = $all<HTMLInputElement | HTMLTextAreaElement>("input,textarea");
        input = all.find((i) => {
          const lbl = i.id ? document.querySelector(`label[for="${i.id}"]`) : null;
          const name = ((lbl?.textContent || i.placeholder || "").toLowerCase());
          return name.includes(req.label!.toLowerCase());
        }) ?? null;
      }

      if (input) {
        input.focus();
        (input as any).value = val;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        send({ ok: true });
      } else send({ ok: false, error: "no input" });
      return;
    }

    if (req.type === "SET_DATE") {
      const el = document.querySelector(req.selector) as HTMLInputElement | null;
      if (el) {
        el.value = req.valueISO;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        send({ ok: true });
      } else send({ ok: false });
      return;
    }

    if (req.type === "SELECT_OPTION") {
      const sel = document.querySelector(req.selector) as HTMLSelectElement | null;
      if (sel) {
        const opt = Array.from(sel.options).find(o => o.textContent?.trim().toLowerCase() === req.optionText.toLowerCase());
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          send({ ok: true });
        } else send({ ok: false, error: "option not found" });
      } else send({ ok: false });
      return;
    }

    if (req.type === "SUBMIT") {
      const form = (req.selector ? document.querySelector(req.selector) : document.querySelector("form")) as HTMLFormElement | null;
      if (form) { form.requestSubmit(); send({ ok: true }); }
      else send({ ok: false });
      return;
    }

    if (req.type === "DEMO") {
      // simple visual cue
      document.body.style.outline = "2px solid #60a5fa";
      setTimeout(() => (document.body.style.outline = ""), 1500);
      send({ ok: true });
      return;
    }
  })();

  return true; // async
});

chrome.runtime.onMessage.addListener((
  req: { type: string; actions?: Action[] },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (res?: unknown) => void
) => {
  (async () => {
    if (req.type === "AGENT_EXECUTE" && Array.isArray(req.actions)) {
      for (const a of req.actions) {
        const r = await executeAction(a);
        if (!r.ok) { sendResponse({ ok: false }); return; }
      }
      // optional: re-scan to get new insights
      const insights = scanPage();
      sendResponse({ ok: true, insights });
      return;
    }
  })();
  return true; // keep channel open
});
