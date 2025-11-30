import { RuntimeManager } from "./runtimes/RuntimeManager.js";
import { CodeEditor } from "./ui/CodeEditor.js";
import { AppDOM } from "./ui/AppDOM.js";
import { AppEventHandlers } from "./ui/AppEventHandlers.js";
import { URLManager } from "./utils/URLManager.js";
import { GameController } from "./game/GameController.js";
import { challenges } from "./game/challenges.js";
import { APP_CONSTANTS } from "./config/constants.js";
import { performanceMonitor } from "./ui/PerformanceMonitor.js";
import { presentChallenge } from "./ui/presenters.js";
import { EventBus } from "./utils/EventBus.js";

/**
 * @typedef {import('./game/GameController.js').Challenge} Challenge
 * @typedef {import('./core/SimulationBackend.js').UserCodeObject} UserCodeObject
 */

/**
 * Main application class for the Elevator Saga game.
 * Coordinates UI, runtime management, and game logic.
 */
export class ElevatorApp {
  /**
   * Creates and initializes the application.
   */
  constructor() {
    /** @type {EventBus} Application event bus */
    this.eventBus = new EventBus();
    /** @type {AppDOM} DOM element manager */
    this.dom = new AppDOM();
    /** @type {RuntimeManager} Multi-language runtime manager */
    this.runtimeManager = new RuntimeManager();
    /** @type {CodeEditor} Code editor instance */
    this.editor = new CodeEditor(
      this.dom.getElement("codeArea"),
      APP_CONSTANTS.STORAGE_KEY,
      this.runtimeManager.defaultTemplates,
      this,
    );
    /** @type {number} Current challenge index */
    this.currentChallengeIndex = 0;
    /** @type {GameController} Game controller */
    this.gameController = new GameController(this.eventBus);
    /** @type {URLManager} URL state manager */
    this.urlManager = new URLManager(this);
    /** @type {AppEventHandlers} Event handler coordinator */
    this.eventHandlers = new AppEventHandlers(
      this.eventBus,
      this,
      this.dom,
      this.editor,
      this.runtimeManager,
      this.gameController,
      this.urlManager,
    );

    // Setup all event handlers
    this.eventHandlers.setupAllHandlers();

    // Set the runtime manager to the editor's current language
    this.runtimeManager.currentLanguage =
      /** @type {import('./runtimes/BaseRuntime.js').LanguageId} */ (
        this.editor.currentLanguage
      );

    // Initialize with runtime
    this.initializeWithRuntime();
  }

  /**
   * Current challenge with id property added.
   * @type {Challenge & {id: number}}
   * @readonly
   */
  get currentChallenge() {
    return {
      id: this.currentChallengeIndex,
      ...challenges[this.currentChallengeIndex],
    };
  }

  /**
   * Loads and displays a challenge by index.
   * @param {number} index - Challenge index (0-based)
   * @returns {void}
   */
  loadChallenge(index) {
    this.currentChallengeIndex = index;
    this.dom.clearElements("feedback");
    presentChallenge(
      this.dom.getElement("challenge"),
      this.currentChallenge,
      this,
      this.gameController,
      this.currentChallenge.id + 1,
      this.eventBus,
    );
    this.gameController.initializeChallenge(this.currentChallenge);
  }

  /**
   * Sets the simulation time scale.
   * @param {number} timeScale - Time multiplier
   * @returns {void}
   */
  setTimeScale(timeScale) {
    this.gameController.setTimeScale(timeScale);
  }

  /**
   * Shows or hides the runtime loading status.
   * @param {boolean} show - Whether to show status
   * @param {string} [message] - Status message
   * @returns {void}
   */
  showRuntimeStatus(show, message) {
    this.dom.showRuntimeStatus(show, message);
  }

  /**
   * Shows loading status if promise takes longer than 300ms.
   * @template T
   * @param {Promise<T>} promise - Promise to wait for
   * @param {string} msg - Loading message
   * @returns {Promise<T>} The original promise result
   */
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

  /**
   * Initializes app by loading challenge and runtime.
   * @returns {Promise<void>}
   */
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
      this.eventBus.emit("app:user_code_error", error);
    } finally {
      this.showRuntimeStatus(false);
    }
  }

  /**
   * Toggles between starting and stopping the simulation.
   * @returns {void}
   */
  startOrStop() {
    if (this.gameController.isPaused) {
      // Start button clicked - start the challenge
      this.dom.clearElements("feedback");
      this.startChallenge();
    } else {
      // Stop button clicked - reset the game state
      this.gameController.end();
    }
  }

  /**
   * Loads user code and creates a code object for execution.
   * @returns {Promise<UserCodeObject | null>} Code object or null on error
   */
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
        safeTick: async (elevators, floors) => {
          try {
            await this.runtimeManager.execute(elevators, floors);
          } catch (e) {
            this.gameController.setPaused(true);
            this.eventBus.emit("app:user_code_error", e);
            // simulation errors stop here
          }
        },
      };
    } catch (e) {
      this.showRuntimeStatus(false);
      this.eventBus.emit("app:user_code_error", e);
      return null;
    }
  }

  /**
   * Starts the current challenge with user code.
   * @returns {Promise<void>}
   */
  async startChallenge() {
    // Don't start if runtime is still loading
    if (this.dom.isRuntimeLoading()) {
      console.log(APP_CONSTANTS.MESSAGES.RUNTIME_LOADING);
      return;
    }

    const codeObj = await this.getCodeObj();
    if (codeObj) {
      await this.gameController.start(codeObj);
    }
  }

  /**
   * Cleans up all app resources.
   * @returns {void}
   */
  cleanup() {
    // Clean up all managers
    this.eventHandlers.cleanup();
    this.gameController.cleanup();
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
