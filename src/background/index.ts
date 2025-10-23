// src/background/index.ts
if (typeof chrome !== "undefined" && chrome?.runtime?.id) {
  chrome.runtime.onInstalled.addListener(() => {
    if (chrome.storage?.local) {
      chrome.storage.local.set({ example: "value" }).then(() => {
        console.log("Storage initialized.");
      });
    }
    if (chrome.sidePanel) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  });

  // 👇 move the listener INSIDE the same guard
  chrome.runtime.onMessage.addListener((
    message: { type: 'getStorage' },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: { example?: string; error?: string }) => void
  ) => {
    if (message.type === 'getStorage') {
      if (chrome.storage?.local) {
        chrome.storage.local.get(['example'], (result) => sendResponse(result));
      } else {
        sendResponse({ error: 'Storage not available' });
      }
      return true; // keep the channel open for async response
    }
  });
}
