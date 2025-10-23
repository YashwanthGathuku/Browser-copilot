// src/sidepanel/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "../index.css"; // Shared styles

createRoot(document.getElementById("root")!).render(<App />);