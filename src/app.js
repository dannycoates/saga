import { RuntimeManager } from "./runtimes/manager.js";
import { CodeEditor } from "./ui/CodeEditor.js";
import { AppDOM } from "./ui/AppDOM.js";
import { AppEventHandlers } from "./ui/AppEventHandlers.js";
import { URLManager } from "./utils/URLManager.js";
import { WorldManager } from "./game/WorldManager.js";
import { ChallengeManager } from "./game/ChallengeManager.js";
import { APP_CONSTANTS } from "./config/constants.js";
import { performanceMonitor } from "./ui/PerformanceMonitor.js";

// Main Application class
export class ElevatorApp extends EventTarget {
  constructor() {
    super();

    // Initialize managers
    this.dom = new AppDOM();
    this.runtimeManager = new RuntimeManager();
    this.editor = new CodeEditor(
      this.dom.getElement("codeArea"),
      APP_CONSTANTS.STORAGE_KEY,
      this.runtimeManager,
      this,
    );

    this.worldManager = new WorldManager(this.dom);
    this.urlManager = new URLManager(this);
    this.challengeManager = new ChallengeManager(
      this.dom,
      this.worldManager,
      this.urlManager,
    );
    this.eventHandlers = new AppEventHandlers(
      this,
      this.dom,
      this.editor,
      this.runtimeManager,
    );

    // Setup all event handlers
    this.eventHandlers.setupAllHandlers();

    // Set the runtime manager to the editor's current language
    this.runtimeManager.currentLanguage = this.editor.currentLanguage;

    // Initialize with runtime
    this.initializeWithRuntime();
  }

  // Delegation methods for managers
  getCurrentChallengeIndex() {
    return this.challengeManager.getCurrentChallengeIndex();
  }

  loadChallenge(index) {
    this.dom.clearElements("feedback");
    this.challengeManager.showChallenge(index, this);
  }

  setTimeScale(timeScale) {
    this.worldManager.setTimeScale(timeScale);
  }

  showRuntimeLoading(show, message) {
    this.dom.showRuntimeLoading(show, message);
  }

  async initializeWithRuntime() {
    // Load challenge and render world area immediately, before waiting for runtime
    this.urlManager.loadFromUrl();

    // Load runtime in parallel - this won't block the world rendering
    const runtime = this.runtimeManager.getCurrentRuntime();
    if (!runtime.loaded) {
      // Show loading state
      this.showRuntimeLoading(
        true,
        `Loading ${this.editor.currentLanguage} runtime...`,
      );

      try {
        // Pre-load the runtime in the background
        await this.runtimeManager.selectLanguage(this.editor.currentLanguage);
        this.showRuntimeLoading(false);
      } catch (error) {
        console.error("Failed to load initial runtime:", error);
        this.showRuntimeLoading(false);
      }
    }
  }

  startOrStop() {
    if (this.worldManager.isPaused) {
      // Start button clicked - start the challenge
      this.dom.clearElements("feedback");
      this.startChallenge();
    } else {
      // Stop button clicked - reset the game state
      this.worldManager.end();
    }
  }

  async getCodeObj() {
    const code = this.editor.getCode();

    try {
      // Show loading for language selection if needed
      const currentRuntime = this.runtimeManager.getCurrentRuntime();
      if (!currentRuntime || !currentRuntime.loaded) {
        this.showRuntimeLoading(
          true,
          `Loading ${this.editor.currentLanguage} runtime...`,
        );
      }

      // Select the language and load the code
      await this.runtimeManager.selectLanguage(this.editor.currentLanguage);

      // Show loading for code compilation/loading
      this.showRuntimeLoading(
        true,
        `Compiling ${this.editor.currentLanguage} code...`,
      );
      await this.runtimeManager.loadCode(code);

      // Hide loading
      this.showRuntimeLoading(false);

      // Return a wrapper object that calls the runtime manager
      return {
        start: this.runtimeManager.start.bind(this.runtimeManager),
        tick: async (elevators, floors) => {
          try {
            await this.runtimeManager.execute(elevators, floors);
          } catch (e) {
            this.worldManager.setPaused(true);
            this.dispatchEvent(
              new CustomEvent("usercode_error", { detail: e }),
            );
            throw e;
          }
        },
      };
    } catch (e) {
      this.showRuntimeLoading(false);
      this.dispatchEvent(new CustomEvent("usercode_error", { detail: e }));
      return null;
    }
  }

  async startChallenge() {
    const codeObj = await this.getCodeObj();
    if (codeObj) {
      await this.worldManager.start(codeObj);
    }
  }

  cleanup() {
    // Clean up all managers
    this.eventHandlers.cleanup();
    this.worldManager.cleanup();
    this.challengeManager.cleanup();
    this.urlManager.cleanup();
    this.dom.cleanup();
    performanceMonitor.cleanup();
  }
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.app = new ElevatorApp();
  });
} else {
  window.app = new ElevatorApp();
}
