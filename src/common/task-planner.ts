/**
 * Task Planner: Breaks down complex goals into executable task chains
 * Handles task orchestration, dependency management, and execution
 */

import type {
  Task,
  TaskChain,
  TaskStatus,
  TaskExecutionContext,
  TaskExecutionResult,
  PanelIntent,
} from "../types/agent-types";

export class TaskPlanner {
  private taskChains: Map<string, TaskChain> = new Map();
  private executionHistory: TaskExecutionResult[] = [];

  /**
   * Parses a complex goal into a task chain
   * Example: "Book a hotel in NYC from Dec 1-5 with ocean view for 2 people"
   * Returns: TaskChain with steps
   */
  planGoal(goal: string): TaskChain {
    const chainId = crypto.randomUUID();
    const tasks = this.extractTasks(goal);

    const chain: TaskChain = {
      id: chainId,
      name: this.generateChainName(goal),
      description: goal,
      goal,
      tasks,
      status: "pending",
      priority: "normal",
      createdAt: Date.now(),
      stats: {
        total: tasks.length,
        completed: 0,
        failed: 0,
        skipped: 0,
      },
    };

    this.taskChains.set(chainId, chain);
    return chain;
  }

  /**
   * Intelligent task extraction from natural language goal
   */
  private extractTasks(goal: string): Task[] {
    const tasks: Task[] = [];
    const goalLower = goal.toLowerCase();
    let taskId = 1;

    // Hotel/Travel booking pattern
    if (goalLower.includes("book") && (goalLower.includes("hotel") || goalLower.includes("flight"))) {
      tasks.push(
        this.createTask(
          taskId++,
          "Search accommodation",
          { type: "SEARCH_WEB", query: this.extractSearchQuery(goal) },
          "normal",
          "Extract search location and dates from goal"
        ),
        this.createTask(
          taskId++,
          "Apply date filters",
          { type: "CLICK_LABEL", label: "date filter" },
          "normal",
          "Locate and click date selection"
        ),
        this.createTask(
          taskId++,
          "Set check-in date",
          { type: "FILL_FIELD", label: "check-in", value: this.extractDate(goal, "from") || "" },
          "normal"
        ),
        this.createTask(
          taskId++,
          "Set check-out date",
          { type: "FILL_FIELD", label: "check-out", value: this.extractDate(goal, "to") || "" },
          "normal"
        ),
        this.createTask(
          taskId++,
          "Set room capacity",
          { type: "FILL_FIELD", label: "guests", value: this.extractGuests(goal) || "2" },
          "normal"
        ),
        this.createTask(
          taskId++,
          "Apply amenity filters",
          { type: "CLICK_LABEL", label: this.extractAmenity(goal) || "filter" },
          "low"
        ),
        this.createTask(
          taskId++,
          "Sort by price",
          { type: "CLICK_LABEL", label: "sort by price" },
          "normal"
        )
      );
    }
    // Shopping/E-commerce pattern
    else if (goalLower.includes("buy") || goalLower.includes("shop") || goalLower.includes("find")) {
      tasks.push(
        this.createTask(
          taskId++,
          "Search products",
          { type: "SEARCH_WEB", query: this.extractSearchQuery(goal) },
          "normal"
        ),
        this.createTask(
          taskId++,
          "Apply price filter",
          { type: "CLICK_LABEL", label: "price" },
          "normal"
        ),
        this.createTask(
          taskId++,
          "Sort by relevance",
          { type: "CLICK_LABEL", label: "sort" },
          "normal"
        ),
        this.createTask(
          taskId++,
          "Review options",
          { type: "SUMMARY" },
          "normal"
        )
      );
    }
    // Generic multi-action pattern
    else if (
      goalLower.includes("fill") ||
      goalLower.includes("submit") ||
      goalLower.includes("complete")
    ) {
      tasks.push(
        this.createTask(
          taskId++,
          "Analyze page",
          { type: "SUMMARY" },
          "normal"
        ),
        this.createTask(
          taskId++,
          "Fill form fields",
          { type: "FILL_FIELD", label: "field", value: "" },
          "normal"
        ),
        this.createTask(
          taskId++,
          "Submit form",
          { type: "CLICK_LABEL", label: "submit" },
          "normal"
        )
      );
    }
    // Fallback: Parse for explicit commands
    else {
      const commands = this.parseExplicitCommands(goal);
      commands.forEach((cmd, idx) => {
        tasks.push(this.createTask(idx + 1, `Step ${idx + 1}`, cmd, "normal"));
      });
    }

    // If no tasks extracted, create a search task
    if (tasks.length === 0) {
      tasks.push(
        this.createTask(
          1,
          "Search",
          { type: "SEARCH_WEB", query: goal },
          "normal"
        )
      );
    }

    return tasks;
  }

  /**
   * Create a task object with defaults
   */
  private createTask(
    index: number,
    title: string,
    intent: PanelIntent,
    priority: "low" | "normal" | "high",
    description?: string,
    dependencies?: string[]
  ): Task {
    return {
      id: `task-${Date.now()}-${index}`,
      title,
      description,
      intent,
      status: "pending",
      priority,
      dependencies,
      retries: 0,
      maxRetries: 2,
      createdAt: Date.now(),
      metadata: {
        order: index,
      },
    };
  }

  /**
   * Extract key information from goal strings
   */
  private extractSearchQuery(goal: string): string {
    // Remove common prefixes
    const cleaned = goal
      .replace(/^(book|find|search for|show me|get)\s+/i, "")
      .replace(/\s+(from|to|with|for|in)\s+.*$/i, "");
    return cleaned;
  }

  private extractDate(goal: string, _position: "from" | "to"): string | null {
    // Simple date extraction - can be enhanced with better regex
    const dateRegex = /(?:from|to|starting|until)\s+(\d{1,2})\s*\/?(\d{1,2})?\s*(?:dec|january|february|march|april|may|june|july|august|september|october|november|december)/i;
    const match = goal.match(dateRegex);
    return match ? `${match[1]}-${match[2] || "01"}` : null;
  }

  private extractGuests(goal: string): string | null {
    const match = goal.match(/for\s+(\d+)\s+(people|guest|person)/i);
    return match ? match[1] : null;
  }

  private extractAmenity(goal: string): string | null {
    const amenities = ["ocean view", "pool", "gym", "wifi", "parking", "ac"];
    for (const amenity of amenities) {
      if (goal.toLowerCase().includes(amenity)) {
        return amenity;
      }
    }
    return null;
  }

  private generateChainName(goal: string): string {
    const words = goal.split(" ").slice(0, 5).join(" ");
    return `${words}...`;
  }

  private parseExplicitCommands(goal: string): PanelIntent[] {
    const commands: PanelIntent[] = [];
    const parts = goal.split(/[,;]\s*/);

    for (const part of parts) {
      const intent = this.parseCommand(part.trim());
      if (intent) {
        commands.push(intent);
      }
    }

    return commands;
  }

  private parseCommand(text: string): PanelIntent | null {
    const t = text.toLowerCase();

    if (/^scroll/.test(t)) {
      return { type: "SCROLL", direction: t.includes("down") ? "down" : "up" };
    }
    if (/^open/.test(t)) {
      const url = text.slice(5).trim();
      return { type: "OPEN_URL", url };
    }
    if (/^search/.test(t)) {
      return { type: "SEARCH_WEB", query: text.slice(7).trim() };
    }
    if (/^(summary|summarize)/.test(t)) {
      return { type: "SUMMARY" };
    }
    if (/^click/.test(t)) {
      return { type: "CLICK_LABEL", label: text.slice(5).trim() };
    }
    if (/^fill/.test(t)) {
      const match = text.match(/^fill\s+(.+?)\s*with\s+(.+)$/i);
      if (match) {
        return { type: "FILL_FIELD", label: match[1], value: match[2] };
      }
    }

    return null;
  }

  /**
   * Execute a task chain sequentially
   */
  async executeChain(
    chainId: string,
    executionFn: (task: Task, context: TaskExecutionContext) => Promise<any>,
    pageInsights?: any
  ): Promise<TaskChain | null> {
    const chain = this.taskChains.get(chainId);
    if (!chain) return null;

    chain.status = "executing";
    chain.startedAt = Date.now();

    const previousResults: Record<string, any> = {};

    for (const task of chain.tasks) {
      // Check dependencies
      if (task.dependencies && task.dependencies.length > 0) {
        const allDepsMet = task.dependencies.every((depId) => {
          const depTask = chain.tasks.find((t) => t.id === depId);
          return depTask?.status === "completed";
        });

        if (!allDepsMet) {
          task.status = "skipped";
          chain.stats.skipped++;
          continue;
        }
      }

      // Execute task
      const result = await this.executeTask(
        task,
        chainId,
        executionFn,
        pageInsights,
        previousResults
      );

      previousResults[task.id] = result;

      // Update chain stats
      if (result.status === "completed") {
        chain.stats.completed++;
      } else if (result.status === "failed") {
        chain.stats.failed++;
      } else if (result.status === "skipped") {
        chain.stats.skipped++;
      }

      // Store execution result
      this.executionHistory.push(result);

      // Stop on critical failure
      if (result.status === "failed" && task.priority === "high") {
        chain.status = "failed";
        chain.completedAt = Date.now();
        return chain;
      }
    }

    chain.status = "completed";
    chain.completedAt = Date.now();

    return chain;
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeTask(
    task: Task,
    chainId: string,
    executionFn: (task: Task, context: TaskExecutionContext) => Promise<any>,
    pageInsights: any,
    previousResults: Record<string, any>
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    task.startedAt = startTime;

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= task.maxRetries; attempt++) {
      try {
        const context: TaskExecutionContext = {
          chainId,
          taskId: task.id,
          pageInsights,
          previousResults,
        };

        const result = await executionFn(task, context);

        task.status = "completed";
        task.completedAt = Date.now();

        return {
          taskId: task.id,
          status: "completed",
          result,
          duration: Date.now() - startTime,
          timestamp: Date.now(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        task.retries = attempt + 1;

        // Wait before retry
        if (attempt < task.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    task.status = "failed";
    task.error = lastError;
    task.completedAt = Date.now();

    return {
      taskId: task.id,
      status: "failed",
      error: lastError,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Get all task chains
   */
  getChains(): TaskChain[] {
    return Array.from(this.taskChains.values());
  }

  /**
   * Get a specific chain
   */
  getChain(id: string): TaskChain | null {
    return this.taskChains.get(id) || null;
  }

  /**
   * Update task status
   */
  updateTaskStatus(chainId: string, taskId: string, status: TaskStatus): void {
    const chain = this.taskChains.get(chainId);
    if (!chain) return;

    const task = chain.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = status;
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 100): TaskExecutionResult[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Clear completed chains
   */
  clearCompletedChains(): void {
    for (const [id, chain] of this.taskChains.entries()) {
      if (chain.status === "completed" || chain.status === "failed") {
        this.taskChains.delete(id);
      }
    }
  }

  /**
   * Cancel a chain
   */
  cancelChain(id: string): void {
    const chain = this.taskChains.get(id);
    if (chain && chain.status === "executing") {
      chain.status = "failed";
      for (const task of chain.tasks) {
        if (task.status === "pending" || task.status === "executing") {
          task.status = "skipped";
        }
      }
    }
  }
}

// Singleton instance
export const taskPlanner = new TaskPlanner();
