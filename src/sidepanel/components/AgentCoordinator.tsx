import { useState } from 'react';
import clsx from 'clsx';
import type { AgentRole } from '../../background/agent-coordinator';

interface AgentInfo {
  id: string;
  role: AgentRole;
  name: string;
  status: 'idle' | 'busy' | 'waiting' | 'done' | 'error';
  currentTask?: string;
  inboxCount: number;
  createdAt: number;
}

interface WorkflowDef {
  name: string;
  description: string;
  template: Array<{ agent: AgentRole; task: string }>;
}

const WORKFLOW_TEMPLATES: WorkflowDef[] = [
  {
    name: 'Research & Execute',
    description: 'Research a topic then execute actions',
    template: [
      { agent: 'researcher', task: 'Research: {query}' },
      { agent: 'planner', task: 'Create action plan based on research' },
      { agent: 'executor', task: 'Execute the plan' },
      { agent: 'validator', task: 'Validate results' }
    ]
  },
  {
    name: 'Comparative Analysis',
    description: 'Compare multiple options and recommend best',
    template: [
      { agent: 'researcher', task: 'Find options for: {query}' },
      { agent: 'researcher', task: 'Analyze pros and cons' },
      { agent: 'validator', task: 'Rank options by criteria' }
    ]
  },
  {
    name: 'Quality Assurance',
    description: 'Execute task with validation',
    template: [
      { agent: 'executor', task: 'Execute: {query}' },
      { agent: 'validator', task: 'Verify execution quality' },
      { agent: 'researcher', task: 'Suggest improvements if needed' }
    ]
  }
];

interface AgentCoordinatorPanelProps {
  agents: AgentInfo[];
  onCreateAgent: (role: AgentRole) => void;
  onDestroyAgent: (agentId: string) => void;
  onExecuteWorkflow: (workflowDef: WorkflowDef, query: string) => void;
}

export function AgentCoordinatorPanel({ 
  agents, 
  onCreateAgent, 
  onDestroyAgent,
  onExecuteWorkflow 
}: AgentCoordinatorPanelProps) {
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AgentRole>('researcher');
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDef | null>(null);
  const [workflowQuery, setWorkflowQuery] = useState('');

  const getRoleIcon = (role: AgentRole): string => {
    switch (role) {
      case 'researcher': return '🔍';
      case 'executor': return '⚙️';
      case 'validator': return '✓';
      case 'planner': return '📋';
      case 'coordinator': return '🎯';
      default: return '🤖';
    }
  };

  const getStatusColor = (status: AgentInfo['status']): string => {
    switch (status) {
      case 'idle': return 'bg-gray-400 dark:bg-gray-600';
      case 'busy': return 'bg-blue-500 animate-pulse';
      case 'waiting': return 'bg-yellow-500';
      case 'done': return 'bg-green-500';
      case 'error': return 'bg-red-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Multi-Agent System
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} active
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowWorkflows(!showWorkflows)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-sm transition-all"
          >
            🚀 Run Workflow
          </button>
          <button
            onClick={() => setShowCreateAgent(!showCreateAgent)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-sm transition-all"
          >
            + Create Agent
          </button>
        </div>
      </div>

      {/* Create Agent Form */}
      {showCreateAgent && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Select Agent Role
          </h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(['researcher', 'executor', 'validator', 'planner', 'coordinator'] as AgentRole[]).map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={clsx(
                  "p-3 rounded-lg border-2 transition-all text-left",
                  selectedRole === role
                    ? "border-blue-500 bg-blue-100 dark:bg-blue-900/30"
                    : "border-zinc-300 dark:border-zinc-600 hover:border-blue-300"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{getRoleIcon(role)}</span>
                  <span className="text-sm font-semibold capitalize">{role}</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {role === 'researcher' && 'Gathers information'}
                  {role === 'executor' && 'Performs actions'}
                  {role === 'validator' && 'Checks quality'}
                  {role === 'planner' && 'Creates plans'}
                  {role === 'coordinator' && 'Manages agents'}
                </p>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              onCreateAgent(selectedRole);
              setShowCreateAgent(false);
            }}
            className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium text-sm hover:from-blue-600 hover:to-cyan-600 transition-all"
          >
            Create {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Agent
          </button>
        </div>
      )}

      {/* Workflow Selector */}
      {showWorkflows && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Select Workflow Template
          </h4>
          <div className="space-y-2 mb-3">
            {WORKFLOW_TEMPLATES.map((workflow, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedWorkflow(workflow)}
                className={clsx(
                  "w-full p-3 rounded-lg border-2 transition-all text-left",
                  selectedWorkflow?.name === workflow.name
                    ? "border-indigo-500 bg-indigo-100 dark:bg-indigo-900/30"
                    : "border-zinc-300 dark:border-zinc-600 hover:border-indigo-300"
                )}
              >
                <div className="font-semibold text-sm mb-1">{workflow.name}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                  {workflow.description}
                </div>
                <div className="flex gap-1">
                  {workflow.template.map((step, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">
                      {getRoleIcon(step.agent)}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {selectedWorkflow && (
            <div className="space-y-2">
              <input
                type="text"
                value={workflowQuery}
                onChange={(e) => setWorkflowQuery(e.target.value)}
                placeholder="Enter your query..."
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
              />
              <button
                onClick={() => {
                  if (selectedWorkflow && workflowQuery.trim()) {
                    onExecuteWorkflow(selectedWorkflow, workflowQuery);
                    setShowWorkflows(false);
                    setWorkflowQuery('');
                    setSelectedWorkflow(null);
                  }
                }}
                disabled={!workflowQuery.trim()}
                className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium text-sm hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Run {selectedWorkflow.name}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Agent List */}
      {agents.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
          <div className="text-4xl mb-2">🤖</div>
          <p>No agents created yet</p>
          <p className="text-xs mt-1">Create specialized agents to handle complex tasks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {agents.map(agent => (
            <div
              key={agent.id}
              className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getRoleIcon(agent.role)}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {agent.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={clsx("w-2 h-2 rounded-full", getStatusColor(agent.status))}></span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                          {agent.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  {agent.currentTask && (
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-700/50 rounded px-2 py-1 mb-2">
                      {agent.currentTask}
                    </div>
                  )}
                  {agent.inboxCount > 0 && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      📬 {agent.inboxCount} message{agent.inboxCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDestroyAgent(agent.id)}
                  className="px-2 py-1 rounded-md text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  title="Destroy agent"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
