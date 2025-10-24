// src/content/index.ts
import { escapeForXPath } from "../common/xpath";

export { escapeForXPath } from "../common/xpath";

// Define message interface for content script communication
interface ContentScriptMessage {
  type?: "PING" | "SCROLL" | "OPEN_URL" | "SEARCH_WEB" | "SUMMARY" | "CLICK_LABEL" | "FILL_FIELD";
  command?: "scroll:down" | "scroll:up" | "page:text" | string;
  direction?: "up" | "down";
  amount?: number;
  url?: string;
  query?: string;
  label?: string;
  value?: string;
  [key: string]: any;
}

interface PageTextResponse {
  text: string;
}

interface MessageSender {
  id?: string;
  tab?: { id?: number } | null;
  url?: string;
  frameId?: number;
  origin?: string;
  [key: string]: any;
}

type SendResponse = (response?: unknown) => void;

// Handle messages from background or side panel
chrome.runtime.onMessage.addListener(
  (req: ContentScriptMessage, sender: MessageSender, sendResponse: SendResponse) => {
    if (!req) return;
    if (req?.type === "PING") {
      sendResponse({ ok: true, ctx: "content" });
      return true;
    }

    // Handle new voice command format
    if (req.type === "SCROLL") {
      const direction = req.direction || "down";
      const amount = req.amount || 0.8;
      window.scrollBy({ 
        top: (direction === "down" ? 1 : -1) * window.innerHeight * amount, 
        behavior: "smooth" 
      });
      sendResponse({ ok: true });
      return true;
    }

    if (req.type === "OPEN_URL" && req.url) {
      window.location.href = req.url;
      return; // No response for navigation
    }

    if (req.type === "SEARCH_WEB" && req.query) {
      window.location.href = "https://www.google.com/search?q=" + encodeURIComponent(req.query);
      return; // No response for navigation
    }

    if (req.type === "SUMMARY") {
      const text = document.body ? document.body.innerText || "" : "";
      sendResponse({ ok: true, text });
      return true;
    }

    if (req.type === "CLICK_LABEL" && req.label) {
      const normalizedLabel = req.label.toLowerCase();
      const xp = `//*[self::button or self::a or self::input or self::span]
                  [contains(translate(normalize-space(.),
                  'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),
                  '${escapeForXPath(normalizedLabel)}')]`;
      const el = document.evaluate(
        xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
      ).singleNodeValue as HTMLElement | null;

      if (el) { 
        el.click(); 
        sendResponse({ ok: true }); 
      } else {
        sendResponse({ ok: false });
      }
      return true;
    }

    if (req.type === "FILL_FIELD" && req.label && req.value) {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea")
      );
      const target = inputs.find(i => {
        const lbl = i.id ? document.querySelector(`label[for="${i.id}"]`) : null;
        const text = (lbl?.textContent || i.placeholder || "").toLowerCase();
        return text.includes(req.label!.toLowerCase());
      });
      if (target) {
        target.focus();
        (target as any).value = req.value;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
      return true;
    }

    // Handle legacy command format for backward compatibility
    if (req.command === "scroll:down") {
      window.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" });
    }
    if (req.command === "scroll:up") {
      window.scrollBy({ top: -window.innerHeight * 0.8, behavior: "smooth" });
    }

    if (req.command === "page:text") {
      const text = document.body ? document.body.innerText || "" : "";
      sendResponse({ text } as PageTextResponse);
      return true; // Indicates async response
    }
  }
);