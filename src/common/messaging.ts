/**
 * Messaging utility - Single source of truth for Chrome message passing
 * Reduces code duplication across components
 */

type MessageType = 
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'REPLAY_RECORDING'
  | 'CAPTURE_SCREENSHOT'
  | 'AGENTS_CREATE'
  | 'AGENTS_LIST'
  | 'TASK_SCHEDULE'
  | 'TASK_LIST';

interface MessagePayload {
  type: MessageType;
  [key: string]: any;
}

/**
 * Send message to background script
 */
export async function sendToBackground<T = any>(payload: MessagePayload): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send message to active tab's content script
 */
export async function sendToContent<T = any>(payload: MessagePayload): Promise<T> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab?.id) {
    throw new Error('No active tab found');
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id!, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}
