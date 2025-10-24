// src/types/agent-types.ts
export type ElementRole =
  | "link" | "button" | "input" | "select" | "textarea"
  | "img" | "card" | "unknown";

export type ElementDescriptor = {
  role: ElementRole;
  title: string;
  subtitle?: string;
  href?: string;
  selector?: string;
  price?: number;
  rating?: number;
};

export type PageInsights = {
  url: string;
  title: string;
  headings: string[];
  topText: string[];
  elements: ElementDescriptor[];
  controls: {
    hasDateInputs: boolean;
    dateSelectors?: { checkIn?: string; checkOut?: string };
  };
};

// ✅ add AgentType so imports compile
export type AgentType = "orchestrator" | "navigation" | "interaction" | "analysis";

export type Action =
  | { kind: "CLICK"; selector?: string; text?: string }
  | { kind: "TYPE"; selector?: string; label?: string; value: string }
  | { kind: "SELECT_OPTION"; selector?: string; label?: string; optionText: string }
  | { kind: "SET_DATE"; selector: string; valueISO: string }
  | { kind: "SUBMIT"; selector?: string }
  | { kind: "SCROLL"; amount?: number; to?: "top" | "bottom" }
  | { kind: "NAVIGATE"; url: string };

// ✅ include `agent` in each suggestion so we can route to the right worker
export type AgentPlan = {
  summary: string;
  questions?: string[];
  suggestions: {
    title: string;
    reason?: string;
    agent: AgentType;     // <-- new
    actions: Action[];
  }[];
};
