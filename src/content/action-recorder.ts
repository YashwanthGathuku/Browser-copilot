/**
 * Action Recorder
 * Records user interactions and generates replayable code (Cypress-inspired)
 */

import type { EnhancedBrowserAgent } from './enhanced-agent';

export interface RecordedAction {
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'select' | 'hover';
  selector?: string;
  value?: string;
  timestamp: number;
  screenshot?: string;
}

export interface Recording {
  id: string;
  name: string;
  actions: RecordedAction[];
  createdAt: number;
  duration: number;
}

export class ActionRecorder {
  private isRecording = false;
  private currentRecording: RecordedAction[] = [];
  private recordingName = '';
  private startTime = 0;
  private observer?: MutationObserver;

  /**
   * Start recording user actions
   */
  startRecording(name: string): void {
    this.isRecording = true;
    this.recordingName = name;
    this.currentRecording = [];
    this.startTime = Date.now();

    console.log(`[Recorder] Started recording: ${name}`);
    
    // Listen for clicks
    document.addEventListener('click', this.handleClick, true);
    
    // Listen for input
    document.addEventListener('input', this.handleInput, true);
    
    // Listen for navigation
    this.setupNavigationListener();
    
    // Visual feedback
    this.showRecordingIndicator();
  }

  /**
   * Stop recording
   */
  stopRecording(): Recording {
    this.isRecording = false;
    
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('input', this.handleInput, true);
    this.observer?.disconnect();
    this.hideRecordingIndicator();

    const recording: Recording = {
      id: `rec-${Date.now()}`,
      name: this.recordingName,
      actions: this.currentRecording,
      createdAt: this.startTime,
      duration: Date.now() - this.startTime
    };

    console.log(`[Recorder] Stopped recording: ${this.recordingName}`, recording);
    
    // Save to storage
    this.saveRecording(recording);
    
    return recording;
  }

  /**
   * Handle click events
   */
  private handleClick = (event: MouseEvent): void => {
    if (!this.isRecording) return;

    const target = event.target as Element;
    if (!target) return;

    const selector = this.getSelector(target);
    
    this.currentRecording.push({
      type: 'click',
      selector,
      timestamp: Date.now() - this.startTime
    });

    console.log(`[Recorder] Recorded click:`, selector);
  };

  /**
   * Handle input events
   */
  private handleInput = (event: Event): void => {
    if (!this.isRecording) return;

    const target = event.target as HTMLInputElement;
    if (!target) return;

    const selector = this.getSelector(target);
    
    this.currentRecording.push({
      type: 'type',
      selector,
      value: target.value,
      timestamp: Date.now() - this.startTime
    });

    console.log(`[Recorder] Recorded input:`, selector, target.value);
  };

  /**
   * Setup navigation listener
   */
  private setupNavigationListener(): void {
    let lastUrl = location.href;
    
    this.observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        this.currentRecording.push({
          type: 'navigate',
          value: location.href,
          timestamp: Date.now() - this.startTime
        });
        
        lastUrl = location.href;
        console.log(`[Recorder] Recorded navigation:`, location.href);
      }
    });

    this.observer.observe(document, { subtree: true, childList: true });
  }

  /**
   * Get robust selector for element
   */
  private getSelector(element: Element): string {
    // Use existing robust selector logic
    if (element.id && !/\d{5,}/.test(element.id)) {
      return `#${element.id}`;
    }

    const testAttrs = ['data-testid', 'data-cy', 'data-test'];
    for (const attr of testAttrs) {
      if (element.hasAttribute(attr)) {
        return `[${attr}="${element.getAttribute(attr)}"]`;
      }
    }

    if (element instanceof HTMLInputElement && element.name) {
      return `input[name="${element.name}"]`;
    }

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return `[aria-label="${ariaLabel}"]`;
    }

    // Fallback to CSS path
    const path: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.body && path.length < 4) {
      let segment = current.tagName.toLowerCase();
      
      if (current.id) {
        segment += `#${current.id}`;
        path.unshift(segment);
        break;
      }

      const classes = Array.from(current.classList)
        .filter(c => !c.match(/^(active|focus|hover|selected)/))
        .slice(0, 2);
      
      if (classes.length) {
        segment += '.' + classes.join('.');
      }

      path.unshift(segment);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  /**
   * Show recording indicator
   */
  private showRecordingIndicator(): void {
    const indicator = document.createElement('div');
    indicator.id = 'nano-recorder-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 999999;
        background: #ef4444;
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-family: system-ui;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        Recording: ${this.recordingName}
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      </style>
    `;
    document.body.appendChild(indicator);
  }

  /**
   * Hide recording indicator
   */
  private hideRecordingIndicator(): void {
    const indicator = document.getElementById('nano-recorder-indicator');
    indicator?.remove();
  }

  /**
   * Save recording to storage
   */
  private async saveRecording(recording: Recording): Promise<void> {
    try {
      const stored = await chrome.storage.local.get('recordings');
      const recordings = stored.recordings || [];
      recordings.push(recording);
      await chrome.storage.local.set({ recordings });
      console.log(`[Recorder] Saved recording:`, recording.id);
    } catch (error) {
      console.error('[Recorder] Failed to save recording:', error);
    }
  }

  /**
   * Get all recordings
   */
  static async getRecordings(): Promise<Recording[]> {
    const stored = await chrome.storage.local.get('recordings');
    return stored.recordings || [];
  }

  /**
   * Delete recording
   */
  static async deleteRecording(id: string): Promise<void> {
    const stored = await chrome.storage.local.get('recordings');
    const recordings = (stored.recordings || []).filter((r: Recording) => r.id !== id);
    await chrome.storage.local.set({ recordings });
  }

  /**
   * Export recording as code
   */
  static exportAsCode(recording: Recording): string {
    const lines: string[] = [
      '// Generated by Nano Assistant',
      `// Recording: ${recording.name}`,
      `// Created: ${new Date(recording.createdAt).toLocaleString()}`,
      '',
      'import { createAgent } from "./enhanced-agent";',
      '',
      'async function replay() {',
      '  const agent = createAgent();',
      ''
    ];

    for (const action of recording.actions) {
      switch (action.type) {
        case 'navigate':
          lines.push(`  await agent.goto('${action.value}');`);
          break;
        case 'click':
          lines.push(`  await agent.$('${action.selector}').click();`);
          break;
        case 'type':
          lines.push(`  await agent.$('${action.selector}').type('${action.value}');`);
          break;
        case 'scroll':
          lines.push(`  await agent.$('${action.selector}').scrollIntoView();`);
          break;
      }
    }

    lines.push('', '}', '', 'replay();');
    
    return lines.join('\n');
  }

  /**
   * Export as Cypress test
   */
  static exportAsCypressTest(recording: Recording): string {
    const lines: string[] = [
      `describe('${recording.name}', () => {`,
      `  it('should replay recorded actions', () => {`
    ];

    for (const action of recording.actions) {
      switch (action.type) {
        case 'navigate':
          lines.push(`    cy.visit('${action.value}');`);
          break;
        case 'click':
          lines.push(`    cy.get('${action.selector}').click();`);
          break;
        case 'type':
          lines.push(`    cy.get('${action.selector}').type('${action.value}');`);
          break;
      }
    }

    lines.push('  });', '});');
    
    return lines.join('\n');
  }

  /**
   * Export as Puppeteer script
   */
  static exportAsPuppeteerScript(recording: Recording): string {
    const lines: string[] = [
      "const puppeteer = require('puppeteer');",
      '',
      'async function replay() {',
      '  const browser = await puppeteer.launch();',
      '  const page = await browser.newPage();',
      ''
    ];

    for (const action of recording.actions) {
      switch (action.type) {
        case 'navigate':
          lines.push(`  await page.goto('${action.value}');`);
          break;
        case 'click':
          lines.push(`  await page.click('${action.selector}');`);
          break;
        case 'type':
          lines.push(`  await page.type('${action.selector}', '${action.value}');`);
          break;
      }
    }

    lines.push('', '  await browser.close();', '}', '', 'replay();');
    
    return lines.join('\n');
  }

  /**
   * Replay recording with agent
   */
  static async replay(recording: Recording, agent: EnhancedBrowserAgent): Promise<void> {
    console.log(`[Recorder] Replaying: ${recording.name}`);
    
    for (const action of recording.actions) {
      try {
        switch (action.type) {
          case 'navigate':
            await agent.goto(action.value!);
            break;
          case 'click':
            await agent.$(action.selector!).click();
            break;
          case 'type':
            await agent.$(action.selector!).type(action.value!);
            break;
          case 'scroll':
            await agent.$(action.selector!).scrollIntoView();
            break;
        }
        
        // Wait between actions to simulate human behavior
        await agent.wait(action.timestamp > 0 ? Math.min(action.timestamp, 1000) : 500);
      } catch (error) {
        console.error(`[Recorder] Failed to replay action:`, action, error);
        throw error;
      }
    }
    
    console.log(`[Recorder] Replay complete`);
  }
}

// Export singleton
export const recorder = new ActionRecorder();
