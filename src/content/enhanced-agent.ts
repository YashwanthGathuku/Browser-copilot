/**
 * Enhanced Browser Agent
 * Combines the best patterns from Puppeteer, Cypress, Selenium, and WebdriverIO
 * with Chrome Extension superpowers
 */

import { visualReasoning } from './visual-reasoning';

interface FindStrategies {
  id?: string;
  'data-testid'?: string;
  'data-cy'?: string;
  name?: string;
  'aria-label'?: string;
  placeholder?: string;
  css?: string;
  xpath?: string;
  text?: string;
}

interface WaitOptions {
  timeout?: number;
  interval?: number;
  visible?: boolean;
  enabled?: boolean;
}

interface CommandOptions {
  retry?: boolean;
  timeout?: number;
  screenshot?: boolean;
}

type Command = {
  name: string;
  fn: () => Promise<any>;
  options: CommandOptions;
  result?: any;
  error?: Error;
  timestamp: number;
};

/**
 * Fluent Element API (WebdriverIO-inspired)
 */
export class ElementAPI {
  private selector: string;
  private agent: EnhancedBrowserAgent;

  constructor(
    selector: string,
    agent: EnhancedBrowserAgent
  ) {
    this.selector = selector;
    this.agent = agent;
  }

  /**
   * Click the element
   */
  async click(options?: { force?: boolean }): Promise<this> {
    await this.agent.executeInPage(`
      const el = document.querySelector('${this.selector}');
      if (!el) throw new Error('Element not found: ${this.selector}');
      ${options?.force ? 'el.click();' : `
        if (el.disabled || !el.offsetParent) {
          throw new Error('Element not clickable: ${this.selector}');
        }
        el.click();
      `}
    `);
    return this;
  }

  /**
   * Type text into the element
   */
  async type(text: string, options?: { clear?: boolean; delay?: number }): Promise<this> {
    const delay = options?.delay || 0;
    await this.agent.executeInPage(`
      const el = document.querySelector('${this.selector}');
      if (!el) throw new Error('Element not found: ${this.selector}');
      ${options?.clear ? 'el.value = "";' : ''}
      
      ${delay > 0 ? `
        // Type with delay (simulate human typing)
        const text = '${text}';
        for (let i = 0; i < text.length; i++) {
          el.value += text[i];
          el.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, ${delay}));
        }
      ` : `
        el.value = '${text}';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      `}
      el.dispatchEvent(new Event('change', { bubbles: true }));
    `);
    return this;
  }

  /**
   * Get text content
   */
  async getText(): Promise<string> {
    return this.agent.executeInPage(`
      const el = document.querySelector('${this.selector}');
      if (!el) throw new Error('Element not found: ${this.selector}');
      return el.textContent || '';
    `);
  }

  /**
   * Get attribute value
   */
  async getAttribute(name: string): Promise<string | null> {
    return this.agent.executeInPage(`
      const el = document.querySelector('${this.selector}');
      if (!el) throw new Error('Element not found: ${this.selector}');
      return el.getAttribute('${name}');
    `);
  }

  /**
   * Check if element is visible
   */
  async isVisible(): Promise<boolean> {
    return this.agent.executeInPage(`
      const el = document.querySelector('${this.selector}');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && 
             style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0';
    `);
  }

  /**
   * Wait until condition is met (Cypress-inspired)
   */
  async waitUntil(
    condition: (el: Element) => boolean | Promise<boolean>,
    options: WaitOptions = {}
  ): Promise<this> {
    const timeout = options.timeout || 5000;
    const interval = options.interval || 100;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const element = await this.getElement();
      if (element && await condition(element)) {
        return this;
      }
      await new Promise(r => setTimeout(r, interval));
    }

    throw new Error(`Timeout waiting for condition on ${this.selector}`);
  }

  /**
   * Get the actual DOM element
   */
  async getElement(): Promise<Element | null> {
    return this.agent.executeInPage(`
      return document.querySelector('${this.selector}');
    `);
  }

  /**
   * Hover over element
   */
  async hover(): Promise<this> {
    await this.agent.executeInPage(`
      const el = document.querySelector('${this.selector}');
      if (!el) throw new Error('Element not found: ${this.selector}');
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    `);
    return this;
  }

  /**
   * Scroll element into view
   */
  async scrollIntoView(options?: ScrollIntoViewOptions): Promise<this> {
    await this.agent.executeInPage(`
      const el = document.querySelector('${this.selector}');
      if (!el) throw new Error('Element not found: ${this.selector}');
      el.scrollIntoView(${JSON.stringify(options || { behavior: 'smooth', block: 'center' })});
    `);
    return this;
  }
}

/**
 * Command Chain (Cypress-inspired)
 */
export class CommandChain {
  private commands: Command[] = [];
  private history: Command[] = [];
  private agent: EnhancedBrowserAgent;

  constructor(agent: EnhancedBrowserAgent) {
    this.agent = agent;
  }

  /**
   * Add command to queue
   */
  then(fn: () => Promise<any>, options: CommandOptions = {}): this {
    this.commands.push({
      name: fn.name || 'anonymous',
      fn,
      options: {
        retry: options.retry !== false,
        timeout: options.timeout || 5000,
        screenshot: options.screenshot || false
      },
      timestamp: Date.now()
    });
    return this;
  }

  /**
   * Execute all queued commands
   */
  async execute(): Promise<void> {
    for (const cmd of this.commands) {
      let attempts = 0;
      const maxAttempts = cmd.options.retry ? 3 : 1;

      while (attempts < maxAttempts) {
        try {
          cmd.result = await cmd.fn();
          this.history.push(cmd);
          
          if (cmd.options.screenshot) {
            await this.agent.screenshot();
          }
          
          break;
        } catch (error: any) {
          cmd.error = error;
          attempts++;
          
          if (attempts >= maxAttempts) {
            console.error(`Command failed after ${maxAttempts} attempts:`, error);
            throw error;
          }
          
          console.log(`Retrying command (attempt ${attempts}/${maxAttempts})...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  /**
   * Get command history
   */
  getHistory(): Command[] {
    return this.history;
  }

  /**
   * Replay from a specific point (Cypress time travel)
   */
  async replayFrom(index: number): Promise<void> {
    this.commands = this.history.slice(index).map(cmd => ({
      name: cmd.name,
      fn: cmd.fn,
      options: cmd.options,
      timestamp: Date.now()
    }));
    
    await this.execute();
  }

  /**
   * Export as code
   */
  exportAsCode(): string {
    return this.history.map(cmd => {
      return `await agent.${cmd.name}();`;
    }).join('\n');
  }
}

/**
 * Enhanced Browser Agent
 * Main class combining all patterns
 */
export class EnhancedBrowserAgent {
  // private _commandChain: CommandChain;
  private tabId?: number;

  constructor(tabId?: number) {
    this.tabId = tabId;
    // this._commandChain = new CommandChain(this);
  }

  // ============ Puppeteer-inspired Navigation ============

  /**
   * Navigate to URL
   */
  async goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' }): Promise<this> {
    if (this.tabId) {
      await chrome.tabs.update(this.tabId, { url });
    } else {
      const tab = await chrome.tabs.create({ url });
      this.tabId = tab.id;
    }

    if (options?.waitUntil === 'load') {
      await this.waitForLoad();
    }

    return this;
  }

  /**
   * Wait for page load
   */
  async waitForLoad(): Promise<void> {
    return new Promise((resolve) => {
      const listener = (tabId: number, changeInfo: any) => {
        if (tabId === this.tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Take screenshot
   */
  async screenshot(_options?: { fullPage?: boolean }): Promise<string> {
    if (!this.tabId) throw new Error('No active tab');
    
    const windowId = (await chrome.tabs.get(this.tabId)).windowId;
    return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
  }

  /**
   * Generate PDF (if supported)
   */
  async pdf(): Promise<Blob> {
    // Chrome extension API doesn't support PDF generation directly
    // Would need to use print dialog or external service
    throw new Error('PDF generation requires print API - use window.print()');
  }

  // ============ Selenium-inspired Multi-Strategy Finder ============

  /**
   * Find element using multiple strategies with fallback
   */
  async findElement(strategies: FindStrategies): Promise<Element | null> {
    const order: (keyof FindStrategies)[] = [
      'id',
      'data-testid',
      'data-cy',
      'name',
      'aria-label',
      'placeholder',
      'css',
      'text',
      'xpath'
    ];

    for (const strategy of order) {
      if (!strategies[strategy]) continue;

      let selector: string;
      switch (strategy) {
        case 'id':
          selector = `#${strategies.id}`;
          break;
        case 'data-testid':
        case 'data-cy':
          selector = `[${strategy}="${strategies[strategy]}"]`;
          break;
        case 'name':
          selector = `[name="${strategies.name}"]`;
          break;
        case 'aria-label':
          selector = `[aria-label="${strategies['aria-label']}"]`;
          break;
        case 'placeholder':
          selector = `[placeholder="${strategies.placeholder}"]`;
          break;
        case 'css':
          selector = strategies.css!;
          break;
        case 'text':
          // Use XPath for text search
          const xpath = `//*[contains(text(), '${strategies.text}')]`;
          const element = await this.findByXPath(xpath);
          if (element) return element;
          continue;
        case 'xpath':
          return this.findByXPath(strategies.xpath!);
      }

      const element = await this.executeInPage(`return document.querySelector('${selector}')`);
      if (element) return element;
    }

    return null;
  }

  /**
   * Find element by XPath
   */
  private async findByXPath(xpath: string): Promise<Element | null> {
    return this.executeInPage(`
      const result = document.evaluate(
        '${xpath}',
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
    `);
  }

  // ============ Cypress-inspired Assertions & Waiting ============

  /**
   * Wait for selector to appear
   */
  async waitForSelector(selector: string, options: WaitOptions = {}): Promise<Element> {
    const timeout = options.timeout || 5000;
    const interval = options.interval || 100;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const element = await this.executeInPage(`return document.querySelector('${selector}')`);
      
      if (element) {
        if (options.visible) {
          const isVisible = await this.$(selector).isVisible();
          if (isVisible) return element;
        } else {
          return element;
        }
      }
      
      await new Promise(r => setTimeout(r, interval));
    }

    throw new Error(`Timeout waiting for selector: ${selector}`);
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout || 30000;
    
    return Promise.race([
      this.waitForLoad(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Navigation timeout')), timeout)
      )
    ]);
  }

  // ============ WebdriverIO-inspired Fluent API ============

  /**
   * Get element with fluent API
   */
  $(selector: string): ElementAPI {
    return new ElementAPI(selector, this);
  }

  /**
   * Get multiple elements
   */
  async $$(selector: string): Promise<ElementAPI[]> {
    const elements = await this.executeInPage(`
      return Array.from(document.querySelectorAll('${selector}'));
    `);
    
    return elements.map((_: any, index: number) => 
      new ElementAPI(`${selector}:nth-of-type(${index + 1})`, this)
    );
  }

  // ============ Command Queue & Recording ============

  /**
   * Start command chain
   */
  chain(): CommandChain {
    return new CommandChain(this);
  }

  /**
   * Execute script in page context
   */
  async executeInPage(script: string): Promise<any> {
    if (!this.tabId) throw new Error('No active tab');

    const results = await chrome.scripting.executeScript({
      target: { tabId: this.tabId },
      func: new Function(script) as any
    });

    return results[0]?.result;
  }

  /**
   * Visual reasoning: find element by description
   */
  async findByDescription(description: string): Promise<string | null> {
    const visualContext = await visualReasoning.getVisualContext();
    return visualReasoning.findElementByVisualDescription(description, visualContext);
  }

  // ============ Utility Methods ============

  /**
   * Wait for specified time
   */
  async wait(ms: number): Promise<this> {
    await new Promise(r => setTimeout(r, ms));
    return this;
  }

  /**
   * Get current URL
   */
  async getUrl(): Promise<string> {
    if (!this.tabId) throw new Error('No active tab');
    const tab = await chrome.tabs.get(this.tabId);
    return tab.url || '';
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.executeInPage('return document.title');
  }

  /**
   * Reload page
   */
  async reload(options?: { ignoreCache?: boolean }): Promise<this> {
    if (!this.tabId) throw new Error('No active tab');
    await chrome.tabs.reload(this.tabId, { bypassCache: options?.ignoreCache });
    await this.waitForLoad();
    return this;
  }

  /**
   * Go back in history
   */
  async goBack(): Promise<this> {
    await this.executeInPage('window.history.back()');
    await this.waitForLoad();
    return this;
  }

  /**
   * Go forward in history
   */
  async goForward(): Promise<this> {
    await this.executeInPage('window.history.forward()');
    await this.waitForLoad();
    return this;
  }
}

// Export singleton factory
export function createAgent(tabId?: number): EnhancedBrowserAgent {
  return new EnhancedBrowserAgent(tabId);
}
