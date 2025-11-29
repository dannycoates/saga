import { JavaScriptRuntime } from "./JavaScriptRuntime.js";
import { PythonRuntime } from "./PythonRuntime.js";
import { JavaRuntime } from "./JavaRuntime.js";

/**
 * @typedef {import('./BaseRuntime.js').LanguageId} LanguageId
 * @typedef {import('./BaseRuntime.js').BaseRuntime} BaseRuntime
 * @typedef {import('./BaseRuntime.js').ElevatorAPI} ElevatorAPI
 * @typedef {import('./BaseRuntime.js').FloorAPI} FloorAPI
 */

/**
 * Manages multiple language runtimes and coordinates code execution.
 * Handles language switching, runtime loading, and code execution.
 */
export class RuntimeManager {
  /**
   * Creates a runtime manager with all available language runtimes.
   */
  constructor() {
    /** @type {Record<LanguageId, BaseRuntime>} Map of language ID to runtime instance */
    this.runtimes = {
      javascript: new JavaScriptRuntime(),
      python: new PythonRuntime(),
      java: new JavaRuntime(),
    };

    /** @type {LanguageId} Currently selected language */
    this.currentLanguage = "javascript";
    /** @type {Partial<Record<LanguageId, Promise<void>>>} Cached loading promises to avoid duplicate loads */
    this.loadingPromises = {};
  }

  /**
   * Default code templates for all languages.
   * @type {Record<string, string>}
   * @readonly
   */
  get defaultTemplates() {
    return Object.fromEntries(
      Object.entries(this.runtimes).map(([name, rt]) => {
        return [name, rt.getDefaultTemplate()];
      }),
    );
  }

  /**
   * Loads the current runtime if not already loaded.
   * Caches loading promises to avoid duplicate initialization.
   * @returns {Promise<BaseRuntime>} The loaded runtime
   */
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

  /**
   * Selects a language and loads its runtime.
   * @param {LanguageId} language - Language to select
   * @returns {Promise<BaseRuntime>} The loaded runtime
   * @throws {Error} If language is not supported
   */
  async selectLanguage(language) {
    if (!this.runtimes[language]) {
      throw new Error(`Unsupported language: ${language}`);
    }

    this.currentLanguage = language;

    return this.loadCurrentRuntime();
  }

  /**
   * Gets the currently selected runtime.
   * @returns {BaseRuntime} Current runtime instance
   */
  getCurrentRuntime() {
    return this.runtimes[this.currentLanguage];
  }

  /**
   * Loads user code into the current runtime.
   * Ensures runtime is loaded before loading code.
   * @param {string} code - User code to load
   * @returns {Promise<void>}
   */
  async loadCode(code) {
    const runtime = this.getCurrentRuntime();

    // Ensure runtime is loaded
    if (!runtime.isLoaded) {
      await this.selectLanguage(this.currentLanguage);
    }

    // Load the code into the runtime
    await runtime.loadCode(code);
  }

  /**
   * Starts the current runtime (called before execution begins).
   * @returns {Promise<void>}
   */
  async start() {
    await this.getCurrentRuntime().start();
  }

  /**
   * Executes the user's tick function with current game state.
   * @param {ElevatorAPI[]} elevators - Array of elevator API objects
   * @param {FloorAPI[]} floors - Array of floor API objects
   * @returns {Promise<void>}
   */
  async execute(elevators, floors) {
    const runtime = this.getCurrentRuntime();

    // Execute the loaded code
    return await runtime.execute(elevators, floors);
  }

  /**
   * Cleans up all runtimes.
   * @returns {void}
   */
  cleanup() {
    // Cleanup all runtimes
    Object.values(this.runtimes).forEach((runtime) => runtime.cleanup());
  }
}
