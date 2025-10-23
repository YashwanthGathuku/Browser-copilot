import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  
  // Stable server configuration to prevent frequent reloads
  server: {
    hmr: {
      port: 5173,
      overlay: false,
      clientPort: 5173,
    },
    watch: {
      usePolling: false,
      interval: 2000, // Increased interval
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
  },

  build: {
    rollupOptions: {
      input: {
        sidepanel: "src/sidepanel/panel.html",
      },
    },
    target: "chrome120",
    sourcemap: false, // Disable sourcemap in dev to reduce file changes
    watch: {
      buildDelay: 2000, // Increased delay
      exclude: ['node_modules/**', 'dist/**'],
    },
  },
  
  // Additional stability settings
  optimizeDeps: {
    exclude: ['chrome-types'],
  },
});

