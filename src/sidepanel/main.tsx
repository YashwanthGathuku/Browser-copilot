// src/sidepanel/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../index.css";

type ErrorBoundaryProps = { children?: React.ReactNode };
type ErrorBoundaryState = { error: Error | null };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, fontFamily: "system-ui" }}>
          <b>Error:</b> {this.state.error.message}
        </div>
      );
    }
    return this.props.children ?? null;
  }
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
