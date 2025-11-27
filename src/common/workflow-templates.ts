/**
 * Workflow Templates Service
 * Pre-built automations for common tasks
 * One-click solutions for shopping, research, job hunting, etc.
 */

import type { PanelIntent } from '../types/agent-types';

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  intent: PanelIntent | { type: 'CUSTOM'; action: string; params?: Record<string, any> };
  waitAfter?: number; // ms to wait after this step
  optional?: boolean;
  condition?: string; // condition to execute this step
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'shopping' | 'research' | 'productivity' | 'social' | 'job' | 'travel' | 'custom';
  tags: string[];
  steps: WorkflowStep[];
  estimatedTime: number; // seconds
  popularity: number;
  variables?: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select';
    required: boolean;
    options?: string[];
    default?: string;
  }[];
}

export interface WorkflowExecution {
  id: string;
  templateId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  startedAt: number;
  completedAt?: number;
  variables: Record<string, any>;
  results: { stepId: string; success: boolean; data?: any }[];
}

// Built-in workflow templates
const BUILT_IN_TEMPLATES: WorkflowTemplate[] = [
  // Shopping Templates
  {
    id: 'shopping-best-deal',
    name: 'Find Best Deal',
    description: 'Search for a product across multiple shopping sites and compare prices',
    icon: '🛒',
    category: 'shopping',
    tags: ['shopping', 'price', 'compare', 'deal'],
    estimatedTime: 60,
    popularity: 100,
    variables: [
      { name: 'product', label: 'Product to search for', type: 'text', required: true },
      { name: 'maxPrice', label: 'Maximum price ($)', type: 'number', required: false },
    ],
    steps: [
      {
        id: 'search-amazon',
        title: 'Search Amazon',
        intent: { type: 'SEARCH_WEB', query: '{{product}} site:amazon.com' },
        waitAfter: 3000,
      },
      {
        id: 'search-walmart',
        title: 'Search Walmart',
        intent: { type: 'SEARCH_WEB', query: '{{product}} site:walmart.com' },
        waitAfter: 3000,
      },
      {
        id: 'search-target',
        title: 'Search Target',
        intent: { type: 'SEARCH_WEB', query: '{{product}} site:target.com' },
        waitAfter: 3000,
      },
      {
        id: 'summarize',
        title: 'Compare prices',
        intent: { type: 'SUMMARY' },
      },
    ],
  },
  {
    id: 'shopping-price-history',
    name: 'Check Price History',
    description: 'Look up price history for a product to see if now is a good time to buy',
    icon: '📈',
    category: 'shopping',
    tags: ['price', 'history', 'camelcamelcamel'],
    estimatedTime: 30,
    popularity: 80,
    variables: [
      { name: 'product', label: 'Product name or Amazon URL', type: 'text', required: true },
    ],
    steps: [
      {
        id: 'search-camel',
        title: 'Check CamelCamelCamel',
        intent: { type: 'SEARCH_WEB', query: '{{product}} site:camelcamelcamel.com' },
        waitAfter: 2000,
      },
      {
        id: 'summarize-history',
        title: 'Summarize price history',
        intent: { type: 'SUMMARY' },
      },
    ],
  },

  // Research Templates
  {
    id: 'research-deep-dive',
    name: 'Deep Research',
    description: 'Comprehensive research on a topic with multiple sources',
    icon: '🔬',
    category: 'research',
    tags: ['research', 'study', 'learn', 'comprehensive'],
    estimatedTime: 120,
    popularity: 95,
    variables: [
      { name: 'topic', label: 'Research topic', type: 'text', required: true },
    ],
    steps: [
      {
        id: 'wiki',
        title: 'Wikipedia Overview',
        intent: { type: 'SEARCH_WEB', query: '{{topic}} site:wikipedia.org' },
        waitAfter: 3000,
      },
      {
        id: 'summarize-wiki',
        title: 'Summarize Wikipedia',
        intent: { type: 'SUMMARY' },
        waitAfter: 2000,
      },
      {
        id: 'academic',
        title: 'Search Academic Papers',
        intent: { type: 'SEARCH_WEB', query: '{{topic}} site:scholar.google.com OR site:arxiv.org' },
        waitAfter: 3000,
      },
      {
        id: 'news',
        title: 'Recent News',
        intent: { type: 'SEARCH_WEB', query: '{{topic}} news latest' },
        waitAfter: 3000,
      },
      {
        id: 'reddit',
        title: 'Reddit Discussions',
        intent: { type: 'SEARCH_WEB', query: '{{topic}} site:reddit.com' },
        waitAfter: 3000,
      },
    ],
  },
  {
    id: 'research-fact-check',
    name: 'Fact Check',
    description: 'Verify a claim using fact-checking websites',
    icon: '✅',
    category: 'research',
    tags: ['fact', 'check', 'verify', 'truth'],
    estimatedTime: 45,
    popularity: 75,
    variables: [
      { name: 'claim', label: 'Claim to verify', type: 'text', required: true },
    ],
    steps: [
      {
        id: 'snopes',
        title: 'Check Snopes',
        intent: { type: 'SEARCH_WEB', query: '{{claim}} site:snopes.com' },
        waitAfter: 2000,
      },
      {
        id: 'politifact',
        title: 'Check PolitiFact',
        intent: { type: 'SEARCH_WEB', query: '{{claim}} site:politifact.com' },
        waitAfter: 2000,
      },
      {
        id: 'factcheck',
        title: 'Check FactCheck.org',
        intent: { type: 'SEARCH_WEB', query: '{{claim}} site:factcheck.org' },
        waitAfter: 2000,
      },
    ],
  },

  // Job Search Templates
  {
    id: 'job-search-multi',
    name: 'Multi-Site Job Search',
    description: 'Search for jobs across LinkedIn, Indeed, and Glassdoor',
    icon: '💼',
    category: 'job',
    tags: ['job', 'career', 'employment', 'hiring'],
    estimatedTime: 90,
    popularity: 90,
    variables: [
      { name: 'title', label: 'Job title', type: 'text', required: true },
      { name: 'location', label: 'Location', type: 'text', required: false, default: 'Remote' },
    ],
    steps: [
      {
        id: 'linkedin',
        title: 'Search LinkedIn Jobs',
        intent: { type: 'OPEN_URL', url: 'https://www.linkedin.com/jobs/search/?keywords={{title}}&location={{location}}' },
        waitAfter: 5000,
      },
      {
        id: 'indeed',
        title: 'Search Indeed',
        intent: { type: 'OPEN_URL', url: 'https://www.indeed.com/jobs?q={{title}}&l={{location}}' },
        waitAfter: 5000,
      },
      {
        id: 'glassdoor',
        title: 'Search Glassdoor',
        intent: { type: 'SEARCH_WEB', query: '{{title}} {{location}} jobs site:glassdoor.com' },
        waitAfter: 5000,
      },
    ],
  },
  {
    id: 'job-company-research',
    name: 'Company Research',
    description: 'Research a company before an interview',
    icon: '🏢',
    category: 'job',
    tags: ['company', 'interview', 'research', 'preparation'],
    estimatedTime: 60,
    popularity: 85,
    variables: [
      { name: 'company', label: 'Company name', type: 'text', required: true },
    ],
    steps: [
      {
        id: 'website',
        title: 'Company Website',
        intent: { type: 'SEARCH_WEB', query: '{{company}} official website' },
        waitAfter: 3000,
      },
      {
        id: 'glassdoor-reviews',
        title: 'Glassdoor Reviews',
        intent: { type: 'SEARCH_WEB', query: '{{company}} reviews site:glassdoor.com' },
        waitAfter: 3000,
      },
      {
        id: 'linkedin-company',
        title: 'LinkedIn Company Page',
        intent: { type: 'SEARCH_WEB', query: '{{company}} site:linkedin.com/company' },
        waitAfter: 3000,
      },
      {
        id: 'news',
        title: 'Recent News',
        intent: { type: 'SEARCH_WEB', query: '{{company}} news latest' },
        waitAfter: 3000,
      },
      {
        id: 'summarize-all',
        title: 'Summarize findings',
        intent: { type: 'SUMMARY' },
      },
    ],
  },

  // Travel Templates
  {
    id: 'travel-flight-search',
    name: 'Find Flights',
    description: 'Search for flights across multiple booking sites',
    icon: '✈️',
    category: 'travel',
    tags: ['flight', 'travel', 'booking', 'airline'],
    estimatedTime: 60,
    popularity: 88,
    variables: [
      { name: 'from', label: 'From (city or airport code)', type: 'text', required: true },
      { name: 'to', label: 'To (city or airport code)', type: 'text', required: true },
      { name: 'date', label: 'Departure date', type: 'text', required: true },
    ],
    steps: [
      {
        id: 'google-flights',
        title: 'Google Flights',
        intent: { type: 'OPEN_URL', url: 'https://www.google.com/travel/flights?q=flights%20from%20{{from}}%20to%20{{to}}%20on%20{{date}}' },
        waitAfter: 5000,
      },
      {
        id: 'kayak',
        title: 'Search Kayak',
        intent: { type: 'SEARCH_WEB', query: 'flights {{from}} to {{to}} {{date}} site:kayak.com' },
        waitAfter: 4000,
      },
      {
        id: 'skyscanner',
        title: 'Search Skyscanner',
        intent: { type: 'SEARCH_WEB', query: 'flights {{from}} to {{to}} {{date}} site:skyscanner.com' },
        waitAfter: 4000,
      },
    ],
  },
  {
    id: 'travel-destination-research',
    name: 'Destination Research',
    description: 'Research a travel destination',
    icon: '🌴',
    category: 'travel',
    tags: ['travel', 'destination', 'vacation', 'trip'],
    estimatedTime: 90,
    popularity: 82,
    variables: [
      { name: 'destination', label: 'Destination', type: 'text', required: true },
    ],
    steps: [
      {
        id: 'wiki',
        title: 'Wikipedia Overview',
        intent: { type: 'SEARCH_WEB', query: '{{destination}} travel guide site:wikipedia.org' },
        waitAfter: 3000,
      },
      {
        id: 'tripadvisor',
        title: 'TripAdvisor Things to Do',
        intent: { type: 'SEARCH_WEB', query: '{{destination}} things to do site:tripadvisor.com' },
        waitAfter: 3000,
      },
      {
        id: 'reddit-travel',
        title: 'Reddit Travel Tips',
        intent: { type: 'SEARCH_WEB', query: '{{destination}} travel tips site:reddit.com/r/travel' },
        waitAfter: 3000,
      },
      {
        id: 'weather',
        title: 'Check Weather',
        intent: { type: 'SEARCH_WEB', query: '{{destination}} weather forecast' },
        waitAfter: 2000,
      },
    ],
  },

  // Productivity Templates
  {
    id: 'productivity-morning-routine',
    name: 'Morning Briefing',
    description: 'Quick overview of news, weather, and calendar',
    icon: '☀️',
    category: 'productivity',
    tags: ['morning', 'news', 'weather', 'routine'],
    estimatedTime: 45,
    popularity: 70,
    variables: [
      { name: 'location', label: 'Your city', type: 'text', required: true },
    ],
    steps: [
      {
        id: 'weather',
        title: 'Check Weather',
        intent: { type: 'SEARCH_WEB', query: '{{location}} weather today' },
        waitAfter: 2000,
      },
      {
        id: 'news',
        title: 'Top News',
        intent: { type: 'OPEN_URL', url: 'https://news.google.com' },
        waitAfter: 3000,
      },
      {
        id: 'calendar',
        title: 'Open Calendar',
        intent: { type: 'OPEN_URL', url: 'https://calendar.google.com' },
        waitAfter: 2000,
      },
    ],
  },
  {
    id: 'productivity-article-save',
    name: 'Save & Summarize Article',
    description: 'Summarize and save an article for later reading',
    icon: '📑',
    category: 'productivity',
    tags: ['save', 'summarize', 'article', 'read later'],
    estimatedTime: 20,
    popularity: 78,
    variables: [],
    steps: [
      {
        id: 'summarize',
        title: 'Summarize Article',
        intent: { type: 'SUMMARY' },
        waitAfter: 2000,
      },
      {
        id: 'save-memory',
        title: 'Save to Memory',
        intent: { type: 'CUSTOM', action: 'SAVE_TO_MEMORY' },
      },
    ],
  },
];

export class WorkflowTemplatesService {
  private static instance: WorkflowTemplatesService;
  private templates: WorkflowTemplate[] = [];
  private customTemplates: WorkflowTemplate[] = [];
  private currentExecution: WorkflowExecution | null = null;
  private executionHistory: WorkflowExecution[] = [];

  private constructor() {
    this.templates = [...BUILT_IN_TEMPLATES];
    this.loadCustomTemplates();
  }

  static getInstance(): WorkflowTemplatesService {
    if (!WorkflowTemplatesService.instance) {
      WorkflowTemplatesService.instance = new WorkflowTemplatesService();
    }
    return WorkflowTemplatesService.instance;
  }

  /**
   * Get all templates
   */
  getAll(): WorkflowTemplate[] {
    return [...this.templates, ...this.customTemplates]
      .sort((a, b) => b.popularity - a.popularity);
  }

  /**
   * Get templates by category
   */
  getByCategory(category: WorkflowTemplate['category']): WorkflowTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }

  /**
   * Search templates
   */
  search(query: string): WorkflowTemplate[] {
    const q = query.toLowerCase();
    return this.getAll().filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q))
    );
  }

  /**
   * Get a specific template
   */
  getTemplate(id: string): WorkflowTemplate | undefined {
    return this.getAll().find(t => t.id === id);
  }

  /**
   * Start executing a workflow
   */
  startExecution(
    templateId: string,
    variables: Record<string, any>
  ): WorkflowExecution {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    for (const variable of template.variables || []) {
      if (variable.required && !variables[variable.name]) {
        throw new Error(`Missing required variable: ${variable.label}`);
      }
    }

    const execution: WorkflowExecution = {
      id: crypto.randomUUID(),
      templateId,
      status: 'pending',
      currentStep: 0,
      startedAt: Date.now(),
      variables,
      results: [],
    };

    this.currentExecution = execution;
    return execution;
  }

  /**
   * Get current execution status
   */
  getCurrentExecution(): WorkflowExecution | null {
    return this.currentExecution;
  }

  /**
   * Get the next step's intent with variables substituted
   */
  getNextStep(execution: WorkflowExecution): {
    step: WorkflowStep;
    intent: PanelIntent | null;
  } | null {
    const template = this.getTemplate(execution.templateId);
    if (!template) return null;

    if (execution.currentStep >= template.steps.length) {
      return null;
    }

    const step = template.steps[execution.currentStep];
    const intent = this.substituteVariables(step.intent, execution.variables);

    return { step, intent };
  }

  /**
   * Mark current step as complete
   */
  completeStep(
    execution: WorkflowExecution,
    success: boolean,
    data?: any
  ): void {
    const template = this.getTemplate(execution.templateId);
    if (!template) return;

    const step = template.steps[execution.currentStep];
    execution.results.push({
      stepId: step.id,
      success,
      data,
    });

    execution.currentStep++;

    if (execution.currentStep >= template.steps.length) {
      execution.status = 'completed';
      execution.completedAt = Date.now();
      this.executionHistory.push(execution);
      this.currentExecution = null;
    }
  }

  /**
   * Cancel current execution
   */
  cancelExecution(): void {
    if (this.currentExecution) {
      this.currentExecution.status = 'failed';
      this.currentExecution.completedAt = Date.now();
      this.executionHistory.push(this.currentExecution);
      this.currentExecution = null;
    }
  }

  /**
   * Add a custom template
   */
  addCustomTemplate(template: Omit<WorkflowTemplate, 'id' | 'popularity'>): void {
    const newTemplate: WorkflowTemplate = {
      ...template,
      id: `custom-${crypto.randomUUID()}`,
      popularity: 50,
    };
    this.customTemplates.push(newTemplate);
    this.saveCustomTemplates();
  }

  /**
   * Get execution history
   */
  getHistory(): WorkflowExecution[] {
    return [...this.executionHistory].reverse();
  }

  /**
   * Get popular templates
   */
  getPopular(limit: number = 5): WorkflowTemplate[] {
    return this.getAll()
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  /**
   * Get categories with counts
   */
  getCategories(): { name: string; count: number; icon: string }[] {
    const icons: Record<string, string> = {
      shopping: '🛒',
      research: '🔬',
      productivity: '⚡',
      social: '👥',
      job: '💼',
      travel: '✈️',
      custom: '⚙️',
    };

    const counts = new Map<string, number>();
    for (const template of this.getAll()) {
      counts.set(template.category, (counts.get(template.category) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
      icon: icons[name] || '📋',
    }));
  }

  // Private helpers

  private substituteVariables(
    intent: WorkflowStep['intent'],
    variables: Record<string, any>
  ): PanelIntent | null {
    if (!intent) return null;
    
    // Handle custom actions
    if ('action' in intent && intent.type === 'CUSTOM') {
      return null; // Custom actions are handled separately
    }

    const intentCopy = { ...intent } as PanelIntent;
    
    // Substitute variables in string fields
    for (const [key, value] of Object.entries(intentCopy)) {
      if (typeof value === 'string') {
        (intentCopy as any)[key] = value.replace(
          /\{\{(\w+)\}\}/g,
          (_, varName) => encodeURIComponent(variables[varName] || '')
        );
      }
    }

    return intentCopy;
  }

  private async saveCustomTemplates(): Promise<void> {
    try {
      await chrome.storage.local.set({ customWorkflows: this.customTemplates });
    } catch (e) {
      console.error('[Workflows] Failed to save:', e);
    }
  }

  private async loadCustomTemplates(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('customWorkflows');
      if (result.customWorkflows) {
        this.customTemplates = result.customWorkflows;
      }
    } catch (e) {
      console.error('[Workflows] Failed to load:', e);
    }
  }
}

// Export singleton
export const workflowService = WorkflowTemplatesService.getInstance();
