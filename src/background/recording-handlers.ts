export function handleRecordingMessage(
  msg: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  if (msg.type === "START_RECORDING") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'CONTENT_START_RECORDING',
            name: msg.name
          });
          sendResponse({ ok: true });
        }
      } catch (error: any) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }

  if (msg.type === "STOP_RECORDING") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          const result = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'CONTENT_STOP_RECORDING'
          });
          sendResponse({ ok: true, recording: result });
        }
      } catch (error: any) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }

  if (msg.type === "REPLAY_RECORDING") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'CONTENT_REPLAY_RECORDING',
            recording: msg.recording
          });
          sendResponse({ ok: true });
        }
      } catch (error: any) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }

  return false;
}
