export type IntentType =
  | "SCROLL"
  | "OPEN_URL"
  | "SEARCH_WEB"
  | "SUMMARY"
  | "FILL_FIELD"
  | "CLICK_LABEL";

export type Intent =
  | { type: "SCROLL"; direction: "up"|"down"; amount?: number }
  | { type: "OPEN_URL"; url: string }
  | { type: "SEARCH_WEB"; query: string }
  | { type: "SUMMARY" }
  | { type: "FILL_FIELD"; label: string; value: string }
  | { type: "CLICK_LABEL"; label: string };

export interface IntentResult { ok: boolean; data?: any; error?: string }
