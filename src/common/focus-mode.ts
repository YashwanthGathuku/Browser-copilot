/**
 * Focus Mode Service
 * Blocks distracting sites and tracks productivity
 * Includes Reading Mode for distraction-free reading
 */

export interface FocusSession {
  id: string;
  startTime: number;
  endTime?: number;
  duration: number;
  blockedAttempts: number;
  productiveTime: number;
  sites: { domain: string; time: number }[];
}

export interface FocusConfig {
  enabled: boolean;
  blockedSites: string[];
  allowedSites: string[];
  breakReminder: number; // minutes
  sessionDuration: number; // minutes
  strictMode: boolean; // no override option
  blockNewTabs: boolean;
  showMotivation: boolean;
}

export interface ReadingModeConfig {
  enabled: boolean;
  fontSize: number; // 14-24
  lineHeight: number; // 1.4-2.0
  maxWidth: number; // 600-900
  theme: 'light' | 'sepia' | 'dark';
  fontFamily: 'serif' | 'sans-serif' | 'mono';
}

const DEFAULT_BLOCKED_SITES = [
  'twitter.com', 'x.com',
  'facebook.com', 'instagram.com',
  'tiktok.com',
  'reddit.com',
  'youtube.com',
  'netflix.com',
  'twitch.tv',
  'discord.com',
];

const MOTIVATIONAL_QUOTES = [
  "Stay focused! You're doing great. 💪",
  "Every minute of focus is a step towards your goal. 🎯",
  "The secret of getting ahead is getting started. 🚀",
  "Focus on being productive, not busy. ⚡",
  "Small steps lead to big changes. 🌟",
  "You're stronger than distractions! 💎",
  "Deep work creates deep value. 🧠",
  "Protect your attention like it's precious. Because it is. 💰",
];

export class FocusModeService {
  private static instance: FocusModeService;
  private config: FocusConfig;
  private readingConfig: ReadingModeConfig;
  private currentSession: FocusSession | null = null;
  private breakTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<(event: FocusEvent) => void> = new Set();

  private constructor() {
    this.config = {
      enabled: false,
      blockedSites: [...DEFAULT_BLOCKED_SITES],
      allowedSites: [],
      breakReminder: 25, // Pomodoro-style
      sessionDuration: 0, // 0 = no limit
      strictMode: false,
      blockNewTabs: false,
      showMotivation: true,
    };

    this.readingConfig = {
      enabled: false,
      fontSize: 18,
      lineHeight: 1.7,
      maxWidth: 700,
      theme: 'light',
      fontFamily: 'serif',
    };

    this.loadConfig();
  }

  static getInstance(): FocusModeService {
    if (!FocusModeService.instance) {
      FocusModeService.instance = new FocusModeService();
    }
    return FocusModeService.instance;
  }

  /**
   * Enable focus mode
   */
  enable(sessionDuration?: number): FocusSession {
    if (this.config.enabled && this.currentSession) {
      return this.currentSession;
    }

    this.config.enabled = true;
    this.currentSession = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      duration: 0,
      blockedAttempts: 0,
      productiveTime: 0,
      sites: [],
    };

    // Set up break reminder
    if (this.config.breakReminder > 0) {
      this.breakTimer = setTimeout(() => {
        this.emit('break-reminder', { 
          message: "Time for a short break! Stand up, stretch, hydrate. 🧘" 
        });
      }, this.config.breakReminder * 60 * 1000);
    }

    // Set up session limit
    if (sessionDuration || this.config.sessionDuration > 0) {
      const duration = sessionDuration || this.config.sessionDuration;
      this.sessionTimer = setTimeout(() => {
        this.disable();
        this.emit('session-end', { 
          message: "Focus session complete! Great work! 🎉",
          session: this.currentSession 
        });
      }, duration * 60 * 1000);
    }

    this.saveConfig();
    this.emit('enabled', { session: this.currentSession });

    return this.currentSession;
  }

  /**
   * Disable focus mode
   */
  disable(): FocusSession | null {
    if (!this.config.enabled || !this.currentSession) {
      return null;
    }

    this.config.enabled = false;
    this.currentSession.endTime = Date.now();
    this.currentSession.duration = Date.now() - this.currentSession.startTime;

    // Clear timers
    if (this.breakTimer) {
      clearTimeout(this.breakTimer);
      this.breakTimer = null;
    }
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }

    const session = this.currentSession;
    this.currentSession = null;

    this.saveSession(session);
    this.saveConfig();
    this.emit('disabled', { session });

    return session;
  }

  /**
   * Check if a URL should be blocked
   */
  shouldBlock(url: string): { blocked: boolean; reason?: string } {
    if (!this.config.enabled) {
      return { blocked: false };
    }

    try {
      const hostname = new URL(url).hostname.replace('www.', '');

      // Check allowed sites first
      if (this.config.allowedSites.some(site => hostname.includes(site))) {
        return { blocked: false };
      }

      // Check blocked sites
      if (this.config.blockedSites.some(site => hostname.includes(site))) {
        if (this.currentSession) {
          this.currentSession.blockedAttempts++;
        }
        
        return { 
          blocked: true, 
          reason: this.config.showMotivation 
            ? MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
            : 'This site is blocked during focus mode.'
        };
      }

      return { blocked: false };
    } catch {
      return { blocked: false };
    }
  }

  /**
   * Add a site to the block list
   */
  addBlockedSite(site: string): void {
    const normalized = site.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    if (!this.config.blockedSites.includes(normalized)) {
      this.config.blockedSites.push(normalized);
      this.saveConfig();
    }
  }

  /**
   * Remove a site from the block list
   */
  removeBlockedSite(site: string): void {
    this.config.blockedSites = this.config.blockedSites.filter(s => s !== site);
    this.saveConfig();
  }

  /**
   * Add a site to the allow list
   */
  addAllowedSite(site: string): void {
    const normalized = site.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    if (!this.config.allowedSites.includes(normalized)) {
      this.config.allowedSites.push(normalized);
      this.saveConfig();
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    enabled: boolean;
    session: FocusSession | null;
    config: FocusConfig;
    elapsedTime: number;
    blockedCount: number;
  } {
    return {
      enabled: this.config.enabled,
      session: this.currentSession,
      config: { ...this.config },
      elapsedTime: this.currentSession 
        ? Date.now() - this.currentSession.startTime 
        : 0,
      blockedCount: this.currentSession?.blockedAttempts || 0,
    };
  }

  /**
   * Get session history
   */
  async getHistory(days: number = 7): Promise<FocusSession[]> {
    try {
      const result = await chrome.storage.local.get('focusSessions');
      const sessions: FocusSession[] = result.focusSessions || [];
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return sessions.filter(s => s.startTime > cutoff);
    } catch {
      return [];
    }
  }

  /**
   * Get productivity stats
   */
  async getStats(days: number = 7): Promise<{
    totalSessions: number;
    totalTime: number;
    averageSession: number;
    blockedAttempts: number;
    streak: number;
  }> {
    const sessions = await this.getHistory(days);
    
    const totalTime = sessions.reduce((sum, s) => sum + s.duration, 0);
    const blockedAttempts = sessions.reduce((sum, s) => sum + s.blockedAttempts, 0);
    
    // Calculate streak (consecutive days with focus sessions)
    const today = new Date().setHours(0, 0, 0, 0);
    const sessionDays = new Set(
      sessions.map(s => new Date(s.startTime).setHours(0, 0, 0, 0))
    );
    
    let streak = 0;
    for (let i = 0; i < days; i++) {
      const day = today - i * 24 * 60 * 60 * 1000;
      if (sessionDays.has(day)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return {
      totalSessions: sessions.length,
      totalTime,
      averageSession: sessions.length > 0 ? totalTime / sessions.length : 0,
      blockedAttempts,
      streak,
    };
  }

  // Reading Mode

  /**
   * Enable reading mode on the current page
   */
  enableReadingMode(): void {
    this.readingConfig.enabled = true;
    this.emit('reading-mode-enabled', { config: this.readingConfig });
    this.saveConfig();
  }

  /**
   * Disable reading mode
   */
  disableReadingMode(): void {
    this.readingConfig.enabled = false;
    this.emit('reading-mode-disabled', {});
    this.saveConfig();
  }

  /**
   * Get reading mode config
   */
  getReadingConfig(): ReadingModeConfig {
    return { ...this.readingConfig };
  }

  /**
   * Update reading mode config
   */
  updateReadingConfig(updates: Partial<ReadingModeConfig>): void {
    this.readingConfig = { ...this.readingConfig, ...updates };
    this.emit('reading-config-updated', { config: this.readingConfig });
    this.saveConfig();
  }

  /**
   * Generate reading mode CSS
   */
  getReadingModeCSS(): string {
    const { fontSize, lineHeight, maxWidth, theme, fontFamily } = this.readingConfig;
    
    const themes = {
      light: { bg: '#ffffff', text: '#1a1a1a', accent: '#0066cc' },
      sepia: { bg: '#f4ecd8', text: '#5b4636', accent: '#704214' },
      dark: { bg: '#1a1a1a', text: '#e0e0e0', accent: '#66b3ff' },
    };

    const fonts = {
      serif: 'Georgia, "Times New Roman", serif',
      'sans-serif': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"SF Mono", Monaco, "Consolas", monospace',
    };

    const t = themes[theme];
    const f = fonts[fontFamily];

    return `
      body {
        background: ${t.bg} !important;
        color: ${t.text} !important;
      }

      #nano-reading-mode {
        max-width: ${maxWidth}px !important;
        margin: 0 auto !important;
        padding: 40px 20px !important;
        font-size: ${fontSize}px !important;
        line-height: ${lineHeight} !important;
        font-family: ${f} !important;
        background: ${t.bg} !important;
        color: ${t.text} !important;
      }

      #nano-reading-mode a {
        color: ${t.accent} !important;
      }

      #nano-reading-mode img {
        max-width: 100% !important;
        height: auto !important;
        margin: 1em 0 !important;
      }

      #nano-reading-mode h1, 
      #nano-reading-mode h2, 
      #nano-reading-mode h3 {
        margin-top: 1.5em !important;
        margin-bottom: 0.5em !important;
        line-height: 1.3 !important;
      }

      #nano-reading-mode p {
        margin-bottom: 1em !important;
      }

      #nano-reading-mode pre, 
      #nano-reading-mode code {
        font-family: ${fonts.mono} !important;
        background: ${theme === 'dark' ? '#2a2a2a' : '#f5f5f5'} !important;
        padding: 0.2em 0.4em !important;
        border-radius: 3px !important;
      }

      #nano-reading-mode blockquote {
        border-left: 3px solid ${t.accent} !important;
        padding-left: 1em !important;
        margin: 1em 0 !important;
        opacity: 0.8 !important;
      }

      /* Hide non-content elements */
      header, footer, nav, aside, .ad, .advertisement, 
      .sidebar, .comments, .social-share, .related-posts,
      [role="banner"], [role="navigation"], [role="complementary"] {
        display: none !important;
      }
    `;
  }

  // Event system

  subscribe(callback: (event: FocusEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(type: string, data: any): void {
    const event = { type, ...data, timestamp: Date.now() };
    this.listeners.forEach(cb => {
      try { cb(event); } catch (e) { console.error('[Focus] Listener error:', e); }
    });
  }

  // Storage

  private async saveConfig(): Promise<void> {
    try {
      await chrome.storage.local.set({
        focusConfig: this.config,
        readingConfig: this.readingConfig,
      });
    } catch (e) {
      console.error('[Focus] Failed to save config:', e);
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['focusConfig', 'readingConfig']);
      if (result.focusConfig) {
        this.config = { ...this.config, ...result.focusConfig };
      }
      if (result.readingConfig) {
        this.readingConfig = { ...this.readingConfig, ...result.readingConfig };
      }
    } catch (e) {
      console.error('[Focus] Failed to load config:', e);
    }
  }

  private async saveSession(session: FocusSession): Promise<void> {
    try {
      const result = await chrome.storage.local.get('focusSessions');
      const sessions: FocusSession[] = result.focusSessions || [];
      sessions.push(session);
      
      // Keep only last 100 sessions
      const trimmed = sessions.slice(-100);
      await chrome.storage.local.set({ focusSessions: trimmed });
    } catch (e) {
      console.error('[Focus] Failed to save session:', e);
    }
  }
}

type FocusEvent = {
  type: string;
  timestamp: number;
  [key: string]: any;
};

// Export singleton
export const focusService = FocusModeService.getInstance();
