import { RuntimeManager } from "./runtimes/manager.js";
import { CodeEditor } from "./ui/CodeEditor.js";
import { AppDOM } from "./ui/AppDOM.js";
import { AppEventHandlers } from "./ui/AppEventHandlers.js";
import { URLManager } from "./utils/URLManager.js";
import { WorldManager } from "./game/WorldManager.js";
import { challenges } from "./game/challenges.js";
import { APP_CONSTANTS } from "./config/constants.js";
import { performanceMonitor } from "./ui/PerformanceMonitor.js";
import { presentChallenge } from "./ui/presenters.js";

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
      this.runtimeManager.defaultTemplates,
      this,
    );
    this.currentChallengeIndex = 0;
    this.worldManager = new WorldManager(this.dom);
    this.urlManager = new URLManager(this);
    this.eventHandlers = new AppEventHandlers(
      this,
      this.dom,
      this.editor,
      this.runtimeManager,
      this.worldManager,
      this.urlManager,
    );

    // Setup all event handlers
    this.eventHandlers.setupAllHandlers();

    // Set the runtime manager to the editor's current language
    this.runtimeManager.currentLanguage = this.editor.currentLanguage;

    // Initialize with runtime
    this.initializeWithRuntime();
  }

  get currentChallenge() {
    return {
      id: this.currentChallengeIndex,
      ...challenges[this.currentChallengeIndex],
    };
  }

  loadChallenge(index) {
    this.currentChallengeIndex = index;
    this.dom.clearElements("feedback");
    presentChallenge(
      this.dom.getElement("challenge"),
      this.currentChallenge,
      this,
      this.worldManager,
      this.currentChallenge.id + 1,
    );
    this.worldManager.initializeChallenge(this.currentChallenge);
  }

  setTimeScale(timeScale) {
    this.worldManager.setTimeScale(timeScale);
  }

  showRuntimeStatus(show, message) {
    this.dom.showRuntimeStatus(show, message);
  }

  async withStatusIfSlow(promise, msg) {
    const delayedStatus = new Promise((resolve) => {
      setTimeout(resolve, 300, "show");
    });

    const maybe = await Promise.race([promise, delayedStatus]);
    if (maybe === "show") {
      this.showRuntimeStatus(true, msg);
    }
    return promise;
  }

  async initializeWithRuntime() {
    // Load challenge and render world area immediately, before waiting for runtime
    this.urlManager.loadFromUrl();

    try {
      await this.withStatusIfSlow(
        this.runtimeManager.loadCurrentRuntime(),
        `Loading ${this.editor.currentLanguage} runtime...`,
      );
    } catch (error) {
      console.error("Failed to load initial runtime:", error);
      this.dispatchEvent(new CustomEvent("usercode_error", { detail: error }));
    } finally {
      this.showRuntimeStatus(false);
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
      await this.withStatusIfSlow(
        this.runtimeManager.loadCurrentRuntime(),
        `Loading ${this.editor.currentLanguage} runtime...`,
      );

      await this.withStatusIfSlow(
        this.runtimeManager.loadCode(code),
        `Compiling ${this.editor.currentLanguage} code...`,
      );

      // Hide loading
      this.showRuntimeStatus(false);

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
      this.showRuntimeStatus(false);
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
