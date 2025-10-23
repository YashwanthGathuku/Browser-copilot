// manifest.config.ts
// Define manifest for Chrome extension with proper types
/// <reference types="chrome-types" />

const manifest = {
  manifest_version: 3,
  name: "Nano Assistant",
  version: "0.1.0",
  description: "Side panel chat (React Compiler) + fast HMR elsewhere (SWC).",
  action: { default_title: "Open Nano Assistant" },
  side_panel: { default_path: "src/sidepanel/panel.html" },
  background: { service_worker: "src/background/index.ts", type: "module" },
  permissions: ["sidePanel", "tabs", "activeTab", "offscreen", "storage"], // Added storage
  host_permissions: ["<all_urls>"],
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts","src/content/agent.ts"],
      run_at: "document_idle",
      all_frames: true,
      match_about_blank: true
    },
  ],
  commands: {
    "toggle-panel": {
      suggested_key: { default: "Ctrl+Shift+S" },
      description: "Toggle the side panel",
    },
  },
  web_accessible_resources: [
    {
      resources: ["src/sidepanel/panel.html", "src/sidepanel/main.tsx"],
      matches: ["<all_urls>"],
    },
  ],
};

export default manifest;