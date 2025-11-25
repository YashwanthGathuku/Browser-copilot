/**
 * Content script message handler - Single responsibility
 * Handles all recording-related messages
 */
import { recorder, ActionRecorder } from './action-recorder';
import { createAgent } from './enhanced-agent';

chrome.runtime.onMessage.addListener((msg: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  // Recording start
  if (msg.type === 'CONTENT_START_RECORDING') {
    recorder.startRecording(msg.name || 'Recording');
    sendResponse({ ok: true });
    return true;
  }

  // Recording stop
  if (msg.type === 'CONTENT_STOP_RECORDING') {
    const recording = recorder.stopRecording();
    sendResponse(recording);
    return true;
  }

  // Recording replay
  if (msg.type === 'CONTENT_REPLAY_RECORDING') {
    (async () => {
      try {
        const agent = createAgent();
        await ActionRecorder.replay(msg.recording, agent);
        sendResponse({ ok: true });
      } catch (error: any) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }
});
