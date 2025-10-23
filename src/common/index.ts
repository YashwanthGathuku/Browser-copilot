import {
  scroll, openUrl, searchWeb, extractText, clickByLabel, fillByLabel,
} from "./actions";

// Important: content script listener. Return `true` to keep the channel open.
chrome.runtime.onMessage.addListener((req: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  (async () => {
    try {
      switch (req.type) {
        case "SCROLL":
          scroll(req.direction, req.amount);
          return sendResponse({ ok: true });

        case "OPEN_URL":
          openUrl(req.url);
          return; // navigation, no response

        case "SEARCH_WEB":
          searchWeb(req.query);
          return;

        case "SUMMARY":
          return sendResponse({ ok: true, text: extractText() });

        case "CLICK_LABEL":
          return sendResponse({ ok: clickByLabel(req.label) });

        case "FILL_FIELD":
          return sendResponse({ ok: fillByLabel(req.label, req.value) });

        default:
          return sendResponse({ ok: false, error: "Unknown intent" });
      }
    } catch (e: any) {
      return sendResponse({ ok: false, error: e?.message || "error" });
    }
  })();
  return true; // keep the message channel open for the async IIFE
});
