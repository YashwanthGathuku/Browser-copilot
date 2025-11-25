/**
 * Smart Memory Service
 * Remembers browsing context, pages visited, and enables intelligent recall
 * This is a key differentiator vs competitors - "AI that remembers everything"
 */

import DOMPurify from 'dompurify';

export interface PageMemory {
  id: string;
  url: string;
  title: string;
  summary?: string;
  keywords: string[];
  visitedAt: number;
  duration: number; // time spent on page
  interactions: number; // clicks, scrolls, etc.
  screenshot?: string; // base64 thumbnail
  content?: string; // extracted text (truncated)
  domain: string;
  category?: string; // auto-detected: shopping, research, social, etc.
}

export interface SearchResult {
  memory: PageMemory;
  relevance: number;
  matchedTerms: string[];
}

export interface MemoryStats {
  totalPages: number;
  totalTime: number;
  topDomains: { domain: string; visits: number; time: number }[];
  topCategories: { category: string; count: number }[];
  recentPages: PageMemory[];
}

const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  shopping: [/amazon|ebay|etsy|shopify|store|buy|cart|checkout/i],
  research: [/wikipedia|arxiv|scholar|research|paper|study/i],
  social: [/twitter|facebook|instagram|linkedin|reddit|x\.com/i],
  news: [/news|cnn|bbc|reuters|times|post|guardian/i],
  video: [/youtube|vimeo|netflix|twitch|video/i],
  development: [/github|stackoverflow|dev\.to|codepen|gitlab/i],
  email: [/mail|gmail|outlook|protonmail/i],
  productivity: [/notion|trello|asana|jira|confluence|docs\.google/i],
  finance: [/bank|paypal|venmo|crypto|trading|invest/i],
};

export class MemoryService {
  private static instance: MemoryService;
  private memories: Map<string, PageMemory> = new Map();
  private currentPageStart: number = 0;
  private currentUrl: string = '';
  private interactionCount: number = 0;
  private maxMemories: number = 1000;

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  /**
   * Start tracking a new page visit
   */
  startTracking(url: string, _title: string): void {
    // Save previous page's duration
    if (this.currentUrl && this.currentPageStart > 0) {
      this.endTracking();
    }

    this.currentUrl = url;
    this.currentPageStart = Date.now();
    this.interactionCount = 0;
  }

  /**
   * Record an interaction on the current page
   */
  recordInteraction(): void {
    this.interactionCount++;
  }

  /**
   * End tracking and save page to memory
   */
  endTracking(): void {
    if (!this.currentUrl || this.currentPageStart === 0) return;

    const duration = Date.now() - this.currentPageStart;
    const existingMemory = this.memories.get(this.currentUrl);

    if (existingMemory) {
      // Update existing memory
      existingMemory.duration += duration;
      existingMemory.interactions += this.interactionCount;
      existingMemory.visitedAt = Date.now();
    }

    this.currentPageStart = 0;
    this.interactionCount = 0;
  }

  /**
   * Save a page to memory with full details
   */
  async savePage(pageData: {
    url: string;
    title: string;
    content?: string;
    screenshot?: string;
  }): Promise<PageMemory> {
    const sanitizedTitle = DOMPurify.sanitize(pageData.title);
    // Truncate content before sanitizing for efficiency
    const truncatedContent = pageData.content?.slice(0, 6000);
    const sanitizedContent = truncatedContent ? DOMPurify.sanitize(truncatedContent).slice(0, 5000) : undefined;
    
    const domain = new URL(pageData.url).hostname;
    const category = this.detectCategory(pageData.url, sanitizedTitle);
    const keywords = this.extractKeywords(sanitizedTitle, sanitizedContent);

    const memory: PageMemory = {
      id: crypto.randomUUID(),
      url: pageData.url,
      title: sanitizedTitle,
      keywords,
      visitedAt: Date.now(),
      duration: 0,
      interactions: 0,
      screenshot: pageData.screenshot,
      content: sanitizedContent,
      domain,
      category,
    };

    // Check if we need to merge with existing
    const existing = this.memories.get(pageData.url);
    if (existing) {
      memory.duration = existing.duration;
      memory.interactions = existing.interactions;
      memory.id = existing.id;
    }

    this.memories.set(pageData.url, memory);
    
    // Limit memory size
    if (this.memories.size > this.maxMemories) {
      this.pruneOldMemories();
    }

    await this.saveToStorage();
    return memory;
  }

  /**
   * Search memories using natural language
   */
  search(query: string, limit: number = 10): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
    const results: SearchResult[] = [];

    for (const memory of this.memories.values()) {
      const relevance = this.calculateRelevance(memory, queryTerms);
      if (relevance > 0) {
        const matchedTerms = queryTerms.filter(term => 
          memory.title.toLowerCase().includes(term) ||
          memory.keywords.some(k => k.includes(term)) ||
          memory.content?.toLowerCase().includes(term) ||
          memory.domain.includes(term)
        );
        
        results.push({ memory, relevance, matchedTerms });
      }
    }

    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Get memories by category
   */
  getByCategory(category: string): PageMemory[] {
    return Array.from(this.memories.values())
      .filter(m => m.category === category)
      .sort((a, b) => b.visitedAt - a.visitedAt);
  }

  /**
   * Get recently visited pages
   */
  getRecent(limit: number = 20): PageMemory[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, limit);
  }

  /**
   * Get frequently visited pages
   */
  getFrequent(limit: number = 10): PageMemory[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, limit);
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const allMemories = Array.from(this.memories.values());
    
    // Calculate domain stats
    const domainStats = new Map<string, { visits: number; time: number }>();
    for (const memory of allMemories) {
      const stats = domainStats.get(memory.domain) || { visits: 0, time: 0 };
      stats.visits++;
      stats.time += memory.duration;
      domainStats.set(memory.domain, stats);
    }

    // Calculate category stats
    const categoryStats = new Map<string, number>();
    for (const memory of allMemories) {
      if (memory.category) {
        categoryStats.set(memory.category, (categoryStats.get(memory.category) || 0) + 1);
      }
    }

    return {
      totalPages: allMemories.length,
      totalTime: allMemories.reduce((sum, m) => sum + m.duration, 0),
      topDomains: Array.from(domainStats.entries())
        .map(([domain, stats]) => ({ domain, ...stats }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 10),
      topCategories: Array.from(categoryStats.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      recentPages: this.getRecent(5),
    };
  }

  /**
   * Generate a summary of today's browsing
   */
  getTodaySummary(): { pages: number; time: number; topDomain: string | null } {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayMemories = Array.from(this.memories.values())
      .filter(m => m.visitedAt >= todayStart);

    const domainCounts = new Map<string, number>();
    let totalTime = 0;

    for (const memory of todayMemories) {
      domainCounts.set(memory.domain, (domainCounts.get(memory.domain) || 0) + 1);
      totalTime += memory.duration;
    }

    const topDomain = Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      pages: todayMemories.length,
      time: totalTime,
      topDomain,
    };
  }

  /**
   * Clear all memories
   */
  async clearAll(): Promise<void> {
    this.memories.clear();
    await this.saveToStorage();
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(url: string): Promise<void> {
    this.memories.delete(url);
    await this.saveToStorage();
  }

  // Private helpers

  private detectCategory(url: string, title: string): string {
    const combined = `${url} ${title}`.toLowerCase();
    
    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      if (patterns.some(p => p.test(combined))) {
        return category;
      }
    }
    
    return 'other';
  }

  private extractKeywords(title: string, content?: string): string[] {
    const text = `${title} ${content || ''}`.toLowerCase();
    const words = text.split(/[\s,.!?;:'"()[\]{}]+/);
    
    // Filter out common words
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'of', 'to', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very']);
    
    const keywords = words
      .filter(w => w.length > 3 && !stopWords.has(w))
      .slice(0, 20);
    
    return [...new Set(keywords)];
  }

  private calculateRelevance(memory: PageMemory, queryTerms: string[]): number {
    let score = 0;
    const titleLower = memory.title.toLowerCase();
    const contentLower = (memory.content || '').toLowerCase();
    
    for (const term of queryTerms) {
      // Title match (high weight)
      if (titleLower.includes(term)) score += 10;
      
      // Keyword match (medium weight)
      if (memory.keywords.some(k => k.includes(term))) score += 5;
      
      // Content match (low weight)
      if (contentLower.includes(term)) score += 2;
      
      // Domain match
      if (memory.domain.includes(term)) score += 3;
      
      // Category match
      if (memory.category?.includes(term)) score += 2;
    }
    
    // Recency bonus
    const daysSinceVisit = (Date.now() - memory.visitedAt) / (1000 * 60 * 60 * 24);
    if (daysSinceVisit < 1) score *= 1.5;
    else if (daysSinceVisit < 7) score *= 1.2;
    
    // Interaction bonus
    if (memory.interactions > 10) score *= 1.3;
    
    return score;
  }

  private pruneOldMemories(): void {
    // Keep most recent and most interacted pages
    const sorted = Array.from(this.memories.entries())
      .sort((a, b) => {
        // Score based on recency and interactions
        const scoreA = a[1].visitedAt / 1000000 + a[1].interactions * 100;
        const scoreB = b[1].visitedAt / 1000000 + b[1].interactions * 100;
        return scoreB - scoreA;
      });
    
    // Keep only top memories
    this.memories = new Map(sorted.slice(0, this.maxMemories * 0.8));
  }

  private async saveToStorage(): Promise<void> {
    try {
      const data = Array.from(this.memories.entries());
      await chrome.storage.local.set({ pageMemories: data });
    } catch (error) {
      console.error('[Memory] Failed to save:', error);
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('pageMemories');
      if (result.pageMemories) {
        this.memories = new Map(result.pageMemories);
      }
    } catch (error) {
      console.error('[Memory] Failed to load:', error);
    }
  }
}

// Export singleton
export const memoryService = MemoryService.getInstance();
