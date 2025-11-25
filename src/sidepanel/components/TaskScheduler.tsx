import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { taskScheduler } from '../../background/task-scheduler';
import type { ScheduledTask, TaskPriority, ScheduleType } from '../../background/task-scheduler';

interface TaskSchedulerPanelProps {
  onScheduleTask: (task: {
    goal: string;
    priority: TaskPriority;
    schedule: { type: ScheduleType; delay?: number; interval?: number };
  }) => void;
}

export function TaskSchedulerPanel({ onScheduleTask }: TaskSchedulerPanelProps) {
  const [newTaskGoal, setNewTaskGoal] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('immediate');
  const [delay, setDelay] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskGoal.trim()) return;

    onScheduleTask({
      goal: newTaskGoal,
      priority,
      schedule: {
        type: scheduleType,
        delay: scheduleType === 'delayed' ? delay * 60000 : undefined, // Convert minutes to ms
        interval: scheduleType === 'recurring' ? delay * 60000 : undefined
      }
    });

    // Reset form
    setNewTaskGoal('');
    setPriority('medium');
    setScheduleType('immediate');
    setDelay(0);
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Scheduled Tasks
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className={clsx(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            showForm 
              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
              : "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-sm"
          )}
        >
          {showForm ? '✕ Cancel' : '+ Schedule Task'}
        </button>
      </div>

      {/* Task Creation Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200 dark:border-blue-800">
          {/* Goal Input */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Task Goal
            </label>
            <input
              type="text"
              value={newTaskGoal}
              onChange={(e) => setNewTaskGoal(e.target.value)}
              placeholder="e.g., Check email every hour"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Priority & Schedule Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                When
              </label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
              >
                <option value="immediate">⚡ Now</option>
                <option value="delayed">⏰ Delayed</option>
                <option value="recurring">🔄 Recurring</option>
              </select>
            </div>
          </div>

          {/* Delay/Interval Input */}
          {(scheduleType === 'delayed' || scheduleType === 'recurring') && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {scheduleType === 'delayed' ? 'Delay (minutes)' : 'Interval (minutes)'}
              </label>
              <input
                type="number"
                min="1"
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                required
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium text-sm hover:from-blue-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
          >
            Schedule Task
          </button>
        </form>
      )}
    </div>
  );
}

interface TaskListProps {
  tasks: ScheduledTask[];
  onCancelTask: (taskId: string) => void;
}

export function TaskList({ tasks, onCancelTask }: TaskListProps) {
  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-green-600 dark:text-green-400';
    }
  };

  const getStatusIcon = (status: ScheduledTask['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '▶️';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'cancelled': return '🚫';
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
        <div className="text-3xl mb-2">📅</div>
        <p>No scheduled tasks</p>
        <p className="text-xs mt-1">Click "Schedule Task" to create one</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <div
          key={task.id}
          className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{getStatusIcon(task.status)}</span>
                <span className={clsx("text-xs font-semibold", getPriorityColor(task.priority))}>
                  {task.priority.toUpperCase()}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {task.schedule.type === 'delayed' && '⏰'}
                  {task.schedule.type === 'recurring' && '🔄'}
                </span>
              </div>
              <p className="text-sm text-zinc-900 dark:text-zinc-100 font-medium truncate">
                {task.goal}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {new Date(task.createdAt).toLocaleTimeString()}
              </p>
            </div>
            
            {task.status === 'pending' || task.status === 'running' ? (
              <button
                onClick={() => onCancelTask(task.id)}
                className="px-2 py-1 rounded-md text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskScheduler() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);

  useEffect(() => {
    // Initial load
    const { pending, running, completed } = taskScheduler.getAllTasks();
    setTasks([...running, ...pending, ...completed]);

    // Subscribe
    const unsubscribe = taskScheduler.subscribe((allTasks) => {
      setTasks(allTasks);
    });
    return unsubscribe;
  }, []);

  const handleSchedule = (task: any) => {
    taskScheduler.schedule(task);
  };

  const handleCancel = (taskId: string) => {
    taskScheduler.cancel(taskId);
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <TaskSchedulerPanel onScheduleTask={handleSchedule} />
      <div className="my-4 border-t border-zinc-200 dark:border-zinc-700" />
      <TaskList tasks={tasks} onCancelTask={handleCancel} />
    </div>
  );
}
