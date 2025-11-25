/**
 * TaskProgress Component - Visual representation of multi-step task execution
 */

import React, { useState } from "react";
import clsx from "clsx";
import type { TaskChain, Task } from "../../types/agent-types";

interface TaskProgressProps {
  chain: TaskChain | null;
  isExecuting: boolean;
  onCancel?: () => void;
}

export const TaskProgress: React.FC<TaskProgressProps> = ({ chain, isExecuting, onCancel }) => {
  if (!chain) return null;

  const progressPercent = chain.stats.total > 0 
    ? ((chain.stats.completed + chain.stats.failed + chain.stats.skipped) / chain.stats.total) * 100 
    : 0;

  const isComplete = chain.status === "completed" || chain.status === "failed";

  return (
    <div className="mb-6 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold text-sm truncate flex-1">
            {chain.name}
          </h3>
          {!isComplete && (
            <button
              onClick={onCancel}
              className="ml-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        <p className="text-blue-100 text-xs">{chain.goal}</p>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Progress: {Math.round(progressPercent)}%
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {chain.stats.completed}/{chain.stats.total} completed
          </span>
        </div>
        <div className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              "h-full transition-all duration-300",
              chain.status === "failed" ? "bg-red-500" : "bg-green-500"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Task List */}
      <div className="px-4 py-3 max-h-64 overflow-y-auto">
        <div className="space-y-2">
          {chain.tasks.map((task, idx) => (
            <TaskItem key={task.id} task={task} index={idx + 1} />
          ))}
        </div>
      </div>

      {/* Status Footer */}
      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <span className="text-green-600 dark:text-green-400">
              ✓ {chain.stats.completed} done
            </span>
            {chain.stats.failed > 0 && (
              <span className="text-red-600 dark:text-red-400">
                ✗ {chain.stats.failed} failed
              </span>
            )}
            {chain.stats.skipped > 0 && (
              <span className="text-gray-600 dark:text-gray-400">
                ⊘ {chain.stats.skipped} skipped
              </span>
            )}
          </div>
          <span
            className={clsx(
              "font-medium px-2 py-1 rounded",
              isExecuting && "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30",
              chain.status === "completed" && "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30",
              chain.status === "failed" && "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30"
            )}
          >
            {isExecuting ? "Running..." : chain.status}
          </span>
        </div>
      </div>
    </div>
  );
};

interface TaskItemProps {
  task: Task;
  index: number;
  // total: number; // Available for future use
}

const TaskItem: React.FC<TaskItemProps> = ({ task, index }) => {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending: "⏳",
    executing: "▶️",
    completed: "✅",
    failed: "❌",
    skipped: "⊘",
  }[task.status];

  const statusColor = {
    pending: "text-gray-500",
    executing: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
    skipped: "text-gray-400",
  }[task.status];

  const bgColor = {
    pending: "bg-white hover:bg-gray-50",
    executing: "bg-blue-50 dark:bg-blue-900/10",
    completed: "bg-green-50 dark:bg-green-900/10",
    failed: "bg-red-50 dark:bg-red-900/10",
    skipped: "bg-gray-50 dark:bg-gray-800/50",
  }[task.status];

  return (
    <div className={clsx("p-2 rounded border border-gray-200 dark:border-gray-700", bgColor)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-start gap-2 hover:opacity-75 transition-opacity"
      >
        <span className={clsx("text-base flex-shrink-0", statusColor)}>{statusIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
              {index}. {task.title}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
              {expanded ? "▼" : "▶"}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-2 pl-6 space-y-1 text-xs border-l border-gray-300 dark:border-gray-600 pl-3">
          {task.description && (
            <p className="text-gray-700 dark:text-gray-300">{task.description}</p>
          )}

          {/* Intent Details */}
          <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded font-mono text-gray-600 dark:text-gray-400 break-all">
            <span className="font-semibold">Intent:</span> {task.intent.type}
            {task.intent.type === "SCROLL" && ` (${(task.intent as any).direction})`}
            {task.intent.type === "SEARCH_WEB" && ` "${(task.intent as any).query}"`}
            {task.intent.type === "OPEN_URL" && ` ${(task.intent as any).url}`}
            {task.intent.type === "FILL_FIELD" && ` ${(task.intent as any).label} = ${(task.intent as any).value}`}
            {task.intent.type === "CLICK_LABEL" && ` "${(task.intent as any).label}"`}
          </div>

          {/* Metadata */}
          <div className="text-gray-600 dark:text-gray-400">
            <div>Priority: <span className="font-medium">{task.priority}</span></div>
            {task.startedAt && (
              <div>
                Duration: <span className="font-medium">
                  {task.completedAt 
                    ? `${Math.round((task.completedAt - task.startedAt) / 1000)}s`
                    : `${Math.round((Date.now() - task.startedAt) / 1000)}s`}
                </span>
              </div>
            )}
            {task.retries > 0 && (
              <div>Retries: <span className="font-medium">{task.retries}/{task.maxRetries}</span></div>
            )}
            {task.error && (
              <div className="text-red-600 dark:text-red-400 mt-1">
                Error: <span className="font-medium">{task.error}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskProgress;
