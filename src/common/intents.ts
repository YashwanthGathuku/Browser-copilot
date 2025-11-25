export type IntentType =
  | "SCROLL"
  | "OPEN_URL"
  | "SEARCH_WEB"
  | "SUMMARY"
  | "FILL_FIELD"
  | "CLICK_LABEL"
  | "PLAN_TASK"
  | "EXECUTE_TASK_CHAIN"
  | "CANCEL_TASK"
  | "WAIT"
  | "VALIDATE";

export type Intent =
  | { type: "SCROLL"; direction: "up"|"down"; amount?: number }
  | { type: "OPEN_URL"; url: string }
  | { type: "SEARCH_WEB"; query: string }
  | { type: "SUMMARY" }
  | { type: "FILL_FIELD"; label: string; value: string }
  | { type: "CLICK_LABEL"; label: string }
  | { type: "PLAN_TASK"; goal: string }
  | { type: "EXECUTE_TASK_CHAIN"; chainId: string }
  | { type: "CANCEL_TASK"; chainId: string }
  | { type: "WAIT"; ms: number }
  | { type: "VALIDATE"; condition: string };

export interface IntentResult { ok: boolean; data?: any; error?: string }
