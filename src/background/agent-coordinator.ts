/**
 * Agent Coordinator
 * Manages multiple specialized agents with session cloning and inter-agent communication
 * Uses Chrome AI session management best practices
 */

export type AgentRole = 'researcher' | 'executor' | 'validator' | 'planner' | 'coordinator';

export interface AgentMessage {
  from: string;
  to: string;
  type: 'task' | 'result' | 'question' | 'info';
  content: any;
  timestamp: number;
}

export interface ManagedAgent {
  id: string;
  role: AgentRole;
  name: string;
  session: any; // Chrome AI session (cloned from base)
  status: 'idle' | 'busy' | 'waiting' | 'done' | 'error';
  currentTask?: string;
  inbox: AgentMessage[];
  outbox: AgentMessage[];
  memory: Map<string, any>; // Agent-specific memory
  createdAt: number;
}

export interface WorkflowStep {
  agent: AgentRole;
  task: string;
  input?: string; // Variable name from previous step
  output?: string; // Variable name for next step
  condition?: (context: Record<string, any>) => boolean; // Optional condition
  onError?: 'retry' | 'skip' | 'fail';
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  context: Record<string, any>; // Shared context between steps
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class AgentCoordinator {
  private agents: Map<string, ManagedAgent> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private baseSession: any = null; // Base session to clone from
  // private messageQueue: AgentMessage[] = [];
  private listeners: Set<(event: any) => void> = new Set();

  /**
   * Initialize with a base session (for cloning)
   */
  async initialize(createBaseSession: () => Promise<any>): Promise<void> {
    console.log('[AgentCoordinator] Initializing base session...');
    try {
      this.baseSession = await createBaseSession();
      console.log('[AgentCoordinator] Base session created');
    } catch (error) {
      console.error('[AgentCoordinator] Failed to create base session:', error);
      throw error;
    }
  }

  /**
   * Create a new agent with a cloned session
   */
  async createAgent(role: AgentRole, name?: string): Promise<string> {
    if (!this.baseSession) {
      throw new Error('Base session not initialized. Call initialize() first.');
    }

    const agentId = `agent-${role}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    console.log(`[AgentCoordinator] Creating ${role} agent:`, agentId);

    // Clone the base session for this agent
    let agentSession: any;
    try {
      // Try to clone if supported
      if (typeof this.baseSession.clone === 'function') {
        agentSession = await this.baseSession.clone();
        console.log(`[AgentCoordinator] Session cloned for ${agentId}`);
      } else {
        // Fallback: create new session with same config
        console.warn('[AgentCoordinator] Session cloning not supported, creating new session');
        // This would need to be provided by the caller
        agentSession = this.baseSession;
      }
    } catch (error) {
      console.error(`[AgentCoordinator] Failed to clone session for ${agentId}:`, error);
      throw error;
    }

    const agent: ManagedAgent = {
      id: agentId,
      role,
      name: name || `${role.charAt(0).toUpperCase() + role.slice(1)} Agent`,
      session: agentSession,
      status: 'idle',
      inbox: [],
      outbox: [],
      memory: new Map(),
      createdAt: Date.now()
    };

    this.agents.set(agentId, agent);
    this.notifyListeners({ type: 'agent_created', agent: this.getAgentInfo(agentId) });
    
    console.log(`[AgentCoordinator] Agent ${agentId} created with role: ${role}`);
    return agentId;
  }

  /**
   * Send a message between agents
   */
  sendMessage(from: string, to: string, type: AgentMessage['type'], content: any): void {
    const message: AgentMessage = {
      from,
      to,
      type,
      content,
      timestamp: Date.now()
    };

    const recipient = this.agents.get(to);
    if (recipient) {
      recipient.inbox.push(message);
      console.log(`[AgentCoordinator] Message from ${from} to ${to}:`, type);
      this.notifyListeners({ type: 'message_sent', message });
    } else {
      console.warn(`[AgentCoordinator] Recipient ${to} not found`);
    }
  }

  /**
   * Get messages for an agent
   */
  getMessages(agentId: string): AgentMessage[] {
    const agent = this.agents.get(agentId);
    return agent ? [...agent.inbox] : [];
  }

  /**
   * Clear inbox for an agent
   */
  clearInbox(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.inbox = [];
    }
  }

  /**
   * Execute a task with a specific agent
   */
  async executeWithAgent(agentId: string, task: string): Promise<any> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.status === 'busy') {
      throw new Error(`Agent ${agentId} is busy`);
    }

    agent.status = 'busy';
    agent.currentTask = task;
    this.notifyListeners({ type: 'agent_started', agentId, task });

    try {
      console.log(`[AgentCoordinator] Agent ${agentId} executing:`, task);
      
      // Build context-aware prompt with agent role
      const roleContext = this.getRoleContext(agent.role);
      const prompt = `${roleContext}\n\nTask: ${task}`;
      
      // Execute with the agent's session
      const response = await agent.session.prompt(prompt);
      const result = typeof response === 'string' ? response : response?.text || String(response);

      agent.status = 'done';
      agent.currentTask = undefined;
      
      this.notifyListeners({ type: 'agent_completed', agentId, result });
      console.log(`[AgentCoordinator] Agent ${agentId} completed`);
      
      return result;
    } catch (error: any) {
      agent.status = 'error';
      agent.currentTask = undefined;
      
      this.notifyListeners({ type: 'agent_error', agentId, error: error.message });
      console.error(`[AgentCoordinator] Agent ${agentId} error:`, error);
      
      throw error;
    }
  }

  /**
   * Get role-specific context for prompts
   */
  private getRoleContext(role: AgentRole): string {
    switch (role) {
      case 'researcher':
        return 'You are a Research Agent. Your job is to gather information, analyze data, and provide comprehensive findings. Focus on accuracy and thoroughness.';
      case 'executor':
        return 'You are an Executor Agent. Your job is to perform actions based on plans. Focus on precision and following instructions exactly.';
      case 'validator':
        return 'You are a Validator Agent. Your job is to verify results, check for errors, and ensure quality. Focus on critical evaluation.';
      case 'planner':
        return 'You are a Planner Agent. Your job is to create step-by-step plans to achieve goals. Focus on logical sequencing and efficiency.';
      case 'coordinator':
        return 'You are a Coordinator Agent. Your job is to manage other agents, delegate tasks, and ensure smooth collaboration. Focus on orchestration.';
      default:
        return 'You are a helpful AI agent.';
    }
  }

  /**
   * Create and execute a workflow
   */
  async executeWorkflow(workflow: Omit<Workflow, 'id' | 'currentStep' | 'status' | 'context'>): Promise<string> {
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const managedWorkflow: Workflow = {
      ...workflow,
      id: workflowId,
      currentStep: 0,
      status: 'pending',
      context: {}
    };

    this.workflows.set(workflowId, managedWorkflow);
    this.notifyListeners({ type: 'workflow_created', workflowId, workflow: managedWorkflow });

    // Start execution
    this.continueWorkflow(workflowId);

    return workflowId;
  }

  /**
   * Continue workflow execution
   */
  private async continueWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    if (workflow.currentStep >= workflow.steps.length) {
      workflow.status = 'completed';
      this.notifyListeners({ type: 'workflow_completed', workflowId, context: workflow.context });
      console.log(`[AgentCoordinator] Workflow ${workflowId} completed`);
      return;
    }

    workflow.status = 'running';
    const step = workflow.steps[workflow.currentStep];

    console.log(`[AgentCoordinator] Workflow ${workflowId} step ${workflow.currentStep}:`, step);

    // Check condition
    if (step.condition && !step.condition(workflow.context)) {
      console.log(`[AgentCoordinator] Step condition not met, skipping`);
      workflow.currentStep++;
      this.continueWorkflow(workflowId);
      return;
    }

    try {
      // Find or create agent for this role
      const agent = Array.from(this.agents.values()).find(a => a.role === step.agent && a.status === 'idle');
      const agentId = agent?.id || await this.createAgent(step.agent);

      // Prepare task with input from context
      let task = step.task;
      if (step.input && workflow.context[step.input]) {
        task += `\n\nInput data: ${JSON.stringify(workflow.context[step.input])}`;
      }

      // Execute
      const result = await this.executeWithAgent(agentId, task);

      // Store output in context
      if (step.output) {
        workflow.context[step.output] = result;
      }

      // Continue to next step
      workflow.currentStep++;
      this.continueWorkflow(workflowId);
    } catch (error: any) {
      console.error(`[AgentCoordinator] Workflow ${workflowId} error:`, error);
      
      if (step.onError === 'skip') {
        workflow.currentStep++;
        this.continueWorkflow(workflowId);
      } else if (step.onError === 'retry') {
        // Retry current step
        setTimeout(() => this.continueWorkflow(workflowId), 2000);
      } else {
        workflow.status = 'failed';
        this.notifyListeners({ type: 'workflow_failed', workflowId, error: error.message });
      }
    }
  }

  /**
   * Get workflow status
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): Array<ReturnType<typeof this.getAgentInfo>> {
    return Array.from(this.agents.values()).map(a => this.getAgentInfo(a.id));
  }

  /**
   * Get agent info (without session)
   */
  private getAgentInfo(agentId: string): any {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    return {
      id: agent.id,
      role: agent.role,
      name: agent.name,
      status: agent.status,
      currentTask: agent.currentTask,
      inboxCount: agent.inbox.length,
      createdAt: agent.createdAt
    };
  }

  /**
   * Destroy an agent
   */
  async destroyAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Close session if possible
    try {
      if (typeof agent.session?.close === 'function') {
        await agent.session.close();
      }
    } catch (error) {
      console.warn(`[AgentCoordinator] Error closing session for ${agentId}:`, error);
    }

    this.agents.delete(agentId);
    this.notifyListeners({ type: 'agent_destroyed', agentId });
    console.log(`[AgentCoordinator] Agent ${agentId} destroyed`);
  }

  /**
   * Subscribe to events
   */
  subscribe(listener: (event: any) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners(event: any): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[AgentCoordinator] Listener error:', error);
      }
    });
  }

  /**
   * Get base session (for quota checking, etc.)
   */
  getBaseSession(): any {
    return this.baseSession;
  }

  /**
   * Clear all agents and workflows
   */
  async cleanup(): Promise<void> {
    console.log('[AgentCoordinator] Cleaning up...');
    
    for (const [agentId] of this.agents) {
      await this.destroyAgent(agentId);
    }
    
    this.workflows.clear();
    // this.messageQueue = [];
    
    // Close base session
    if (this.baseSession && typeof this.baseSession.close === 'function') {
      try {
        await this.baseSession.close();
      } catch (error) {
        console.warn('[AgentCoordinator] Error closing base session:', error);
      }
    }
    
    this.baseSession = null;
    console.log('[AgentCoordinator] Cleanup complete');
  }
}

// Singleton instance
export const agentCoordinator = new AgentCoordinator();
