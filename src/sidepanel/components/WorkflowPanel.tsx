import { useState } from 'react';
import clsx from 'clsx';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  estimatedTime: number;
  variables?: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select';
    required: boolean;
    options?: string[];
    default?: string;
  }[];
}

interface WorkflowPanelProps {
  templates: WorkflowTemplate[];
  onExecute: (templateId: string, variables: Record<string, any>) => void;
  currentExecution?: {
    templateId: string;
    currentStep: number;
    totalSteps: number;
    stepTitle: string;
  } | null;
}

export function WorkflowPanel({ templates, onExecute, currentExecution }: WorkflowPanelProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Get unique categories
  const categories = [...new Set(templates.map(t => t.category))];

  // Filter templates by category
  const filteredTemplates = activeCategory
    ? templates.filter(t => t.category === activeCategory)
    : templates;

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      shopping: '🛒',
      research: '🔬',
      productivity: '⚡',
      social: '👥',
      job: '💼',
      travel: '✈️',
      custom: '⚙️',
    };
    return icons[category] || '📋';
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m`;
  };

  const handleExecute = () => {
    if (!selectedTemplate) return;

    // Validate required variables
    const missingRequired = selectedTemplate.variables?.filter(
      v => v.required && !variables[v.name]
    );
    if (missingRequired && missingRequired.length > 0) {
      alert(`Please fill in: ${missingRequired.map(v => v.label).join(', ')}`);
      return;
    }

    onExecute(selectedTemplate.id, variables);
    setSelectedTemplate(null);
    setVariables({});
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span>⚡</span>
          Workflow Templates
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          One-click automations for common tasks
        </p>
      </div>

      {/* Execution Progress */}
      {currentExecution && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-blue-900 dark:text-blue-100">
              Running workflow...
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-300">
              Step {currentExecution.currentStep + 1}/{currentExecution.totalSteps}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-blue-200 dark:bg-blue-800 overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${((currentExecution.currentStep + 1) / currentExecution.totalSteps) * 100}%` }}
              />
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-300">
              {currentExecution.stepTitle}
            </span>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2 p-3 overflow-x-auto border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <button
          onClick={() => setActiveCategory(null)}
          className={clsx(
            "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
            !activeCategory
              ? "bg-blue-600 text-white"
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
          )}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5",
              activeCategory === cat
                ? "bg-blue-600 text-white"
                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
            )}
          >
            <span>{getCategoryIcon(cat)}</span>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Template Selection Modal */}
      {selectedTemplate && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
              <span className="text-3xl">{selectedTemplate.icon}</span>
              <div>
                <h3 className="font-bold">{selectedTemplate.name}</h3>
                <p className="text-sm text-zinc-500">{selectedTemplate.description}</p>
              </div>
            </div>

            {/* Variables Form */}
            {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
              <div className="p-4 space-y-4">
                {selectedTemplate.variables.map(v => (
                  <div key={v.name}>
                    <label className="block text-sm font-medium mb-1">
                      {v.label}
                      {v.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {v.type === 'select' ? (
                      <select
                        value={variables[v.name] || v.default || ''}
                        onChange={e => setVariables({ ...variables, [v.name]: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                      >
                        <option value="">Select...</option>
                        {v.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={v.type}
                        value={variables[v.name] || v.default || ''}
                        onChange={e => setVariables({ ...variables, [v.name]: e.target.value })}
                        placeholder={v.label}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Modal Actions */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex gap-3">
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  setVariables({});
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
              >
                🚀 Start Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{template.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {template.name}
                    </h4>
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <span>⏱️</span>
                      {formatTime(template.estimatedTime)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {template.description}
                  </p>
                  {template.variables && template.variables.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {template.variables.map(v => (
                        <span 
                          key={v.name}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                        >
                          {v.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <div className="text-4xl mb-3">📋</div>
            <p>No templates in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkflowPanel;
