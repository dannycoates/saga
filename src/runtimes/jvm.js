import { BaseRuntime } from "./base.js";
import { loadExternalScript } from "../utils/AsyncUtils.js";

let LIB = null;

const JSNATIVE_SOURCE = `import java.util.*;
  public class JSNative {
    // Native method to call JavaScript
    public static native void jsGoToFloor(int elevator, int floor);
  }`;

let ELEVATORS = [];
async function Java_JSNative_jsGoToFloor(lib, elevatorId, floor) {
  // Find the corresponding JavaScript elevator
  const jsElevator = ELEVATORS[elevatorId];
  if (jsElevator) {
    jsElevator.goToFloor(floor);
  }
}

async function Java_Elevator_hello() {
  console.log("hello from cheerpj");
}

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
    // this.natives = natives;
    this.natives = {
      Java_JSNative_jsGoToFloor,
    };
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
      if (typeof window.cheerpjInit === "undefined") {
        await loadExternalScript(
          "https://cjrtnc.leaningtech.com/20250719_2613/loader.js",
          60000,
        );
        const defaultOptions = {
          status: "none",
          natives: {},
          overrideDocumentBase: __BASE_URL__ ?? "/",
        };

        const initOptions = { ...defaultOptions, ...this.cheerpjOptions };
        await window.cheerpjInit({ natives: this.natives });
      }
      const jsNativeFile = "/str/JSNative.java";
      window.cheerpOSAddStringFile(jsNativeFile, JSNATIVE_SOURCE);
      const classPath = `/app${__BASE_URL__}tools.jar:/files/`;
      const compileResult = await window.cheerpjRunMain(
        "com.sun.tools.javac.Main",
        classPath,
        jsNativeFile,
        "-d",
        "/files/",
        "-Xlint:none",
      );

      if (compileResult !== 0) {
        throw new Error("Java base class compilation failed");
      }

      // Perform language-specific compilation (including base classes if needed)
      await this.compileLanguageSpecific();

      if (!LIB) {
        this.lib = await window.cheerpjRunLibrary(
          "/app/scala-library.jar:/files/",
        );
        LIB = this.lib;
      } else {
        this.lib = LIB;
      }
      // Load the compiled library
      await this.loadCompiledClasses();

      this.loaded = true;
    } catch (error) {
      this.loading = false;
      throw new Error(
        `Failed to load ${this.language} runtime: ${error?.message ?? error}${this.getLogBufferString()}`,
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
    if (!this.loaded) {
      throw new Error("JVM runtime not loaded");
    }
    ELEVATORS = elevators;
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
