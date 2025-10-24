declare global {
  interface LanguageModelStatic {
    create(opts: { languageCode: string }): Promise<any>;
  }
  var LanguageModel: LanguageModelStatic | undefined;
  var ai: { languageModel?: LanguageModelStatic } | undefined;

  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}
export {};
