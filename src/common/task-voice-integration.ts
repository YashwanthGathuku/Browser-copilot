/**
 * Task Voice Integration
 * Connects voice feedback to task execution pipeline
 * Automatically announces task progress through TTS
 */

import { ttsService } from "./tts-service";
import { conversationPrompts } from "./conversation-prompts";
import type { PromptOptions } from "./conversation-prompts";
import type { Task } from "../types/agent-types";

export class TaskVoiceIntegration {
  /**
   * Announce task chain start
   */
  static announceChainStart(): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "task_start",
    });
    return ttsService.speak(prompt, "high");
  }

  /**
   * Announce task start within a chain
   */
  static announceTaskStart(task: Task): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "task_start",
    });
    return ttsService.speak(`${task.title}. ${prompt}`, "normal");
  }

  /**
   * Announce search operation
   */
  static announceSearch(itemType: string = "results"): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "searching",
      itemType: itemType,
    });
    return ttsService.speak(prompt, "normal");
  }

  /**
   * Announce found results
   */
  static announceResults(count: number, itemType: string = "items"): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "found_results",
      itemCount: count,
      itemType: itemType,
    });
    return ttsService.speak(prompt, "normal");
  }

  /**
   * Announce form filling
   */
  static announceFormFilling(): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "filling_form",
    });
    return ttsService.speak(prompt, "normal");
  }

  /**
   * Announce element click
   */
  static announceClick(elementName: string): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "clicking_element",
      actionName: elementName,
    });
    return ttsService.speak(prompt, "normal");
  }

  /**
   * Announce navigation
   */
  static announceNavigation(location: string): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "navigating",
      location: location,
    });
    return ttsService.speak(prompt, "normal");
  }

  /**
   * Announce waiting
   */
  static announceWaiting(): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "waiting",
    });
    return ttsService.speak(prompt, "normal");
  }

  /**
   * Announce processing
   */
  static announceProcessing(): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "processing",
    });
    return ttsService.speak(prompt, "low");
  }

  /**
   * Announce task completion
   */
  static announceCompletion(): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "task_complete",
    });
    return ttsService.speak(prompt, "high");
  }

  /**
   * Announce error
   */
  static announceError(errorMessage: string): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "task_error",
      errorMessage: errorMessage,
    });
    return ttsService.speak(prompt, "high");
  }

  /**
   * Ask for confirmation
   */
  static async askConfirmation(): Promise<boolean> {
    const prompt = conversationPrompts.getPrompt({
      context: "asking_confirmation",
    });
    await ttsService.speak(prompt, "high");

    // Note: In a full implementation, this would wait for voice or UI confirmation
    // For now, return true (user can manually confirm in UI)
    return true;
  }

  /**
   * Announce multi-agent startup
   */
  static announceMultiAgentStart(agentNames: string[]): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "multi_agent_start",
      agents: agentNames,
    });
    return ttsService.speak(prompt, "high");
  }

  /**
   * Announce multi-agent progress
   */
  static announceMultiAgentProgress(agents: string[], progress: number): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "multi_agent_progress",
      agents: agents,
      progress: progress,
    });
    return ttsService.speak(prompt, "normal");
  }

  /**
   * Announce multi-agent completion
   */
  static announceMultiAgentComplete(): Promise<void> {
    const prompt = conversationPrompts.getPrompt({
      context: "multi_agent_complete",
    });
    return ttsService.speak(prompt, "high");
  }

  /**
   * Custom announcement with context
   */
  static announceCustom(options: PromptOptions): Promise<void> {
    const prompt = conversationPrompts.getPrompt(options);
    const priority = options.context.includes("error") || options.context.includes("confirmation")
      ? "high"
      : options.context.includes("complete")
        ? "high"
        : "normal";
    return ttsService.speak(prompt, priority);
  }

  /**
   * Stop all announcements
   */
  static stopAnnouncements(): void {
    ttsService.stop();
  }

  /**
   * Pause announcements
   */
  static pauseAnnouncements(): void {
    ttsService.pause();
  }

  /**
   * Resume announcements
   */
  static resumeAnnouncements(): void {
    ttsService.resume();
  }

  /**
   * Configure voice settings
   */
  static configureVoice(rate?: number, pitch?: number, voicePreference?: "male" | "female" | "default"): void {
    if (rate) ttsService.setRate(rate);
    if (pitch) ttsService.setPitch(pitch);
    if (voicePreference) ttsService.setVoicePreference(voicePreference);
  }
}

export default TaskVoiceIntegration;
