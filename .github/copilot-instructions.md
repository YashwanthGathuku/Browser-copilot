# Browser Copilot (Nano Assistant) - Copilot Instructions

## Project Overview

Browser Copilot (Nano Assistant) is a sophisticated Chrome extension that provides an AI-powered voice assistant for browser automation and interaction. The extension combines on-device AI processing with intelligent page analysis and voice command execution.

**Key Features:**
- Voice-controlled browser automation
- On-device AI chat using Chrome's Prompt API
- Multi-language support (English, Spanish, Japanese)
- Intelligent page interaction and analysis
- Real-time command processing

## Tech Stack

### Core Technologies
- **React 19**: Latest React with SWC compilation for fast refresh
- **TypeScript**: Full type safety across all components
- **Vite**: Build tool with HMR (Hot Module Replacement)
- **Tailwind CSS 4**: Utility-first styling framework
- **Chrome Extension Manifest V3**: Modern extension architecture

### Key Dependencies
- `@crxjs/vite-plugin`: Chrome extension development with Vite
- `chrome-types`: Chrome API type definitions
- `clsx`: Conditional CSS class utility
- `rolldown-vite`: Fast bundling (Vite replacement using Rolldown bundler)

### Development Tools
- ESLint with TypeScript support
- Prettier for code formatting
- Web Speech API for voice recognition
- Chrome Prompt API for on-device AI

## Project Structure

```
src/
├── sidepanel/          # Main UI (React application)
│   ├── App.tsx        # Main component with voice/AI features
│   ├── main.tsx       # React entry point
│   └── panel.html     # HTML template
├── content/           # Content scripts injected into web pages
│   ├── index.ts       # Basic page interaction handler
│   └── agent.ts       # Advanced page analysis
├── background/        # Service worker for extension lifecycle
│   └── index.ts       # Extension lifecycle management
├── common/            # Shared utilities
│   ├── actions.ts     # Reusable page interaction functions
│   ├── intent-engine.ts # Voice command NLP processing
│   ├── intents.ts     # Intent type definitions
│   ├── xpath.ts       # XPath utilities for element selection
│   ├── visual-feedback.ts # User feedback helpers
│   └── agent.ts       # Agent coordination utilities
└── types/             # TypeScript definitions
    ├── web-speech.d.ts # Web Speech API types
    ├── prompt-api.d.ts # Chrome Prompt API types
    └── agent-types.ts  # Advanced agent types
```

## Architecture

### Component Communication
- **Sidepanel ↔ Content Scripts**: Chrome runtime messaging
- **Content Scripts ↔ Background**: Chrome runtime messaging
- **Voice Input → Intent Engine → Action Execution**: Unidirectional data flow

### Key Modules

1. **Voice Command Agent** (`src/sidepanel/App.tsx`)
   - Processes voice input using Web Speech API
   - Converts speech to structured intents
   - Supports continuous recognition

2. **Intent Engine** (`src/common/intent-engine.ts`)
   - Deterministic natural language processing
   - Parses commands into structured actions
   - Supports: scroll, navigation, search, form filling, clicking

3. **Page Analysis Agent** (`src/content/agent.ts`)
   - Scans page structure
   - Extracts actionable elements (links, buttons, forms)
   - Provides page insights for AI decision-making

4. **Action Execution** (`src/common/actions.ts`)
   - DOM manipulation utilities
   - Form interaction helpers
   - Navigation and scroll control

5. **AI Assistant** (`src/sidepanel/App.tsx`)
   - On-device language model using Chrome Prompt API
   - Streaming responses for real-time feedback
   - Multi-language session management

## Coding Guidelines

### TypeScript
- Always use TypeScript with strict type checking
- Define types for all function parameters and return values
- Use interfaces for complex objects
- Prefer `type` for unions and intersections
- Place type definitions in `src/types/` for reusability

### React
- Use functional components with hooks
- Prefer `useState`, `useEffect`, `useMemo`, `useRef`
- Use `clsx` for conditional CSS classes
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks

### Naming Conventions
- **Files**: kebab-case for files (e.g., `intent-engine.ts`)
- **Components**: PascalCase for React components (e.g., `App.tsx`)
- **Functions**: camelCase for functions and variables
- **Types**: PascalCase for types and interfaces
- **Constants**: UPPER_SNAKE_CASE for constants

### Chrome Extension Specific
- Use Chrome APIs through proper type definitions
- Always handle runtime message errors
- Test content scripts in isolated contexts
- Use manifest V3 patterns (service workers, not background pages)
- Request minimal permissions necessary

### Error Handling
- Always wrap Chrome API calls in try-catch
- Provide user-friendly error messages
- Log errors for debugging but don't expose internals
- Handle missing APIs gracefully (e.g., Prompt API availability)

### Code Style
- Use double quotes for string literals (as per existing codebase)
- Use semicolons consistently
- Arrow functions for callbacks and functional components
- Follow ESLint configuration (see `eslint.config.js`):
  - TypeScript ESLint recommended rules
  - React Hooks recommended rules
  - React Refresh rules for Vite HMR

## Testing & Validation

### Development Workflow
```bash
npm install          # Install dependencies
npm run dev          # Start development server with HMR
npm run lint         # Run ESLint
npm run build        # Production build
npm run preview      # Preview production build
```

Note: The vite.config.ts includes stability settings (increased watch intervals, build delays) to prevent frequent reloads during development.

### Testing the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the project root directory
5. Test voice commands on any webpage
6. Check console for errors in both:
   - Extension service worker
   - Content script context
   - Side panel context

### Voice Commands to Test
- "scroll up" / "scroll down"
- "open [website]"
- "search [query]"
- "click [element]"
- "fill [field]=[value]"
- "summarize"

### Building
- Build creates optimized extension in `dist/` directory
- Source maps are disabled by default for production
- Build target is Chrome 120+ (see vite.config.ts `build.target`)

## Common Patterns

### Sending Messages to Content Scripts
```typescript
await chrome.tabs.sendMessage(tabId, {
  type: 'COMMAND_TYPE',
  payload: { /* data */ }
});
```

### Handling Messages in Content Scripts
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'COMMAND_TYPE') {
    // Handle command
    sendResponse({ success: true });
  }
  return true; // Keep channel open for async response
});
```

### Using the Intent Engine
```typescript
import { inferIntentDeterministic } from './common/intent-engine';

const intent = inferIntentDeterministic("scroll down");
// Returns: { type: 'SCROLL', params: { direction: 'down', amount: 300 } }
```

### XPath Element Selection
```typescript
import { getElementByXPath } from './common/xpath';

const element = getElementByXPath("//button[contains(text(), 'Submit')]");
```

## Resources & References

### Documentation
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Prompt API](https://developer.chrome.com/docs/ai/built-in-apis)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

### Extension Permissions
Required Chrome permissions:
- `sidePanel`: Main UI interface
- `tabs`: Tab management
- `activeTab`: Access to current tab
- `offscreen`: Background processing
- `storage`: Data persistence
- `<all_urls>`: Content script injection

## Development Tips

### Hot Module Replacement (HMR)
- Content scripts do NOT support HMR - requires manual reload
- Side panel supports HMR for React components
- Service worker requires extension reload on changes

### Debugging
- **Side Panel**: Open DevTools from the side panel
- **Content Script**: Inspect page → Console (filter by extension ID)
- **Service Worker**: chrome://extensions → Service Worker → Console

### Performance Considerations
- Voice recognition runs continuously - manage resource usage
- Chrome Prompt API sessions should be reused when possible
- Debounce frequent operations (e.g., scroll events)
- Use streaming for AI responses to improve perceived performance

### Common Pitfalls
- Content scripts run in isolated world - no access to page's JavaScript
- Service workers are ephemeral - don't rely on global state
- Always check API availability before use (Prompt API may not be available)
- XPath queries can break with page updates - prefer robust selectors

## AI Integration

### Chrome Prompt API Usage
The extension uses Chrome's experimental Prompt API for on-device AI:
- Check availability with `window.ai?.canCreateTextSession()`
- Create sessions for language-specific processing
- Use streaming for better UX: `session.promptStreaming()`
- Handle API unavailability gracefully

### Intent Recognition
- Deterministic pattern matching for commands
- Fallback to AI chat for non-command inputs
- Support for natural language variations
- Multi-language intent recognition

## Best Practices for Contributors

1. **Keep changes minimal and focused** - One feature/fix per PR
2. **Test in multiple scenarios** - Different websites, languages, edge cases
3. **Document new intents** - Update intent engine with new command patterns
4. **Maintain type safety** - No `any` types without justification
5. **Follow existing patterns** - Consistency with current architecture
6. **Consider accessibility** - Voice commands should be clear and predictable
7. **Handle errors gracefully** - Extension should never crash the browser
8. **Respect user privacy** - All AI processing is on-device
