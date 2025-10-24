// src/common/visual-feedback.ts
import DOMPurify from 'dompurify';

export interface VisualFeedbackOptions {
  type: 'click' | 'fill' | 'scroll' | 'highlight' | 'navigate' | 'search';
  element?: HTMLElement;
  message?: string;
  duration?: number;
  color?: string;
}

export class VisualFeedbackManager {
  private activeHighlights: Set<HTMLElement> = new Set();
  private feedbackContainer: HTMLElement | null = null;

  constructor() {
    this.createFeedbackContainer();
    window.addEventListener('unload', () => this.destroy()); // Cleanup on navigation
  }

  private createFeedbackContainer() {
    if (window !== window.top) return; // Skip iframes
    this.feedbackContainer = document.createElement('div');
    this.feedbackContainer.id = 'browser-copilot-feedback';
    this.feedbackContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    document.body.appendChild(this.feedbackContainer);
  }

  public showFeedback(options: VisualFeedbackOptions) {
    const {
      type,
      element,
      message = '',
      duration = 2000,
      color = '#3b82f6'
    } = options;

    const sanitizedMessage = DOMPurify.sanitize(message); // XSS prevention

    switch (type) {
      case 'click':
        this.highlightClick(element!, sanitizedMessage);
        break;
      case 'fill':
        this.highlightFill(element!, sanitizedMessage);
        break;
      case 'scroll':
        this.showScrollFeedback(sanitizedMessage);
        break;
      case 'highlight':
        this.highlightElement(element!, sanitizedMessage);
        break;
      case 'navigate':
        this.showNavigationFeedback(sanitizedMessage, color);
        break;
      case 'search':
        this.showSearchFeedback(sanitizedMessage, color);
        break;
      default:
        return; // Ignore unknown types
    }

    setTimeout(() => {
      this.clearHighlights();
    }, duration);
  }

  private highlightClick(element: HTMLElement, message: string) {
    this.addHighlight(element, {
      border: '3px solid #ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)',
      animation: 'pulse 0.5s ease-in-out'
    });
    if (message) this.showTooltip(element, message, '#ef4444');
  }

  private highlightFill(element: HTMLElement, message: string) {
    this.addHighlight(element, {
      border: '3px solid #10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
      animation: 'pulse 0.5s ease-in-out'
    });
    if (message) this.showTooltip(element, message, '#10b981');
  }

  private highlightElement(element: HTMLElement, message: string) {
    this.addHighlight(element, {
      border: '3px solid #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
      animation: 'pulse 0.5s ease-in-out'
    });
    if (message) this.showTooltip(element, message, '#3b82f6');
  }

  private showScrollFeedback(message: string) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      animation: slideInRight 0.3s ease-out;
      z-index: 1000000;
    `;
    notification.textContent = message;
    
    this.feedbackContainer!.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
      }, 300);
    }, 2000);
  }

  private showNavigationFeedback(message: string, color: string) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: ${color};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      animation: slideInLeft 0.3s ease-out;
      z-index: 1000000;
    `;
    notification.textContent = message;
    
    this.feedbackContainer!.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutLeft 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
      }, 300);
    }, 2000);
  }

  private showSearchFeedback(message: string, color: string) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: ${color};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      animation: slideInLeft 0.3s ease-out;
      z-index: 1000000;
    `;
    notification.textContent = message;
    
    this.feedbackContainer!.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutLeft 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
      }, 300);
    }, 2000);
  }

  private addHighlight(element: HTMLElement, styles: Record<string, string>) {
    const originalStyles = {
      border: element.style.border,
      backgroundColor: element.style.backgroundColor,
      boxShadow: element.style.boxShadow,
      animation: element.style.animation
    };

    Object.assign(element.style, styles);
    this.activeHighlights.add(element);
    (element as any).__originalStyles = originalStyles;
  }

  private showTooltip(element: HTMLElement, message: string, color: string) {
    const rect = element.getBoundingClientRect();
    const tooltip = document.createElement('div');
    
    tooltip.style.cssText = `
      position: fixed;
      top: ${rect.top - 40}px;
      left: ${rect.left + rect.width / 2}px;
      transform: translateX(-50%);
      background: ${color};
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: fadeInUp 0.3s ease-out;
      z-index: 1000001;
    `;
    
    tooltip.textContent = message;
    this.feedbackContainer!.appendChild(tooltip);

    setTimeout(() => {
      tooltip.style.animation = 'fadeOutDown 0.3s ease-in';
      setTimeout(() => {
        if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      }, 300);
    }, 2000);
  }

  public clearHighlights() {
    this.activeHighlights.forEach(element => {
      const originalStyles = (element as any).__originalStyles;
      if (originalStyles) {
        Object.assign(element.style, originalStyles);
        delete (element as any).__originalStyles;
      }
    });
    this.activeHighlights.clear();
  }

  public destroy() {
    this.clearHighlights();
    if (this.feedbackContainer && this.feedbackContainer.parentNode) {
      this.feedbackContainer.parentNode.removeChild(this.feedbackContainer);
    }
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  @keyframes fadeOutDown {
    from {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    to {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
  }
  
  @keyframes slideInLeft {
    from {
      opacity: 0;
      transform: translateX(-100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes slideOutLeft {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(-100%);
    }
  }
  
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes slideOutRight {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
document.head.appendChild(style);

// Global instance
export const visualFeedback = new VisualFeedbackManager();