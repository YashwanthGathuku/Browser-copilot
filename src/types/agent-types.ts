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
  accessibilityTree?: any; // Vision Context
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
  | { kind: "NAVIGATE"; url: string }
  | { kind: "OPEN_TAB"; url: string }
  | { kind: "CLOSE_TAB" };

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

/* ======================== MULTI-STEP TASK AUTOMATION ======================== */

export type TaskStatus = "pending" | "executing" | "completed" | "failed" | "skipped";
export type TaskPriority = "low" | "normal" | "high";

export type Task = {
  id: string;
  title: string;
  description?: string;
  intent: PanelIntent;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies?: string[]; // task IDs this depends on
  retries: number;
  maxRetries: number;
  metadata?: Record<string, any>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
};

export type PanelIntent =
  | { type: "SCROLL"; direction: "up" | "down"; amount?: number }
  | { type: "OPEN_URL"; url: string }
  | { type: "SEARCH_WEB"; query: string }
  | { type: "SUMMARY" }
  | { type: "CLICK_LABEL"; label: string }
  | { type: "FILL_FIELD"; label: string; value: string }
  | { type: "WAIT"; ms: number }
  | { type: "VALIDATE"; condition: string };

export type TaskChain = {
  id: string;
  name: string;
  description?: string;
  goal: string;
  tasks: Task[];
  status: TaskStatus;
  priority: TaskPriority;
  tags?: string[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  stats: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  };
  metadata?: Record<string, any>;
};

export type TaskExecutionContext = {
  chainId: string;
  taskId: string;
  pageInsights: PageInsights;
  previousResults: Record<string, any>;
  abortSignal?: AbortSignal;
};

export type TaskExecutionResult = {
  taskId: string;
  status: TaskStatus;
  result?: any;
  error?: string;
  duration: number;
  timestamp: number;
};
