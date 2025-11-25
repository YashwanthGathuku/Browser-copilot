# Nano Assistant - AI Coding Agent Instructions

## Project Overview
Chrome Extension (Manifest V3) combining on-device AI (Chrome Prompt API/Gemini Nano), voice commands (Web Speech API), and intelligent browser automation. React 19 + TypeScript + Vite with Tailwind CSS 4.

## Architecture & Data Flow

### Core Communication Pattern
```
User Voice → startASR() → inferIntentDeterministic() → handleText()
                                                             ↓
                                              isPanelIntent? ─┬─ Yes → executeIntent() → sendToContent()
                                                              └─ No → ensureSession() → LLM chat
                                                                           ↓
                                                               voiceModeActive? → speakResponse()
```

### Three-Script Architecture
1. **Sidepanel** (`src/sidepanel/App.tsx`) - Main UI, voice recognition, LLM session management, message orchestration
2. **Content Script** (`src/content/index.ts`, `agent.ts`) - Page interaction, DOM manipulation, runs in webpage context
3. **Background** (`src/background/index.ts`) - Extension lifecycle, storage (minimal role)

**Critical**: Content scripts cannot access Chrome Prompt API. LLM processing happens only in sidepanel. Content scripts receive structured commands via `chrome.tabs.sendMessage()`.

## Key Development Patterns

### Voice Mode Implementation
When `voiceModeActive` is true (set by clicking Voice button), ALL assistant responses are automatically spoken:
```typescript
const speakResponse = (text: string) => {
  if (voiceModeActive && text && text.trim()) {
    ttsService.speak(text, "normal");
  }
};
```
Call `speakResponse()` after EVERY `setMessages()` that adds assistant responses. See `handleText()` (lines 540-625) for integration points.

### State Management Convention
- Use `useRef` for non-UI state that shouldn't trigger re-renders: `sessionRef`, `recRef`, `processingRef`
- Use `useState` for UI state: `messages`, `busy`, `status`, `voiceModeActive`
- **Never** store Chrome API objects in state - they're not serializable

### Message Flow Pattern
```typescript
// User input
const uid = crypto.randomUUID(); const aid = crypto.randomUUID();
setMessages(m => [...m, 
  { id: uid, role: "user", text, ts: Date.now() },
  { id: aid, role: "assistant", text: "…", ts: Date.now() }
]);

// Update assistant response
const responseText = await processQuery();
setMessages(m => m.map(msg => 
  msg.id === aid ? { ...msg, text: responseText } : msg
));
speakResponse(responseText); // REQUIRED for voice mode
```

### Intent System Architecture
**Deterministic parsing** in `intent-engine.ts` - NO LLM calls:
- Simple commands: `"scroll down"` → `{ type: "SCROLL", direction: "down" }`
- Multi-step detection: `"book hotel in NYC from Dec 1-5"` → `{ type: "PLAN_TASK", goal: "..." }`
- Fallback: Unknown input → `null` → routes to LLM chat

**Task Planning** (complex goals): `task-planner.ts` breaks multi-step goals into executable task chains with dependencies.

### LLM Session Management
```typescript
async function ensureSession() {
  if (sessionRef.current) return sessionRef.current;
  
  // Check availability FIRST
  const availability = await lm.capabilities?.();
  if (availability?.available === 'no') {
    // Show requirements + action button
    throw new Error("Model not available");
  }
  
  // Auto-trigger download if needed
  if (availability?.available === 'after-download') {
    const downloadMsgId = crypto.randomUUID();
    // Show download message
    const s = await lm.create({ languageCode: lang2 }); // Triggers download
    // Update message to "Downloaded!"
    return s;
  }
  
  const s = await lm.create({ languageCode: lang2 });
  return s;
}
```
**Critical**: Always check model availability before creating sessions. The 22GB model downloads automatically on first `lm.create()` call.

### TTS Service Pattern
Singleton service (`tts-service.ts`) with event-driven architecture:
```typescript
// Speaking
ttsService.speak(text, priority); // priority: "high" | "normal" | "low"

// Listening to events (in components)
ttsService.on('speaking-start', handler);
ttsService.on('speaking-end', handler);
// ... always clean up in useEffect return
```

VoiceFeedback component subscribes to 7 TTS events for real-time UI updates. See comprehensive logging pattern in `VoiceFeedback.tsx`.

## Project-Specific Conventions

### Theme Handling
Detect system theme: `window.matchMedia('(prefers-color-scheme: dark)').matches`
- Idle backgrounds: Use `transparent` to blend with panel
- Border colors: `rgba(255,255,255,0.04)` (dark) vs `rgba(0,0,0,0.04)` (light)
- Text colors: `#e5e7eb` (dark) vs `#212529` (light)

### Responsive Sizing
Side panel constraints: `w-full max-w-[420px] h-full max-h-[90vh]`
- Use fluid widths (`100%`) with max constraints, not fixed pixel values
- Min heights for interactive elements: `48px` (was `56px` - reduced for compactness)

### Action Buttons in Messages
```typescript
type Msg = {
  // ... other fields
  action?: { label: string; onClick: () => void };
};

// Usage
setMessages(m => [...m, {
  text: "⚠️ Error message",
  action: { 
    label: "📊 Check Diagnostics", 
    onClick: () => chrome.tabs.create({ url: 'chrome://...' })
  }
}]);
```
Bubble component automatically renders buttons. Use for: model errors, download progress, diagnostics links.

### Logging Strategy
Comprehensive console logging at strategic points:
```typescript
const logRender = (...args: unknown[]) => {
  console.log(...args);
  return null;
};
// Use in JSX: {logRender('[Component] Event:', data)}
```
Log: lifecycle events, TTS events, state changes, user interactions, render cycles. See `VoiceFeedback.tsx` for reference (8 logging points).

## Build & Development

### Commands
```bash
npm run dev         # Development with HMR (port 5173)
npm run dev:stable  # Reduced reload frequency (for testing)
npm run build       # Production build to dist/
```

### Loading Extension
1. Build project: `npm run dev` or `npm run build`
2. Chrome → `chrome://extensions/`
3. Enable "Developer mode"
4. "Load unpacked" → select project root (not `dist/`)
5. The `@crxjs/vite-plugin` automatically uses `manifest.config.ts`

### HMR Stability
- Vite config uses polling disabled, 2s intervals to prevent rapid reloads
- Sourcemaps disabled in dev for performance
- Changes to content scripts require manual extension reload (Chrome limitation)

## Chrome API Patterns

### Content Script Messaging
```typescript
// From sidepanel
const tab = await chrome.tabs.query({ currentWindow: true, active: true });
await chrome.tabs.sendMessage(tab[0].id, { type: "SCROLL", direction: "down" });

// In content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SCROLL") {
    // Execute action
    sendResponse({ ok: true, text: "Scrolled" });
  }
  return true; // REQUIRED for async responses
});
```

### Storage API
```typescript
// Save
await chrome.storage.local.set({ key: value });
// Read
const result = await chrome.storage.local.get('key');
```

## Critical Files Reference

- **`src/sidepanel/App.tsx`** (840 lines) - Core orchestration, voice mode, LLM integration, message flow
- **`src/common/intent-engine.ts`** - Deterministic voice→intent parsing, multi-step detection
- **`src/common/tts-service.ts`** (363 lines) - TTS singleton with priority queue, event system
- **`src/common/task-planner.ts`** - Multi-step task chain generation and execution
- **`src/content/agent.ts`** - Advanced page analysis (scanPage, element detection)
- **`manifest.config.ts`** - Extension manifest, permissions, content script injection

## Common Pitfalls

1. **Forgetting to call `speakResponse()` after adding messages** - Voice mode breaks
2. **Using `useState` for Chrome API refs** - Serialization errors
3. **Not checking `isContentEligible(url)`** - Messages fail on chrome:// pages
4. **Forgetting `return true` in message listeners** - Async responses break
5. **Not cleaning up TTS event listeners** - Memory leaks
6. **Hardcoding theme colors** - Dark mode breaks
7. **Fixed widths/heights** - Responsiveness breaks

## Testing Workflow

1. Make changes to sidepanel code → HMR auto-reloads
2. Changes to content scripts → Manual extension reload required
3. Test voice: Click "Voice" button → speak command → verify TTS response
4. Test model: Check startup messages for download/availability status
5. Check console for comprehensive logs (all actions logged)

## Future Enhancements Context

Task automation system (`task-planner.ts`, `TaskProgress.tsx`) partially implemented:
- Task chain generation works
- UI shows task progress
- Missing: Visual feedback on web page, agent orchestrator, specialized agents (FormFiller, JobApplication, etc.)
- See todo items in conversation for complete list
