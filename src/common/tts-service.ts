/**
 * Text-to-Speech Service
 * Manages browser voice feedback using Web Speech API
 * Handles queuing, priority levels, and voice configuration
 */

export type VoicePreference = "male" | "female" | "default";
export type SpeechPriority = "high" | "normal" | "low";

export interface TTSConfig {
  rate: number; // 0.1 to 10, default 1
  pitch: number; // 0 to 2, default 1
  volume: number; // 0 to 1, default 1
  voicePreference: VoicePreference;
  lang: string; // 'en-US', 'en-GB', etc
}

export interface SpeechQueueItem {
  id: string;
  text: string;
  priority: SpeechPriority;
  lang?: string; // Optional language override for this utterance
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: SpeechSynthesisErrorEvent) => void;
  timestamp: number;
}

/**
 * TextToSpeechService: Singleton service for managing voice output
 * Features:
 * - Queue management with priority levels
 * - Multiple voice selection
 * - Pause/resume/stop controls
 * - Event callbacks
 * - Automatic utterance management
 */
export class TextToSpeechService {
  private static instance: TextToSpeechService;
  private synth: SpeechSynthesis = window.speechSynthesis;
  private utteranceQueue: SpeechQueueItem[] = [];
  private isSpeaking: boolean = false;
  private isPaused: boolean = false;
  private config: TTSConfig;
  private listeners: Map<string, Set<Function>> = new Map();
  private speechTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private constructor(config?: Partial<TTSConfig>) {
    this.config = {
      rate: config?.rate ?? 0.9,
      pitch: config?.pitch ?? 1,
      volume: config?.volume ?? 1,
      voicePreference: config?.voicePreference ?? "female",
      lang: config?.lang ?? "en-US",
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<TTSConfig>): TextToSpeechService {
    if (!TextToSpeechService.instance) {
      TextToSpeechService.instance = new TextToSpeechService(config);
    }
    return TextToSpeechService.instance;
  }

  /**
   * Speak text with optional priority and language
   * High priority messages are placed at front of queue
   * @param text - Text to speak
   * @param priority - Priority level (or language code for backwards compatibility)
   * @param lang - Optional language code (e.g., 'en-US', 'es-ES', 'ja-JP')
   */
  async speak(
    text: string,
    priority: SpeechPriority | string = "normal",
    lang?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = `utterance-${Date.now()}-${Math.random()}`;

      // Handle backwards compatibility: if priority looks like a lang code, swap params
      let actualPriority: SpeechPriority = "normal";
      let actualLang: string | undefined = lang;
      
      if (priority === "high" || priority === "normal" || priority === "low") {
        actualPriority = priority as SpeechPriority;
      } else {
        // priority is actually a lang code
        actualLang = priority;
      }

      const item: SpeechQueueItem = {
        id,
        text,
        priority: actualPriority,
        timestamp: Date.now(),
        onEnd: () => resolve(),
        onError: (error) => reject(error),
        lang: actualLang, // Store language override
      };

      this.addToQueue(item);
      this.processQueue();
    });
  }

  /**
   * Add item to queue with priority sorting
   */
  private addToQueue(item: SpeechQueueItem): void {
    this.utteranceQueue.push(item);

    // Sort by priority: high > normal > low
    this.utteranceQueue.sort((a, b) => {
      const priorityMap = { high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityMap[b.priority] - priorityMap[a.priority];
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
    });

    this.emit("queued", { itemId: item.id, queueLength: this.utteranceQueue.length });
  }

  /**
   * Process queue and speak next item if not currently speaking
   */
  private processQueue(): void {
    if (this.isSpeaking || this.utteranceQueue.length === 0) {
      return;
    }

    const item = this.utteranceQueue.shift();
    if (!item) return;

    this.isSpeaking = true;
    this.emit("speaking-start", { text: item.text });

    const utterance = this.createUtterance(item);

    try {
      this.synth.speak(utterance);
    } catch (error) {
      console.error("Error speaking:", error);
      this.handleSpeechEnd();
      item.onError?.(error as SpeechSynthesisErrorEvent);
    }
  }

  /**
   * Create SpeechSynthesisUtterance with callbacks
   */
  private createUtterance(item: SpeechQueueItem): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(item.text);

    // Set voice (pass lang for better matching)
    const voices = this.synth.getVoices();
    const selectedVoice = this.selectVoice(voices, item.lang);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Configure
    utterance.rate = this.config.rate;
    utterance.pitch = this.config.pitch;
    utterance.volume = this.config.volume;
    utterance.lang = item.lang || this.config.lang; // Use item override or default config

    // Callbacks
    utterance.onstart = () => {
      item.onStart?.();
      this.emit("utterance-start", { text: item.text });
    };

    utterance.onend = () => {
      item.onEnd?.();
      this.emit("utterance-end", { text: item.text });
      this.handleSpeechEnd();
    };

    utterance.onerror = (event) => {
      item.onError?.(event);
      this.emit("utterance-error", { error: event.error });
      this.handleSpeechEnd();
    };

    utterance.onpause = () => {
      this.emit("utterance-pause", { text: item.text });
    };

    return utterance;
  }

  /**
   * Select voice based on preference and language
   */
  private selectVoice(voices: SpeechSynthesisVoice[], lang?: string): SpeechSynthesisVoice | undefined {
    if (this.config.voicePreference === "default") {
      return undefined;
    }

    const targetLang = lang || this.config.lang;
    
    // Filter by language first (match lang code prefix, e.g., 'en' matches 'en-US', 'en-GB')
    const langPrefix = targetLang.split('-')[0].toLowerCase();
    const langMatches = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
    
    // Then filter by gender preference
    const preferred = (langMatches.length > 0 ? langMatches : voices).filter((v) => {
      const isMale = v.name.toLowerCase().includes("male") || v.name.includes("Google UK English Male");
      const isFemale = v.name.toLowerCase().includes("female") || v.name.includes("Google US English Female");

      return this.config.voicePreference === "male" ? isMale : isFemale;
    });

    return preferred[0] ?? voices[0];
  }

  /**
   * Handle speech end and process queue
   */
  private handleSpeechEnd(): void {
    this.isSpeaking = false;

    if (this.speechTimeoutId) {
      clearTimeout(this.speechTimeoutId);
      this.speechTimeoutId = null;
    }

    // Process next item with slight delay
    this.speechTimeoutId = setTimeout(() => {
      this.processQueue();
    }, 100);
  }

  /**
   * Pause speech
   */
  pause(): void {
    if (this.isSpeaking) {
      this.synth.pause();
      this.isPaused = true;
      this.emit("paused");
    }
  }

  /**
   * Resume speech
   */
  resume(): void {
    if (this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
    }
  }

  /**
   * Stop all speech and clear queue
   */
  stop(): void {
    this.synth.cancel();
    this.utteranceQueue = [];
    this.isSpeaking = false;
    this.isPaused = false;

    if (this.speechTimeoutId) {
      clearTimeout(this.speechTimeoutId);
      this.speechTimeoutId = null;
    }

    this.emit("stopped");
  }

  /**
   * Clear queue but don't stop current speech
   */
  clearQueue(): void {
    this.utteranceQueue = [];
    this.emit("queue-cleared");
  }

  /**
   * Get current configuration
   */
  getConfig(): TTSConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(partial: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...partial };
    this.emit("config-changed", this.config);
  }

  /**
   * Set voice rate (0.1 to 10)
   */
  setRate(rate: number): void {
    this.config.rate = Math.max(0.1, Math.min(10, rate));
  }

  /**
   * Set voice pitch (0 to 2)
   */
  setPitch(pitch: number): void {
    this.config.pitch = Math.max(0, Math.min(2, pitch));
  }

  /**
   * Set voice volume (0 to 1)
   */
  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Set voice preference
   */
  setVoicePreference(preference: VoicePreference): void {
    this.config.voicePreference = preference;
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synth.getVoices();
  }

  /**
   * Get speaking status
   */
  isSpeakingNow(): boolean {
    return this.isSpeaking;
  }

  /**
   * Get pause status
   */
  isPausedNow(): boolean {
    return this.isPaused;
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.utteranceQueue.length;
  }

  /**
   * Event system
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
}

// Export singleton instance
export const ttsService = TextToSpeechService.getInstance();
