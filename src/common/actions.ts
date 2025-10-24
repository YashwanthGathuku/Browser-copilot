// Helpers the content script can perform in the page
import { escapeForXPath } from "./xpath";

export function scroll(direction: "up" | "down", amount = 0.8) {
  window.scrollBy({
    top: (direction === "down" ? 1 : -1) * window.innerHeight * amount,
    behavior: "smooth",
  });
}

export function openUrl(url: string) {
  location.href = url;
}

export function searchWeb(query: string) {
  location.href = "https://www.google.com/search?q=" + encodeURIComponent(query);
}

export function extractText(): string {
  return document.body?.innerText ?? "";
}

export function clickByLabel(label: string): boolean {
  const normalizedLabel = label.toLowerCase();
  const xp = `//*[self::button or self::a or self::input or self::span]
              [contains(translate(normalize-space(.),
              'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),
              '${escapeForXPath(normalizedLabel)}')]`;
  const el = document.evaluate(
    xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
  ).singleNodeValue as HTMLElement | null;

  if (el) { el.click(); return true; }
  return false;
}

export function fillByLabel(label: string, value: string): boolean {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea")
  );
  const target = inputs.find(i => {
    const lbl = i.id ? document.querySelector(`label[for="${i.id}"]`) : null;
    const text = (lbl?.textContent || i.placeholder || "").toLowerCase();
    return text.includes(label.toLowerCase());
  });
  if (target) {
    target.focus();
    (target as any).value = value;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  return false;
}
