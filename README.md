# Nano Assistant (Browser Copilot) — Updated

An on-device, agent-based Chrome extension to automate browsing tasks, provide context-aware recommendations, and support developer-oriented automation flows.

This branch includes architectural improvements, a richer agent orchestration flow, an enhanced content-agent with visual reasoning, and documented next-level features we plan to add.

![Nano Assistant UI](https://github.com/user-attachments/assets/placeholder-image)

## What’s New (in this branch)
- Improved agent orchestration and a resilient background agent runner.
- Content scripts now provide a robust `scanPage` insights API (link, form controls, accessibility tree).
- Visual feedback overlay for click, fill, scan, and thinking states.
- Enhanced Agent API for fluent automation (inspired by Puppeteer / Cypress).
- Task planner for converting goals into task chains.
- TTS service and ASR integration in the side panel (multi-language).
- Basic recording/replay hooks and export-ready action chains.

We continue to evolve the codebase toward high-confidence automation with safety and shareability in mind.

---

## Quick Overview
- Side Panel (Chat + Voice): `src/sidepanel/App.tsx` — main UI and routing, supports ASR, LLM session handling, and agent controls.
- Content Scripts: `src/content/*` — `agent.ts`, `enhanced-agent.ts`, and `visual-reasoning.ts` provide scanning, actions, and element-finding.
- Background Worker: `src/background/index.ts` — agent manager, LLM-based planning with `planWithLLM`, and agent lifecycle run loop.
- Shared Utilities: `src/common/*` — `intent-engine.ts`, `task-planner.ts`, `tts-service.ts`, `visual-feedback.ts`, `messaging.ts`.

## Core Capabilities (what you can do today)
- Chat-driven side panel with deterministic intent parsing and LLM-powered responses.
- Voice: ASR + TTS with a queuing service and language options.
- Scan pages for structural elements, inputs, and generate accessibility-aware selectors.
- Page-level automation: click, type, set date, select, submit, and navigate.
- Run multi-step agent-based tasks (LLM or rule-based planner), watch progress in the Agents dashboard.
- Visual reasoning primitives: capture screenshots, analyze accessibility tree, and ask the LLM to find selectors from descriptions.
- Record & replay basic actions with an exportable action chain.

---

## Notable Architecture & Design Principles
- Agents are run in the background as a service worker — they persist to `chrome.storage.local` which provides the basis for long-lived tasks.
- State and UX split between the side panel (React) and the Background Agent Manager.
- All critical content interactions go through content scripts for safety and context (DOM access).

## Installation & Development (Updated)
1. Prerequisites:
   - Chrome/Chromium (stable/policies may vary for on-device model)
   - Node 18+ recommended

2. Install & run in dev:

```powershell
cd e:\projects\React\ChromeExtension\nano-ext
npm install
npm run dev
```

3. Load the extension:
   - Open `chrome://extensions/`
   - Enable Developer mode, click "Load unpacked" and pick the project root (or built `dist` folder).

---

## Usage Highlights
- Open the side panel and speak or type commands.
- Try deterministic intents like "open example.com" or "search hotels in DC".
- Use the **Scan** button to gather tab insights for an LLM to reason over.
- Start recording from the UI, interact with a page, stop, and replay your steps.

---

## Next-Level Features (Planned / Roadmap)
These are features planned to differentiate Nano Assistant from other browser assistants (Comet, ChatGPT Atlas), prioritized by impact:

P1 - Feature set
- Ghost Replay Tabs — Create short GIF/video replays with AI voiceovers for an agent run.
- Tab Atlas — Scan all open tabs and build a searchable, clusterable knowledge map.
- Agent Flow Builder — Visual planner for composing and validating action chains.
- Action-as-Code Export — Export agent chains to Playwright/Puppeteer or Cypress.
- Persona Memory — Per-domain memory to remember user preferences locally.

P2 - Nice-to-have
- Auto-validate checkpoints — stop mid-flow with screenshot-based confirmation.
- Visual diff & rollback support — compare page state across actions.
- Collaboration / shareable sessions — (opt-in, secure sharing of runs).

---

## Contributing
- Please follow the repository contribution guidelines. Open an issue or PR for feature proposals and bug fixes.

### Recommended workflow
1. Fork & clone the repo.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Commit changes and open a PR.

---

## Tests & QA
- Unit test coverage is recommended for `intent-engine`, `task-planner`, and `content/agent`.
- Integration tests for end-to-end agent chains can be added with Playwright or Puppeteer.

---

## License
MIT

---

If you'd like, I can implement P0 priorities now: `agent-runner` resiliency and a safety preview modal for destructive actions — start with one or both and I’ll create the PR.
