/**
 * Quick Commands Service (Cmd+K style)
 * Universal command palette for fast browser actions
 * Inspired by Raycast, Alfred, and VS Code command palette
 */

import DOMPurify from 'dompurify';

export type CommandCategory = 
  | 'navigation'
  | 'action' 
  | 'ai'
  | 'memory'
  | 'template'
  | 'settings'
  | 'focus';

export interface QuickCommand {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  keywords: string[];
  icon: string;
  shortcut?: string;
  action: (args?: Record<string, any>) => Promise<void> | void;
  requiresInput?: boolean;
  inputPlaceholder?: string;
}

export interface CommandResult {
  command: QuickCommand;
  score: number;
}

// Built-in commands
const createBuiltInCommands = (handlers: CommandHandlers): QuickCommand[] => [
  // Navigation Commands
  {
    id: 'nav-new-tab',
    label: 'New Tab',
    description: 'Open a new browser tab',
    category: 'navigation',
    keywords: ['new', 'tab', 'open', 'create'],
    icon: '➕',
    shortcut: 'Ctrl+T',
    action: () => handlers.newTab(),
  },
  {
    id: 'nav-close-tab',
    label: 'Close Tab',
    description: 'Close the current tab',
    category: 'navigation',
    keywords: ['close', 'tab', 'exit', 'remove'],
    icon: '✖️',
    shortcut: 'Ctrl+W',
    action: () => handlers.closeTab(),
  },
  {
    id: 'nav-go-back',
    label: 'Go Back',
    description: 'Navigate to the previous page',
    category: 'navigation',
    keywords: ['back', 'previous', 'history'],
    icon: '⬅️',
    action: () => handlers.goBack(),
  },
  {
    id: 'nav-go-forward',
    label: 'Go Forward',
    description: 'Navigate to the next page',
    category: 'navigation',
    keywords: ['forward', 'next', 'history'],
    icon: '➡️',
    action: () => handlers.goForward(),
  },
  {
    id: 'nav-refresh',
    label: 'Refresh Page',
    description: 'Reload the current page',
    category: 'navigation',
    keywords: ['refresh', 'reload', 'update'],
    icon: '🔄',
    shortcut: 'Ctrl+R',
    action: () => handlers.refresh(),
  },
  {
    id: 'nav-scroll-top',
    label: 'Scroll to Top',
    description: 'Scroll to the top of the page',
    category: 'navigation',
    keywords: ['scroll', 'top', 'beginning', 'start'],
    icon: '⬆️',
    action: () => handlers.scrollTop(),
  },
  {
    id: 'nav-scroll-bottom',
    label: 'Scroll to Bottom',
    description: 'Scroll to the bottom of the page',
    category: 'navigation',
    keywords: ['scroll', 'bottom', 'end'],
    icon: '⬇️',
    action: () => handlers.scrollBottom(),
  },

  // Action Commands
  {
    id: 'action-copy-url',
    label: 'Copy URL',
    description: 'Copy the current page URL to clipboard',
    category: 'action',
    keywords: ['copy', 'url', 'link', 'clipboard'],
    icon: '📋',
    action: () => handlers.copyUrl(),
  },
  {
    id: 'action-screenshot',
    label: 'Take Screenshot',
    description: 'Capture a screenshot of the current page',
    category: 'action',
    keywords: ['screenshot', 'capture', 'image', 'photo'],
    icon: '📸',
    action: () => handlers.takeScreenshot(),
  },
  {
    id: 'action-print',
    label: 'Print Page',
    description: 'Open print dialog for the current page',
    category: 'action',
    keywords: ['print', 'pdf', 'save'],
    icon: '🖨️',
    action: () => handlers.printPage(),
  },
  {
    id: 'action-find',
    label: 'Find on Page',
    description: 'Search for text on the current page',
    category: 'action',
    keywords: ['find', 'search', 'text', 'ctrl+f'],
    icon: '🔍',
    shortcut: 'Ctrl+F',
    action: () => handlers.findOnPage(),
  },

  // AI Commands
  {
    id: 'ai-summarize',
    label: 'Summarize Page',
    description: 'Get an AI summary of the current page',
    category: 'ai',
    keywords: ['summarize', 'summary', 'tldr', 'explain'],
    icon: '✨',
    action: () => handlers.summarizePage(),
  },
  {
    id: 'ai-ask',
    label: 'Ask AI',
    description: 'Ask a question about the current page',
    category: 'ai',
    keywords: ['ask', 'question', 'ai', 'help'],
    icon: '💬',
    requiresInput: true,
    inputPlaceholder: 'Ask a question...',
    action: (args) => handlers.askAI(args?.input || ''),
  },
  {
    id: 'ai-translate',
    label: 'Translate Page',
    description: 'Translate the page to another language',
    category: 'ai',
    keywords: ['translate', 'language', 'convert'],
    icon: '🌐',
    requiresInput: true,
    inputPlaceholder: 'Target language (e.g., Spanish)',
    action: (args) => handlers.translatePage(args?.input || 'English'),
  },
  {
    id: 'ai-explain',
    label: 'Explain Selection',
    description: 'Explain the selected text',
    category: 'ai',
    keywords: ['explain', 'clarify', 'understand', 'define'],
    icon: '📖',
    action: () => handlers.explainSelection(),
  },

  // Memory Commands
  {
    id: 'memory-search',
    label: 'Search Memory',
    description: 'Search pages you have visited',
    category: 'memory',
    keywords: ['memory', 'search', 'history', 'find', 'recall'],
    icon: '🧠',
    requiresInput: true,
    inputPlaceholder: 'Search your browsing memory...',
    action: (args) => handlers.searchMemory(args?.input || ''),
  },
  {
    id: 'memory-recent',
    label: 'Recent Pages',
    description: 'View recently visited pages',
    category: 'memory',
    keywords: ['recent', 'history', 'visited', 'past'],
    icon: '🕐',
    action: () => handlers.showRecentPages(),
  },
  {
    id: 'memory-stats',
    label: 'Browsing Stats',
    description: 'View your browsing statistics',
    category: 'memory',
    keywords: ['stats', 'statistics', 'analytics', 'usage'],
    icon: '📊',
    action: () => handlers.showStats(),
  },

  // Template Commands
  {
    id: 'template-shopping',
    label: 'Shopping Assistant',
    description: 'Find the best deals across sites',
    category: 'template',
    keywords: ['shop', 'shopping', 'buy', 'price', 'deal'],
    icon: '🛒',
    requiresInput: true,
    inputPlaceholder: 'What are you looking for?',
    action: (args) => handlers.startShoppingFlow(args?.input || ''),
  },
  {
    id: 'template-research',
    label: 'Research Mode',
    description: 'Start a focused research session',
    category: 'template',
    keywords: ['research', 'study', 'learn', 'explore'],
    icon: '🔬',
    requiresInput: true,
    inputPlaceholder: 'Research topic...',
    action: (args) => handlers.startResearchFlow(args?.input || ''),
  },
  {
    id: 'template-compare',
    label: 'Compare Products',
    description: 'Compare products across tabs',
    category: 'template',
    keywords: ['compare', 'versus', 'vs', 'difference'],
    icon: '⚖️',
    action: () => handlers.startCompareFlow(),
  },
  {
    id: 'template-job-search',
    label: 'Job Search',
    description: 'Search for jobs across multiple sites',
    category: 'template',
    keywords: ['job', 'career', 'work', 'employment', 'hiring'],
    icon: '💼',
    requiresInput: true,
    inputPlaceholder: 'Job title or keywords...',
    action: (args) => handlers.startJobSearchFlow(args?.input || ''),
  },

  // Focus Mode Commands
  {
    id: 'focus-enable',
    label: 'Enable Focus Mode',
    description: 'Block distracting sites',
    category: 'focus',
    keywords: ['focus', 'concentrate', 'block', 'distraction'],
    icon: '🎯',
    action: () => handlers.enableFocusMode(),
  },
  {
    id: 'focus-disable',
    label: 'Disable Focus Mode',
    description: 'Disable focus mode',
    category: 'focus',
    keywords: ['unfocus', 'disable', 'allow'],
    icon: '🔓',
    action: () => handlers.disableFocusMode(),
  },
  {
    id: 'focus-reading',
    label: 'Reading Mode',
    description: 'Enter distraction-free reading mode',
    category: 'focus',
    keywords: ['read', 'reading', 'clean', 'simple'],
    icon: '📚',
    action: () => handlers.enableReadingMode(),
  },

  // Settings Commands
  {
    id: 'settings-voice',
    label: 'Toggle Voice Mode',
    description: 'Enable/disable voice commands',
    category: 'settings',
    keywords: ['voice', 'speech', 'microphone', 'talk'],
    icon: '🎤',
    action: () => handlers.toggleVoice(),
  },
  {
    id: 'settings-theme',
    label: 'Toggle Dark Mode',
    description: 'Switch between light and dark theme',
    category: 'settings',
    keywords: ['theme', 'dark', 'light', 'mode'],
    icon: '🌙',
    action: () => handlers.toggleTheme(),
  },
];

export interface CommandHandlers {
  // Navigation
  newTab: () => void;
  closeTab: () => void;
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
  scrollTop: () => void;
  scrollBottom: () => void;
  
  // Actions
  copyUrl: () => void;
  takeScreenshot: () => void;
  printPage: () => void;
  findOnPage: () => void;
  
  // AI
  summarizePage: () => void;
  askAI: (question: string) => void;
  translatePage: (language: string) => void;
  explainSelection: () => void;
  
  // Memory
  searchMemory: (query: string) => void;
  showRecentPages: () => void;
  showStats: () => void;
  
  // Templates
  startShoppingFlow: (query: string) => void;
  startResearchFlow: (topic: string) => void;
  startCompareFlow: () => void;
  startJobSearchFlow: (query: string) => void;
  
  // Focus
  enableFocusMode: () => void;
  disableFocusMode: () => void;
  enableReadingMode: () => void;
  
  // Settings
  toggleVoice: () => void;
  toggleTheme: () => void;
}

export class QuickCommandsService {
  private commands: QuickCommand[] = [];
  private customCommands: QuickCommand[] = [];
  private recentCommands: string[] = [];
  private maxRecent: number = 5;

  constructor(handlers: CommandHandlers) {
    this.commands = createBuiltInCommands(handlers);
    this.loadCustomCommands();
    this.loadRecentCommands();
  }

  /**
   * Search commands by query
   */
  search(query: string): CommandResult[] {
    const sanitizedQuery = DOMPurify.sanitize(query).toLowerCase().trim();
    
    if (!sanitizedQuery) {
      // Return recent commands + popular commands
      return this.getDefaultResults();
    }

    const allCommands = [...this.commands, ...this.customCommands];
    const results: CommandResult[] = [];

    for (const command of allCommands) {
      const score = this.calculateScore(command, sanitizedQuery);
      if (score > 0) {
        results.push({ command, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Execute a command
   */
  async execute(commandId: string, args?: Record<string, any>): Promise<void> {
    const command = this.findCommand(commandId);
    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    // Track recent usage
    this.addToRecent(commandId);

    // Execute
    await command.action(args);
  }

  /**
   * Get command by ID
   */
  findCommand(id: string): QuickCommand | undefined {
    return [...this.commands, ...this.customCommands].find(c => c.id === id);
  }

  /**
   * Add a custom command
   */
  addCustomCommand(command: QuickCommand): void {
    this.customCommands.push(command);
    this.saveCustomCommands();
  }

  /**
   * Get commands by category
   */
  getByCategory(category: CommandCategory): QuickCommand[] {
    return [...this.commands, ...this.customCommands].filter(c => c.category === category);
  }

  /**
   * Get all categories
   */
  getCategories(): { name: CommandCategory; count: number; icon: string }[] {
    const categoryIcons: Record<CommandCategory, string> = {
      navigation: '🧭',
      action: '⚡',
      ai: '✨',
      memory: '🧠',
      template: '📋',
      settings: '⚙️',
      focus: '🎯',
    };

    const counts = new Map<CommandCategory, number>();
    for (const command of [...this.commands, ...this.customCommands]) {
      counts.set(command.category, (counts.get(command.category) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
      icon: categoryIcons[name],
    }));
  }

  // Private helpers

  private calculateScore(command: QuickCommand, query: string): number {
    let score = 0;
    const queryWords = query.split(/\s+/);

    // Exact label match
    if (command.label.toLowerCase() === query) {
      score += 100;
    }
    // Label starts with query
    else if (command.label.toLowerCase().startsWith(query)) {
      score += 80;
    }
    // Label contains query
    else if (command.label.toLowerCase().includes(query)) {
      score += 50;
    }

    // Keyword matches
    for (const keyword of command.keywords) {
      for (const word of queryWords) {
        if (keyword.startsWith(word)) {
          score += 30;
        } else if (keyword.includes(word)) {
          score += 15;
        }
      }
    }

    // Description match
    if (command.description?.toLowerCase().includes(query)) {
      score += 10;
    }

    // Boost for recent usage
    const recentIndex = this.recentCommands.indexOf(command.id);
    if (recentIndex !== -1) {
      score += (this.maxRecent - recentIndex) * 5;
    }

    return score;
  }

  private getDefaultResults(): CommandResult[] {
    const results: CommandResult[] = [];
    
    // Add recent commands first
    for (let i = 0; i < this.recentCommands.length; i++) {
      const command = this.findCommand(this.recentCommands[i]);
      if (command) {
        results.push({ command, score: 100 - i * 10 });
      }
    }

    // Add some popular commands
    const popular = ['ai-summarize', 'memory-search', 'focus-enable', 'template-shopping'];
    for (const id of popular) {
      if (!this.recentCommands.includes(id)) {
        const command = this.findCommand(id);
        if (command) {
          results.push({ command, score: 50 });
        }
      }
    }

    return results;
  }

  private addToRecent(commandId: string): void {
    this.recentCommands = [
      commandId,
      ...this.recentCommands.filter(id => id !== commandId)
    ].slice(0, this.maxRecent);
    
    this.saveRecentCommands();
  }

  private async saveCustomCommands(): Promise<void> {
    try {
      // Note: We can't serialize functions, so only save metadata
      const serializable = this.customCommands.map(c => ({
        id: c.id,
        label: c.label,
        description: c.description,
        category: c.category,
        keywords: c.keywords,
        icon: c.icon,
      }));
      await chrome.storage.local.set({ customCommands: serializable });
    } catch (e) {
      console.error('[Commands] Failed to save:', e);
    }
  }

  private async loadCustomCommands(): Promise<void> {
    try {
      await chrome.storage.local.get('customCommands');
      // Custom commands with actions would need to be recreated
      // For now, we just load metadata
    } catch (e) {
      console.error('[Commands] Failed to load:', e);
    }
  }

  private async saveRecentCommands(): Promise<void> {
    try {
      await chrome.storage.local.set({ recentCommands: this.recentCommands });
    } catch (e) {
      console.error('[Commands] Failed to save recent:', e);
    }
  }

  private async loadRecentCommands(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('recentCommands');
      if (result.recentCommands) {
        this.recentCommands = result.recentCommands;
      }
    } catch (e) {
      console.error('[Commands] Failed to load recent:', e);
    }
  }
}
