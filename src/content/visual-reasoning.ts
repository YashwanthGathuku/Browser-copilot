/**
 * Visual Reasoning Engine
 * Uses screenshots, accessibility tree, and visual analysis for robust element detection
 */

// import type { PageInsights } from '../types/agent-types';

export interface VisualContext {
  screenshot: string; // base64 data URL
  accessibilityTree: any;
  viewport: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
  };
  elementPositions: Map<string, DOMRect>;
}

export interface VisualElement {
  selector: string;
  visualDescription: string;
  position: { x: number; y: number; width: number; height: number };
  isVisible: boolean;
  screenshot?: string; // cropped element screenshot
}

export class VisualReasoning {
  /**
   * Capture full page screenshot
   */
  async captureScreenshot(): Promise<string> {
    try {
      // Use chrome.tabs.captureVisibleTab via message to background
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
          if (response?.screenshot) {
            resolve(response.screenshot);
          } else {
            reject(new Error('Screenshot capture failed'));
          }
        });
      });
    } catch (error) {
      console.error('[VisualReasoning] Screenshot error:', error);
      throw error;
    }
  }

  /**
   * Get visual context for current page
   */
  async getVisualContext(): Promise<VisualContext> {
    const screenshot = await this.captureScreenshot();
    const accessibilityTree = this.getAccessibilityTree();
    const elementPositions = this.getElementPositions();

    return {
      screenshot,
      accessibilityTree,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      elementPositions
    };
  }

  /**
   * Get accessibility tree
   */
  private getAccessibilityTree(): any {
    // Delegate to existing implementation in agent.ts
    return (window as any).__NANO_AGENT__?.getAccessibilityTree?.() || {};
  }

  /**
   * Get visual positions of all interactive elements
   */
  private getElementPositions(): Map<string, DOMRect> {
    const positions = new Map<string, DOMRect>();
    
    const interactiveElements = document.querySelectorAll(
      'button, a, input, select, textarea, [role="button"], [role="link"], [onclick]'
    );

    interactiveElements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      if (this.isElementVisible(el, rect)) {
        const selector = this.getSelector(el) || `element-${index}`;
        positions.set(selector, rect);
      }
    });

    return positions;
  }

  /**
   * Check if element is visually visible
   */
  private isElementVisible(el: Element, rect: DOMRect): boolean {
    if (rect.width === 0 || rect.height === 0) return false;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
    if (rect.right < 0 || rect.left > window.innerWidth) return false;

    const style = window.getComputedStyle(el);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;

    return true;
  }

  /**
   * Get robust selector for element
   */
  private getSelector(el: Element): string | null {
    // Use existing robust selector from agent.ts
    return (window as any).__NANO_AGENT__?.getRobustSelector?.(el) || null;
  }

  /**
   * Crop element screenshot from full page screenshot
   */
  async cropElementScreenshot(fullScreenshot: string, rect: DOMRect): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(
          img,
          rect.left, rect.top, rect.width, rect.height,
          0, 0, rect.width, rect.height
        );

        resolve(canvas.toDataURL());
      };
      img.onerror = reject;
      img.src = fullScreenshot;
    });
  }

  /**
   * Find elements by visual description (using LLM)
   */
  async findElementByVisualDescription(
    description: string,
    visualContext: VisualContext
  ): Promise<string | null> {
    try {
      // Send to background for LLM analysis
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'VISUAL_REASONING_FIND_ELEMENT',
          description,
          visualContext
        }, (response) => {
          resolve(response?.selector || null);
        });
      });
    } catch (error) {
      console.error('[VisualReasoning] Find element error:', error);
      return null;
    }
  }

  /**
   * Analyze visual changes between two screenshots
   */
  analyzeVisualDiff(before: string, after: string): Promise<{
    changed: boolean;
    changedRegions: DOMRect[];
  }> {
    return new Promise((resolve) => {
      // This would ideally use a vision model, but for now, return basic info
      resolve({
        changed: before !== after,
        changedRegions: []
      });
    });
  }

  /**
   * Get element by visual similarity to reference image
   */
  async findSimilarElement(_referenceImage: string): Promise<Element | null> {
    // This would require a vision model to compare images
    // For now, return null (future enhancement)
    console.warn('[VisualReasoning] findSimilarElement not yet implemented');
    return null;
  }

  /**
   * Extract text from image using OCR
   */
  async extractTextFromImage(imageData: string): Promise<string> {
    try {
      // Use Chrome's experimental OCR if available
      const cAny = chrome as any;
      if (cAny?.ocr?.extract) {
        const result = await cAny.ocr.extract({ image: imageData });
        return result.text || '';
      }
      
      // Fallback: send to background for processing
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'OCR_EXTRACT_TEXT',
          imageData
        }, (response) => {
          resolve(response?.text || '');
        });
      });
    } catch (error) {
      console.error('[VisualReasoning] OCR error:', error);
      return '';
    }
  }
}

// Singleton instance
export const visualReasoning = new VisualReasoning();
