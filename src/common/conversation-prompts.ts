/**
 * Conversation Prompts Engine
 * Generates natural, contextual voice responses for different task stages
 */

export type PromptContext =
  | "task_start"
  | "searching"
  | "found_results"
  | "filling_form"
  | "clicking_element"
  | "navigating"
  | "waiting"
  | "processing"
  | "task_complete"
  | "task_error"
  | "asking_confirmation"
  | "multi_agent_start"
  | "multi_agent_progress"
  | "multi_agent_complete";

export interface PromptOptions {
  context: PromptContext;
  itemCount?: number;
  itemType?: string;
  fieldName?: string;
  actionName?: string;
  location?: string;
  errorMessage?: string;
  agents?: string[];
  progress?: number;
}

/**
 * ConversationPrompts: Generates natural language responses
 * Uses a mix of templates and dynamic content
 */
export class ConversationPrompts {
  private prompts: Map<PromptContext, string[]> = new Map([
    [
      "task_start",
      [
        "Starting the task now.",
        "Beginning your request.",
        "Let me get started on that.",
        "Initiating the process.",
        "Here we go.",
      ],
    ],
    [
      "searching",
      [
        "Searching for {itemType}...",
        "Looking for {itemType}...",
        "Searching the web for {itemType}...",
        "Let me find {itemType} for you...",
        "Searching for {itemType} in {location}...",
      ],
    ],
    [
      "found_results",
      [
        "Found {itemCount} {itemType}.",
        "I found {itemCount} matching {itemType}.",
        "I've got {itemCount} results for you.",
        "{itemCount} {itemType} available.",
        "Showing {itemCount} options.",
      ],
    ],
    [
      "filling_form",
      [
        "Filling out the form.",
        "Starting to fill the form fields.",
        "Now filling the form for you.",
        "Working on the form.",
        "Let me complete this form.",
      ],
    ],
    [
      "clicking_element",
      [
        "Clicking {actionName}.",
        "Let me click {actionName}.",
        "Clicking on {actionName}.",
        "Activating {actionName}.",
        "Selecting {actionName}.",
      ],
    ],
    [
      "navigating",
      [
        "Navigating to {location}.",
        "Going to {location}.",
        "Opening {location}.",
        "Heading to {location}.",
        "Let me visit {location}.",
      ],
    ],
    [
      "waiting",
      [
        "Waiting for the page to load.",
        "Give me a moment...",
        "Standing by...",
        "Loading...",
        "Just a second...",
      ],
    ],
    [
      "processing",
      [
        "Processing your request.",
        "Working on it...",
        "Processing data...",
        "Analyzing results...",
        "One moment, processing...",
      ],
    ],
    [
      "task_complete",
      [
        "Done! Your task is complete.",
        "All finished.",
        "Task completed successfully.",
        "I'm done with that.",
        "That's all set.",
      ],
    ],
    [
      "task_error",
      [
        "Sorry, I ran into an issue: {errorMessage}.",
        "There was a problem: {errorMessage}.",
        "I encountered an error: {errorMessage}.",
        "Something went wrong: {errorMessage}.",
        "Unable to proceed: {errorMessage}.",
      ],
    ],
    [
      "asking_confirmation",
      [
        "Should I proceed?",
        "Ready to continue?",
        "Do you want me to continue?",
        "Shall I go ahead?",
        "Is this okay?",
      ],
    ],
    [
      "multi_agent_start",
      [
        "Starting {agents} to work on your tasks.",
        "Deploying {agents} to handle your requests.",
        "Launching {agents} now.",
        "{agents} are ready to work.",
        "Starting work with {agents}.",
      ],
    ],
    [
      "multi_agent_progress",
      [
        "{agents} are working on their tasks. Progress: {progress}%.",
        "{agents} in progress. {progress}% complete.",
        "Your agents are busy. {progress}% done.",
        "{agents} are on it. {progress}% of the way there.",
      ],
    ],
    [
      "multi_agent_complete",
      [
        "All agents have completed their tasks!",
        "Your agents are done.",
        "All tasks finished by agents.",
        "Agents have completed all work.",
        "All agents finished successfully.",
      ],
    ],
  ]);

  /**
   * Get random prompt and fill in variables
   */
  getPrompt(options: PromptOptions): string {
    const { context, ...data } = options;
    const templates = this.prompts.get(context) || ["Done."];
    const template = templates[Math.floor(Math.random() * templates.length)];

    return this.fillTemplate(template, data);
  }

  /**
   * Fill template with variables
   * Example: "Found {itemCount} {itemType}" + {itemCount: 5, itemType: "hotels"}
   * Result: "Found 5 hotels"
   */
  private fillTemplate(
    template: string,
    data: Record<string, any>
  ): string {
    let result = template;

    if (data.itemCount !== undefined) {
      result = result.replace("{itemCount}", String(data.itemCount));
    }

    if (data.itemType) {
      result = result.replace("{itemType}", data.itemType);
    }

    if (data.fieldName) {
      result = result.replace("{fieldName}", data.fieldName);
    }

    if (data.actionName) {
      result = result.replace("{actionName}", data.actionName);
    }

    if (data.location) {
      result = result.replace("{location}", data.location);
    }

    if (data.errorMessage) {
      result = result.replace("{errorMessage}", data.errorMessage);
    }

    if (data.progress !== undefined) {
      result = result.replace("{progress}", String(data.progress));
    }

    if (data.agents) {
      const agentString = Array.isArray(data.agents)
        ? data.agents.join(", ")
        : data.agents;
      result = result.replace("{agents}", agentString);
    }

    return result;
  }

  /**
   * Get multiple prompts (for variation)
   */
  getPrompts(options: PromptOptions, count: number = 3): string[] {
    const { context, ...data } = options;
    const templates = this.prompts.get(context) || ["Done."];
    const selected: string[] = [];

    for (let i = 0; i < Math.min(count, templates.length); i++) {
      selected.push(this.fillTemplate(templates[i], data));
    }

    return selected;
  }

  /**
   * Add custom prompts
   */
  addPrompts(context: PromptContext, templates: string[]): void {
    this.prompts.set(context, templates);
  }

  /**
   * Clear prompts for a context
   */
  clearPrompts(context: PromptContext): void {
    this.prompts.delete(context);
  }
}

// Export singleton instance
export const conversationPrompts = new ConversationPrompts();
