# Browser-copilot (Nano Assistant)

A sophisticated Chrome extension that provides an AI-powered voice assistant for browser automation and interaction. The extension combines on-device AI processing with intelligent page analysis and voice command execution.

## 🚀 Features

- **🎤 Voice Commands**: Control browser actions through natural speech recognition
- **🤖 AI Chat**: On-device AI assistant using Chrome's Prompt API
- **🌍 Multi-language Support**: English, Spanish, and Japanese
- **🖱️ Page Interaction**: Scroll, click, fill forms, and navigate
- **📄 Content Analysis**: Page summarization and intelligent text extraction
- **🔍 Page Scanning**: Advanced element detection and interaction
- **⚡ Real-time Processing**: Streaming AI responses and instant command execution

## 🏗️ Architecture Overview

The extension follows a modular architecture with clear separation of concerns:

```
src/
├── sidepanel/          # Main UI (React app)
├── content/            # Page interaction scripts
├── background/         # Service worker
├── common/             # Shared utilities and types
└── types/              # TypeScript definitions
```

## 🧩 Core Components

### 1. Sidepanel Application (`src/sidepanel/`)

**Main Entry Point**: `src/sidepanel/main.tsx`
- Renders the React application using `createRoot`
- Imports shared styles from `../index.css`

**Main App Component**: `src/sidepanel/App.tsx`
- **Imports**:
  - `React` hooks: `useEffect`, `useMemo`, `useRef`, `useState`
  - `clsx` for conditional CSS classes
  - `inferIntentDeterministic` from intent engine
  - `Intent` type definitions
- **Key Functions**:
  - `processVoiceCommand()`: Processes voice input using intent engine
  - `sendMessageToContentScript()`: Communicates with content scripts
  - `startASR()`: Initializes Web Speech API
  - `ensureSession()`: Manages AI model sessions
- **State Management**:
  - Messages array for chat history
  - Voice recognition state
  - AI session management
  - Language selection (EN/ES/JA)

### 2. Content Scripts (`src/content/`)

#### Main Content Script (`src/content/index.ts`)
**Purpose**: Handles basic page interactions and message routing

**Imports**: None (standalone script)

**Key Functions**:
- Message listener for Chrome runtime communication
- Handles voice command execution
- Supports legacy command format for backward compatibility

**Message Types Handled**:
- `SCROLL`: Page scrolling with direction and amount
- `OPEN_URL`: Navigation to URLs
- `SEARCH_WEB`: Google search execution
- `SUMMARY`: Page text extraction
- `CLICK_LABEL`: Element clicking by label
- `FILL_FIELD`: Form field filling

#### Advanced Agent (`src/content/agent.ts`)
**Purpose**: Advanced page analysis and intelligent interaction

**Key Features**:
- **Page Scanning**: `scanPage()` function extracts:
  - Page headings (h1, h2)
  - Links with text and URLs
  - Form fields with placeholders and types
  - Page metadata (title, URL)
- **Debug Interface**: Exposes `window.__NANO_AGENT__` for testing
- **Message Handling**: Supports `PING`, `AGENT_SCAN`, `SUMMARY`, `SCROLL`

**Commented Advanced Features** (currently disabled):
- Element descriptor extraction
- Price and rating detection
- Date control detection
- Advanced action execution (CLICK, TYPE, SELECT_OPTION, etc.)

### 3. Background Service Worker (`src/background/index.ts`)

**Purpose**: Extension lifecycle management and storage

**Key Functions**:
- `onInstalled` listener for extension setup
- Storage initialization
- Side panel behavior configuration
- Message handling for storage operations

**Imports**: Chrome APIs (runtime, storage, sidePanel)

### 4. Common Utilities (`src/common/`)

#### Actions (`src/common/actions.ts`)
**Purpose**: Reusable page interaction functions

**Exported Functions**:
- `scroll(direction, amount)`: Smooth page scrolling
- `openUrl(url)`: Navigate to URL
- `searchWeb(query)`: Execute Google search
- `extractText()`: Get page text content
- `clickByLabel(label)`: Click elements by text label using XPath
- `fillByLabel(label, value)`: Fill form fields by label

#### Intent Engine (`src/common/intent-engine.ts`)
**Purpose**: Natural language processing for voice commands

**Imports**: `Intent` type from `./intents`

**Key Function**:
- `inferIntentDeterministic(text)`: Parses voice input and returns structured intents

**Supported Intents**:
- `SCROLL`: "scroll up/down"
- `OPEN_URL`: "open [url]"
- `SEARCH_WEB`: "search [query]" or "open [query]"
- `SUMMARY`: "summarize", "summary", "tl;dr"
- `FILL_FIELD`: "fill [field]=[value]"
- `CLICK_LABEL`: "click [element]"

#### Intent Types (`src/common/intents.ts`)
**Purpose**: TypeScript definitions for intent system

**Exported Types**:
- `IntentType`: Union of all supported intent types
- `Intent`: Structured intent objects with parameters
- `IntentResult`: Response format for intent execution

#### Agent Types (`src/types/agent-types.ts`)
**Purpose**: Advanced type definitions for page analysis

**Exported Types**:
- `ElementRole`: Types of page elements (link, button, input, etc.)
- `ElementDescriptor`: Detailed element information
- `PageInsights`: Complete page analysis data
- `Action`: Atomic actions for page interaction
- `AgentPlan`: Structured plans with suggestions and actions

### 5. Type Definitions (`src/types/`)

#### Web Speech API (`src/types/web-speech.d.ts`)
**Purpose**: TypeScript definitions for Web Speech API

**Defines**:
- `SpeechRecognitionAlternative`
- `SpeechRecognitionResult`
- `SpeechRecognitionEvent`
- `ISpeechRecognition` interface
- Global window extensions

## 🤖 Agent System

The extension implements a sophisticated agent system with multiple layers:

### 1. Voice Command Agent
- **Location**: `src/sidepanel/App.tsx`
- **Purpose**: Processes voice input and converts to structured intents
- **Technology**: Web Speech API + Intent Engine
- **Capabilities**: Real-time voice recognition with multi-language support

### 2. Page Analysis Agent
- **Location**: `src/content/agent.ts`
- **Purpose**: Analyzes page structure and extracts actionable elements
- **Capabilities**: 
  - Element detection and classification
  - Form field identification
  - Link and button extraction
  - Page metadata collection

### 3. Action Execution Agent
- **Location**: `src/content/index.ts` + `src/common/actions.ts`
- **Purpose**: Executes browser actions based on intents
- **Capabilities**:
  - DOM manipulation
  - Form interaction
  - Navigation control
  - Scroll management

### 4. AI Assistant Agent
- **Location**: `src/sidepanel/App.tsx`
- **Purpose**: Provides conversational AI using Chrome's Prompt API
- **Capabilities**:
  - On-device language model processing
  - Streaming responses
  - Multi-language support
  - Context-aware conversations

## 🎤 Voice Commands

The extension supports natural language voice commands:

### Navigation Commands
- **"scroll up"** / **"scroll down"** - Page scrolling
- **"open [website]"** - Navigate to URL
- **"search [query]"** - Google search

### Interaction Commands
- **"click [element]"** - Click page elements
- **"fill [field]=[value]"** - Fill form fields
- **"summarize"** - Get page summary

### AI Chat
- Any other speech is treated as conversational input for the AI assistant

## 🔧 Technical Stack

### Core Technologies
- **React 19**: Latest React with SWC compilation
- **TypeScript**: Full type safety
- **Vite**: Fast build tool with HMR
- **Tailwind CSS 4**: Utility-first styling
- **Chrome Extension Manifest V3**: Modern extension architecture

### Key Dependencies
- `@crxjs/vite-plugin`: Chrome extension development
- `chrome-types`: Chrome API type definitions
- `clsx`: Conditional CSS classes
- `rolldown-vite`: Fast bundling

### Development Tools
- ESLint with TypeScript support
- Prettier for code formatting
- Hot Module Replacement (HMR)
- Source maps for debugging

## 🚀 Development

### Setup
```bash
npm install
npm run dev          # Development server
npm run dev:stable   # Stable development (reduced reloads)
```

### Build
```bash
npm run build        # Production build
npm run preview      # Preview production build
```

### Testing
1. Load extension in Chrome (`chrome://extensions/`)
2. Enable Developer mode
3. Click "Load unpacked" and select project folder
4. Test voice commands on any webpage

## 📁 Project Structure

```
nano-ext/
├── src/
│   ├── sidepanel/           # Main React application
│   │   ├── App.tsx         # Main component with voice/AI features
│   │   ├── main.tsx        # React entry point
│   │   └── panel.html      # HTML template
│   ├── content/            # Content scripts
│   │   ├── index.ts        # Basic page interaction
│   │   └── agent.ts        # Advanced page analysis
│   ├── background/         # Service worker
│   │   └── index.ts        # Extension lifecycle management
│   ├── common/             # Shared utilities
│   │   ├── actions.ts      # Page interaction functions
│   │   ├── intent-engine.ts # Voice command processing
│   │   ├── intents.ts      # Intent type definitions
│   │   └── index.ts        # Content script message handler
│   ├── types/              # TypeScript definitions
│   │   ├── web-speech.d.ts # Web Speech API types
│   │   └── agent-types.ts  # Advanced agent types
│   ├── App.tsx             # Default Vite template (unused)
│   └── main.tsx            # Default Vite entry (unused)
├── dist/                   # Built extension files
├── manifest.config.ts      # Extension manifest
├── vite.config.ts          # Build configuration
└── package.json            # Dependencies and scripts
```

## 🔒 Permissions

The extension requires these Chrome permissions:
- `sidePanel`: For the main UI
- `tabs`: For tab management
- `activeTab`: For current tab access
- `offscreen`: For background processing
- `storage`: For data persistence
- `<all_urls>`: For content script injection

## 🌟 Key Features in Detail

### Voice Recognition
- Uses Web Speech API for real-time voice input
- Supports continuous recognition with interim results
- Multi-language support (EN, ES, JA)
- Automatic command detection vs. chat input

### AI Integration
- Chrome Prompt API for on-device processing
- Streaming responses for real-time feedback
- Session management with language switching
- Error handling and fallback mechanisms

### Page Interaction
- XPath-based element selection
- Form field detection and filling
- Smooth scrolling with customizable amounts
- URL navigation and search execution

### Developer Experience
- Hot Module Replacement for fast development
- TypeScript for type safety
- ESLint for code quality
- Optimized build configuration

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
