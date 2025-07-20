import { BaseRuntime } from "./base.js";
import { loadExternalScript } from "../utils/AsyncUtils.js";

export class JVMRuntime extends BaseRuntime {
  constructor(language, natives = {}, cheerpjOptions = {}) {
    super(language);
    this.loadedCode = null;
    this.iteration = 0;
    this.lib = null;
    this.Elevator = null;
    this.Floor = null;
    this.Buttons = null;
    this.controller = null;
    this.logBuffer = [];
    this.originalConsoleLog = null;
    this.natives = natives;
    this.cheerpjOptions = cheerpjOptions;
  }

  captureConsoleLog() {
    if (this.originalConsoleLog) return; // Already capturing

    this.originalConsoleLog = console.log;
    const self = this;

    console.log = function (...args) {
      // Check if the log message originates from cheerpOS.js
      const stack = new Error().stack;
      if (stack && stack.includes("cheerpOS.js")) {
        self.logBuffer.push(args.join(" "));
      }

      // Call the original console.log
      self.originalConsoleLog.apply(console, args);
    };
  }

  restoreConsoleLog() {
    if (this.originalConsoleLog) {
      console.log = this.originalConsoleLog;
      this.originalConsoleLog = null;
    }
  }

  resetLogBuffer() {
    this.logBuffer = [];
  }

  getLogBufferString() {
    if (this.logBuffer.length === 0) return "";
    return "\n\nCheerpJ logs:\n" + this.logBuffer.join("\n");
  }

  async loadRuntime() {
    if (this.loading || this.loaded) return;

    this.loading = true;
    this.resetLogBuffer();
    this.captureConsoleLog();

    try {
      // Load CheerpJ script with enhanced timeout handling
      await loadExternalScript(
        "https://cjrtnc.leaningtech.com/20250719_2613/loader.js",
        60000,
      );

      // Wait for cheerpjInit to be available
      if (typeof window.cheerpjInit === "undefined") {
        throw new Error("cheerpjInit is not defined after script load");
      }

      const defaultOptions = {
        status: "none",
        natives: this.natives,
        overrideDocumentBase: __BASE_URL__ ?? "/",
      };

      const initOptions = { ...defaultOptions, ...this.cheerpjOptions };
      await window.cheerpjInit(initOptions);

      // Perform language-specific compilation (including base classes if needed)
      await this.compileLanguageSpecific();

      // Load the compiled library
      this.lib = await window.cheerpjRunLibrary("/files/");
      await this.loadCompiledClasses();

      this.loaded = true;
    } catch (error) {
      this.loading = false;
      throw new Error(
        `Failed to load ${this.language} runtime: ${error.message}${this.getLogBufferString()}`,
      );
    } finally {
      this.loading = false;
    }
  }

  async compileLanguageSpecific() {
    // Override in subclasses for language-specific compilation
    throw new Error(
      "compileLanguageSpecific() must be implemented by subclass",
    );
  }

  async loadCompiledClasses() {
    // Override in subclasses to load the appropriate compiled classes
    throw new Error("loadCompiledClasses() must be implemented by subclass");
  }

  async execute(elevators, floors) {
    // Override in subclasses for language-specific execution
    throw new Error("execute() must be implemented by subclass");
  }

  dispose() {
    this.loaded = false;
    this.loadedCode = null;
    this.lib = null;
    this.Elevator = null;
    this.Floor = null;
    this.Buttons = null;
    this.controller = null;
    this.restoreConsoleLog();
    this.resetLogBuffer();
  }
}
