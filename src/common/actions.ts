// src/common/actions.ts
import { escapeForXPath } from "./xpath";
import { visualFeedback } from "./visual-feedback";
import DOMPurify from 'dompurify'; // Added for XSS safety

export function scroll(direction: "up" | "down", amount = 0.8) {
  window.scrollBy({
    top: (direction === "down" ? 1 : -1) * window.innerHeight * amount,
    behavior: "smooth",
  });
  visualFeedback.showFeedback({
    type: 'scroll',
    message: `Scrolling ${direction} ${Math.round(amount * 100)}%`,
    duration: 1000
  });
}

export function openUrl(url: string) {
  location.href = DOMPurify.sanitize(url); // Prevent XSS in URL
  visualFeedback.showFeedback({
    type: 'navigate',
    message: `Opening URL: ${url}`,
    duration: 1500
  });
}

export function searchWeb(query: string) {
  const sanitizedQuery = DOMPurify.sanitize(query); // Prevent XSS
  location.href = `https://www.google.com/search?q=${encodeURIComponent(sanitizedQuery)}`;
  visualFeedback.showFeedback({
    type: 'search',
    message: `Searching for: ${sanitizedQuery}`,
    duration: 1500
  });
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

  if (el) {
    el.click();
    visualFeedback.showFeedback({
      type: 'click',
      element: el,
      message: `Clicked: ${label}`,
      duration: 2000
    });
    return true;
  }
  visualFeedback.showFeedback({
    type: 'highlight',
    message: `No element found for: ${label}`,
    duration: 2000
  });
  return false;
}

export function fillByLabel(label: string, value: string): boolean {
  const sanitizedValue = DOMPurify.sanitize(value); // Prevent XSS
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
    (target as HTMLInputElement).value = sanitizedValue; // Type assertion
    target.dispatchEvent(new Event("input", { bubbles: true }));
    visualFeedback.showFeedback({
      type: 'fill',
      element: target,
      message: `Filled: ${label} with ${sanitizedValue}`,
      duration: 2000
    });
    return true;
  }
  visualFeedback.showFeedback({
    type: 'highlight',
    message: `No field found for: ${label}`,
    duration: 2000
  });
  return false;
}