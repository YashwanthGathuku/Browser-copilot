/**
 * Task Scheduler
 * Manages task queue with priorities, scheduling, and dependencies
 */

export type TaskPriority = 'high' | 'medium' | 'low';
export type ScheduleType = 'immediate' | 'delayed' | 'recurring';

export interface ScheduledTask {
  id: string;
  goal: string;
  priority: TaskPriority;
  schedule: {
    type: ScheduleType;
    delay?: number; // milliseconds for delayed tasks
    interval?: number; // milliseconds for recurring tasks
    cron?: string; // future: for complex schedules
  };
  dependencies?: string[]; // task IDs that must complete first
  createdAt: number;
  scheduledFor: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: string;
  attempts?: number;
  maxRetries?: number;
}

export class TaskScheduler {
  private queue: ScheduledTask[] = [];
  private running: Map<string, ScheduledTask> = new Map();
  private completed: Map<string, ScheduledTask> = new Map();
  private maxConcurrent: number = 3;
  private timers: Map<string, any> = new Map();
  private listeners: Set<(tasks: ScheduledTask[]) => void> = new Set();

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Schedule a new task
   */
  schedule(task: Omit<ScheduledTask, 'id' | 'createdAt' | 'scheduledFor' | 'status'>): string {
    const now = Date.now();
    const delay = task.schedule.delay || 0;
    
    const scheduledTask: ScheduledTask = {
      ...task,
      id: `task-${now}-${Math.random().toString(36).substring(7)}`,
      createdAt: now,
      scheduledFor: now + delay,
      status: 'pending',
      attempts: 0,
      maxRetries: task.maxRetries || 3
    };

    // Check dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      const unmetDeps = task.dependencies.filter(depId => {
        const dep = this.completed.get(depId);
        return !dep || dep.status !== 'completed';
      });
      
      if (unmetDeps.length > 0) {
        console.log(`[Scheduler] Task ${scheduledTask.id} waiting for dependencies:`, unmetDeps);
      }
    }

    this.queue.push(scheduledTask);
    this.sortQueue();
    this.notifyListeners();

    // Schedule delayed execution
    if (task.schedule.type === 'delayed' && delay > 0) {
      const timer = setTimeout(() => {
        this.processQueue();
      }, delay);
      this.timers.set(scheduledTask.id, timer);
    } else if (task.schedule.type === 'recurring' && task.schedule.interval) {
      // Set up recurring timer
      const timer = setInterval(() => {
        this.rescheduleRecurring(scheduledTask.id);
      }, task.schedule.interval);
      this.timers.set(scheduledTask.id, timer);
    } else {
      // Immediate execution - process queue
      setTimeout(() => this.processQueue(), 0);
    }

    console.log(`[Scheduler] Scheduled task ${scheduledTask.id}:`, scheduledTask.goal);
    return scheduledTask.id;
  }

  /**
   * Sort queue by priority and scheduled time
   */
  private sortQueue(): void {
    const priorityMap = { high: 3, medium: 2, low: 1 };
    
    this.queue.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityMap[b.priority] - priorityMap[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by scheduled time (earlier first)
      return a.scheduledFor - b.scheduledFor;
    });
  }

  /**
   * Process the queue
   */
  async processQueue(): Promise<void> {
    // Don't exceed max concurrent
    if (this.running.size >= this.maxConcurrent) {
      console.log(`[Scheduler] Max concurrent tasks (${this.maxConcurrent}) reached`);
      return;
    }

    const now = Date.now();
    
    // Find next ready task
    const taskIndex = this.queue.findIndex(task => {
      // Check if it's time
      if (task.scheduledFor > now) return false;
      
      // Check dependencies
      if (task.dependencies && task.dependencies.length > 0) {
        return task.dependencies.every(depId => {
          const dep = this.completed.get(depId);
          return dep && dep.status === 'completed';
        });
      }
      
      return true;
    });

    if (taskIndex === -1) {
      console.log('[Scheduler] No ready tasks in queue');
      return;
    }

    const task = this.queue.splice(taskIndex, 1)[0];
    task.status = 'running';
    this.running.set(task.id, task);
    this.notifyListeners();

    console.log(`[Scheduler] Starting task ${task.id}:`, task.goal);

    try {
      // Execute task (this would call the actual agent execution)
      const result = await this.executeTask(task);
      
      task.status = 'completed';
      task.result = result;
      this.completed.set(task.id, task);
      this.running.delete(task.id);
      
      console.log(`[Scheduler] Task ${task.id} completed`);
      this.notifyListeners();
      
      // Process next task
      this.processQueue();
    } catch (error: any) {
      console.error(`[Scheduler] Task ${task.id} failed:`, error);
      
      task.attempts = (task.attempts || 0) + 1;
      
      if (task.attempts < (task.maxRetries || 3)) {
        // Retry
        console.log(`[Scheduler] Retrying task ${task.id} (attempt ${task.attempts}/${task.maxRetries})`);
        task.status = 'pending';
        task.scheduledFor = Date.now() + 2000; // 2s delay before retry
        this.running.delete(task.id);
        this.queue.push(task);
        this.sortQueue();
      } else {
        // Max retries reached
        task.status = 'failed';
        task.error = error.message || String(error);
        this.completed.set(task.id, task);
        this.running.delete(task.id);
      }
      
      this.notifyListeners();
      this.processQueue();
    }
  }

  /**
   * Execute a task (placeholder - will be called by background agent)
   */
  private async executeTask(_task: ScheduledTask): Promise<any> {
    // This will be implemented by the background script
    // For now, just a placeholder
    return new Promise((resolve) => {
      setTimeout(() => resolve({ success: true }), 1000);
    });
  }

  /**
   * Set task executor function
   */
  setExecutor(executor: (task: ScheduledTask) => Promise<any>): void {
    this.executeTask = executor;
  }

  /**
   * Reschedule a recurring task
   */
  private rescheduleRecurring(taskId: string): void {
    const originalTask = this.completed.get(taskId) || this.running.get(taskId);
    if (!originalTask || originalTask.schedule.type !== 'recurring') return;

    const newTask: ScheduledTask = {
      ...originalTask,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      createdAt: Date.now(),
      scheduledFor: Date.now(),
      status: 'pending',
      attempts: 0
    };

    this.queue.push(newTask);
    this.sortQueue();
    this.notifyListeners();
    this.processQueue();
  }

  /**
   * Cancel a task
   */
  cancel(taskId: string): boolean {
    // Check running
    if (this.running.has(taskId)) {
      const task = this.running.get(taskId)!;
      task.status = 'cancelled';
      this.completed.set(taskId, task);
      this.running.delete(taskId);
      this.clearTimer(taskId);
      this.notifyListeners();
      return true;
    }

    // Check queue
    const queueIndex = this.queue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.queue.splice(queueIndex, 1)[0];
      task.status = 'cancelled';
      this.completed.set(taskId, task);
      this.clearTimer(taskId);
      this.notifyListeners();
      return true;
    }

    return false;
  }

  /**
   * Clear a timer
   */
  private clearTimer(taskId: string): void {
    const timer = this.timers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      clearInterval(timer);
      this.timers.delete(taskId);
    }
  }

  /**
   * Get all tasks
   */
  getAllTasks(): { pending: ScheduledTask[]; running: ScheduledTask[]; completed: ScheduledTask[] } {
    return {
      pending: [...this.queue],
      running: Array.from(this.running.values()),
      completed: Array.from(this.completed.values()).slice(-20) // Last 20
    };
  }

  /**
   * Subscribe to task updates
   */
  subscribe(listener: (tasks: ScheduledTask[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    const allTasks = [...this.queue, ...Array.from(this.running.values())];
    this.listeners.forEach(listener => listener(allTasks));
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): void {
    this.completed.clear();
    this.notifyListeners();
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.running.get(taskId) || 
           this.queue.find(t => t.id === taskId) ||
           this.completed.get(taskId);
  }
}

// Singleton instance
export const taskScheduler = new TaskScheduler(3);
