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
      this.dom.getElement('codeArea'),
      APP_CONSTANTS.STORAGE_KEY,
      this.runtimeManager,
    );
    
    this.worldManager = new WorldManager(this.dom);
    this.urlManager = new URLManager(this);
    this.challengeManager = new ChallengeManager(this.dom, this.worldManager, this.urlManager);
    this.eventHandlers = new AppEventHandlers(this, this.dom, this.editor, this.runtimeManager);

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

  setCurrentChallengeIndex(index) {
    this.challengeManager.setCurrentChallengeIndex(index);
  }

  setTimeScale(timeScale) {
    this.worldManager.setTimeScale(timeScale);
  }

  getWorldController() {
    return this.worldManager.getWorldController();
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

  startStopOrRestart() {
    this.worldManager.startStopOrRestart(this);
  }

  async startChallenge(challengeIndex, autoStart) {
    performanceMonitor.mark('challenge-start');
    try {
      await this.challengeManager.startChallenge(challengeIndex, autoStart, this.editor, this);
      performanceMonitor.mark('challenge-end');
      performanceMonitor.measure('challenge-duration', 'challenge-start', 'challenge-end');
    } catch (error) {
      performanceMonitor.mark('challenge-error');
      throw error;
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
