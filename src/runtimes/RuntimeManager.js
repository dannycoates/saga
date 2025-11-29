import { JavaScriptRuntime } from "./JavaScriptRuntime.js";
import { PythonRuntime } from "./PythonRuntime.js";
import { JavaRuntime } from "./JavaRuntime.js";

export class RuntimeManager {
  constructor() {
    this.runtimes = {
      javascript: new JavaScriptRuntime(),
      python: new PythonRuntime(),
      java: new JavaRuntime(),
    };

    this.currentLanguage = "javascript";
    this.loadingPromises = {};
  }

  get defaultTemplates() {
    return Object.fromEntries(
      Object.entries(this.runtimes).map(([name, rt]) => {
        return [name, rt.getDefaultTemplate()];
      }),
    );
  }

  async loadCurrentRuntime() {
    const language = this.currentLanguage;
    // Load the runtime if needed
    const runtime = this.runtimes[language];
    if (!runtime.isLoaded && !runtime.isLoading) {
      // Cache loading promises to avoid multiple loads
      if (!this.loadingPromises[language]) {
        this.loadingPromises[language] = runtime.loadRuntime();
      }
      await this.loadingPromises[language];
    }
    return runtime;
  }

  async selectLanguage(language) {
    if (!this.runtimes[language]) {
      throw new Error(`Unsupported language: ${language}`);
    }

    this.currentLanguage = language;

    return this.loadCurrentRuntime();
  }

  getCurrentRuntime() {
    return this.runtimes[this.currentLanguage];
  }

  async loadCode(code) {
    const runtime = this.getCurrentRuntime();

    // Ensure runtime is loaded
    if (!runtime.isLoaded) {
      await this.selectLanguage(this.currentLanguage);
    }

    // Load the code into the runtime
    await runtime.loadCode(code);
  }

  async start() {
    await this.getCurrentRuntime().start();
  }

  async execute(elevators, floors) {
    const runtime = this.getCurrentRuntime();

    // Execute the loaded code
    return await runtime.execute(elevators, floors);
  }

  cleanup() {
    // Cleanup all runtimes
    Object.values(this.runtimes).forEach((runtime) => runtime.cleanup());
  }
}
