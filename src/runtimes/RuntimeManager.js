import {
  runtimeRegistry,
  runtimeImports,
  isLanguageSupported,
} from "virtual:runtime-registry";

/**
 * @typedef {import('./BaseRuntime.js').LanguageId} LanguageId
 * @typedef {import('./BaseRuntime.js').BaseRuntime} BaseRuntime
 * @typedef {import('./BaseRuntime.js').ElevatorAPI} ElevatorAPI
 * @typedef {import('./BaseRuntime.js').FloorAPI} FloorAPI
 */

/**
 * Manages multiple language runtimes and coordinates code execution.
 * Handles language switching, runtime loading, and code execution.
 * Uses dynamic imports to load runtime modules on demand.
 */
export class RuntimeManager {
  /**
   * Creates a runtime manager.
   * Runtime modules are loaded dynamically when needed.
   */
  constructor() {
    /** @type {Map<string, BaseRuntime>} Loaded runtime instances */
    this.runtimes = new Map();

    /** @type {Map<string, object>} Loaded runtime modules */
    this.loadedModules = new Map();

    /** @type {Map<string, Promise<object>>} Module loading promises to avoid duplicate loads */
    this.moduleLoadingPromises = new Map();

    /** @type {Map<string, Promise<void>>} Runtime initialization promises */
    this.runtimeLoadingPromises = new Map();

    /** @type {LanguageId} Currently selected language */
    this.currentLanguage = "javascript";
  }

  /**
   * Dynamically imports a runtime module.
   * @param {string} language - Language identifier
   * @returns {Promise<object>} The runtime module
   */
  async loadRuntimeModule(language) {
    // Return cached module if already loaded
    if (this.loadedModules.has(language)) {
      return /** @type {object} */ (this.loadedModules.get(language));
    }

    // Return existing loading promise if in progress
    if (this.moduleLoadingPromises.has(language)) {
      return /** @type {Promise<object>} */ (
        this.moduleLoadingPromises.get(language)
      );
    }

    if (!isLanguageSupported(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Start loading and cache the promise
    const loadPromise = runtimeImports[language]().then((module) => {
      this.loadedModules.set(language, module);
      this.moduleLoadingPromises.delete(language);
      return module;
    });

    this.moduleLoadingPromises.set(language, loadPromise);
    return loadPromise;
  }

  /**
   * Gets or creates a runtime instance for a language.
   * @param {string} language - Language identifier
   * @returns {Promise<BaseRuntime>} The runtime instance
   */
  async getOrCreateRuntime(language) {
    if (this.runtimes.has(language)) {
      return /** @type {BaseRuntime} */ (this.runtimes.get(language));
    }

    const module = await this.loadRuntimeModule(language);

    // Get the runtime class (default export)
    const RuntimeClass = /** @type {any} */ (module).default;
    const instance = new RuntimeClass();

    this.runtimes.set(language, instance);
    return instance;
  }

  /**
   * Gets the default template for a specific language.
   * @param {string} language - Language identifier
   * @returns {Promise<string>} The default code template
   */
  async getDefaultTemplate(language) {
    const runtime = await this.getOrCreateRuntime(language);
    return runtime.getDefaultTemplate();
  }

  /**
   * Gets default templates for all languages.
   * Loads all runtime modules to get their templates.
   * @returns {Promise<Record<string, string>>}
   */
  async getDefaultTemplates() {
    /** @type {Record<string, string>} */
    const templates = {};
    for (const info of runtimeRegistry) {
      templates[info.id] = await this.getDefaultTemplate(info.id);
    }
    return templates;
  }

  /**
   * Loads the current runtime if not already loaded.
   * Caches loading promises to avoid duplicate initialization.
   * @returns {Promise<BaseRuntime>} The loaded runtime
   */
  async loadCurrentRuntime() {
    const language = this.currentLanguage;
    const runtime = await this.getOrCreateRuntime(language);

    if (!runtime.isLoaded && !runtime.isLoading) {
      // Cache loading promises to avoid multiple loads
      if (!this.runtimeLoadingPromises.has(language)) {
        this.runtimeLoadingPromises.set(language, runtime.loadRuntime());
      }
      await this.runtimeLoadingPromises.get(language);
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
    if (!isLanguageSupported(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    this.currentLanguage = language;

    return this.loadCurrentRuntime();
  }

  /**
   * Gets the currently selected runtime.
   * Returns null if runtime hasn't been loaded yet.
   * @returns {BaseRuntime|null} Current runtime instance or null
   */
  getCurrentRuntime() {
    return this.runtimes.get(this.currentLanguage) || null;
  }

  /**
   * Gets the currently selected runtime, loading it if necessary.
   * @returns {Promise<BaseRuntime>} Current runtime instance
   */
  async getCurrentRuntimeAsync() {
    return this.getOrCreateRuntime(this.currentLanguage);
  }

  /**
   * Loads user code into the current runtime.
   * Ensures runtime is loaded before loading code.
   * @param {string} code - User code to load
   * @returns {Promise<void>}
   */
  async loadCode(code) {
    const runtime = await this.getCurrentRuntimeAsync();

    // Ensure runtime is loaded
    if (!runtime.isLoaded) {
      await this.loadCurrentRuntime();
    }

    // Load the code into the runtime
    await runtime.loadCode(code);
  }

  /**
   * Starts the current runtime (called before execution begins).
   * @returns {Promise<void>}
   */
  async start() {
    const runtime = await this.getCurrentRuntimeAsync();
    await runtime.start();
  }

  /**
   * Executes the user's tick function with current game state.
   * @param {ElevatorAPI[]} elevators - Array of elevator API objects
   * @param {FloorAPI[]} floors - Array of floor API objects
   * @returns {Promise<void>}
   */
  async execute(elevators, floors) {
    const runtime = await this.getCurrentRuntimeAsync();
    return await runtime.execute(elevators, floors);
  }

  /**
   * Cleans up all loaded runtimes.
   * @returns {void}
   */
  cleanup() {
    this.runtimes.forEach((runtime) => runtime.cleanup());
  }
}
