import { APP_CONSTANTS } from "../config/constants.js";
import {
  presentCodeStatus,
  presentFeedback,
  presentPassenger,
  presentStats,
  presentWorld,
} from "./presenters.js";
import { ResponsiveScaling } from "./ResponsiveScaling.js";
import { ViewModelManager } from "./ViewModelManager.js";

/**
 * @typedef {import('../app.js').ElevatorApp} ElevatorApp
 * @typedef {import('./AppDOM.js').AppDOM} AppDOM
 * @typedef {import('./CodeEditor.js').CodeEditor} CodeEditor
 * @typedef {import('../runtimes/RuntimeManager.js').RuntimeManager} RuntimeManager
 * @typedef {import('../game/GameController.js').GameController} GameController
 * @typedef {import('../utils/URLManager.js').URLManager} URLManager
 */

/**
 * Coordinates event handling for the application.
 * Uses AbortController for automatic cleanup of all event listeners.
 */
export class AppEventHandlers {
  /**
   * Creates event handlers coordinator.
   * @param {ElevatorApp} app - Application instance
   * @param {AppDOM} dom - DOM manager
   * @param {CodeEditor} editor - Code editor
   * @param {RuntimeManager} runtimeManager - Runtime manager
   * @param {GameController} gameController - Game controller
   * @param {URLManager} urlManager - URL manager
   */
  constructor(app, dom, editor, runtimeManager, gameController, urlManager) {
    /** @type {ElevatorApp} */
    this.app = app;
    /** @type {AppDOM} */
    this.dom = dom;
    /** @type {CodeEditor} */
    this.editor = editor;
    /** @type {RuntimeManager} */
    this.runtimeManager = runtimeManager;
    /** @type {GameController} */
    this.gameController = gameController;
    /** @type {URLManager} */
    this.urlManager = urlManager;
    /** @type {AbortController} Controller for event listener cleanup */
    this.abortController = new AbortController();
    /** @type {Record<string, EventListener>} Bound handler functions for cleanup */
    this.boundHandlers = {};
    /** @type {ResponsiveScaling} Handles responsive scaling of the game world */
    this.responsiveScaling = new ResponsiveScaling();
    /** @type {ViewModelManager} View model manager for UI rendering */
    this.viewModelManager = ViewModelManager.create();
  }

  /**
   * Sets up all event handlers.
   * @returns {void}
   */
  setupAllHandlers() {
    this.setupButtonHandlers();
    this.setupEditorHandlers();
    this.setupLanguageHandler();
    this.setupGameControllerHandlers();
    this.setupLayoutToggle();
  }

  /**
   * Sets up button click handlers.
   * @private
   * @returns {void}
   */
  setupButtonHandlers() {
    const { signal } = this.abortController;

    // Reset button
    this.dom.getElement("buttonReset")?.addEventListener(
      "click",
      () => {
        if (confirm(APP_CONSTANTS.MESSAGES.RESET_CONFIRM)) {
          // Save current code as backup for current language
          localStorage.setItem(
            `${APP_CONSTANTS.BACKUP_CODE_PREFIX}${this.editor.currentLanguage}`,
            this.editor.getCode(),
          );
          this.editor.reset();
        }
        this.editor.view.focus();
      },
      { signal },
    );

    // Reset undo button
    this.dom.getElement("buttonResetUndo")?.addEventListener(
      "click",
      () => {
        if (confirm(APP_CONSTANTS.MESSAGES.RESET_UNDO_CONFIRM)) {
          // Load backup for current language
          const backupCode = localStorage.getItem(
            `${APP_CONSTANTS.BACKUP_CODE_PREFIX}${this.editor.currentLanguage}`,
          );
          if (backupCode) {
            this.editor.setCode(backupCode);
          } else {
            alert(APP_CONSTANTS.MESSAGES.NO_BACKUP_FOUND);
          }
        }
        this.editor.view.focus();
      },
      { signal },
    );

    // Apply button
    const applyButton = this.dom.getElement("buttonApply");
    if (applyButton) {
      applyButton.addEventListener(
        "click",
        () => {
          this.editor.dispatchEvent(new CustomEvent("apply_code"));
        },
        { signal },
      );
    }
  }

  /**
   * Sets up code editor event handlers.
   * @private
   * @returns {void}
   */
  setupEditorHandlers() {
    const { signal } = this.abortController;

    // Apply code event
    this.editor.addEventListener(
      "apply_code",
      () => {
        this.app.startChallenge();
      },
      { signal },
    );

    // User code error event
    this.boundHandlers.editorError = /** @type {EventListener} */ ((e) => {
      presentCodeStatus(this.dom.getElement("codeStatus"), /** @type {CustomEvent} */ (e).detail);
    });
    this.app.addEventListener(
      "user_code_error",
      this.boundHandlers.editorError,
      { signal },
    );
  }

  /**
   * Sets up language selection handler.
   * @private
   * @returns {void}
   */
  setupLanguageHandler() {
    const { signal } = this.abortController;
    const languageSelect = /** @type {HTMLSelectElement | null} */ (this.dom.getElement("languageSelect"));
    if (languageSelect) {
      languageSelect.value = this.editor.currentLanguage;

      this.boundHandlers.languageChange = /** @type {EventListener} */ (async (e) => {
        const newLanguage = /** @type {HTMLSelectElement} */ (e.target).value;

        try {
          // Show loading state
          this.dom.showRuntimeStatus(true, `Loading ${newLanguage} runtime...`);
          // Update editor language
          this.editor.setLanguage(newLanguage);
          // Select the language in runtime manager
          // Note: not using withStatusIfSlow because pyodide blocks the event loop
          await this.runtimeManager.selectLanguage(/** @type {import('../runtimes/BaseRuntime.js').LanguageId} */ (newLanguage));

          // Clear status
          presentCodeStatus(this.dom.getElement("codeStatus"));
        } catch (error) {
          presentCodeStatus(this.dom.getElement("codeStatus"), /** @type {Error} */ (error));
          // Revert language selector
          languageSelect.value = this.editor.currentLanguage;
        } finally {
          // Hide loading state
          this.dom.showRuntimeStatus(false);
        }
      });

      languageSelect.addEventListener(
        "change",
        this.boundHandlers.languageChange,
        { signal },
      );
    }
  }

  /**
   * Sets up GameController event handlers for presentation.
   * Handles challenge initialization, simulation start, passenger spawning, and cleanup.
   * @private
   * @returns {void}
   */
  setupGameControllerHandlers() {
    const { signal } = this.abortController;

    // Challenge initialized - reinitialize ViewModelManager, present stats and world, initialize scaling
    this.gameController.addEventListener(
      "challenge_initialized",
      (e) => {
        const { clearStats, backend, options } =
          /** @type {CustomEvent<{clearStats: boolean, backend: import('../core/SimulationBackend.js').SimulationBackend, options: {isRenderingEnabled?: boolean, floorHeight?: number}}>} */ (
            e
          ).detail;

        // Clean up previous and create new ViewModelManager with challenge options
        this.viewModelManager.cleanup();
        this.viewModelManager = ViewModelManager.create({
          isRenderingEnabled: options.isRenderingEnabled,
          floorHeight: options.floorHeight,
          backend,
        });

        if (clearStats) {
          presentStats(this.dom.getElement("stats"), this.gameController);
        }
        presentWorld(this.dom.getElement("world"), this.viewModelManager);
        this.responsiveScaling.initialize();
      },
      { signal },
    );

    // Simulation started - refresh stats
    this.gameController.addEventListener(
      "simulation_started",
      () => {
        presentStats(this.dom.getElement("stats"), this.gameController);
      },
      { signal },
    );

    // Passenger spawned - present new passenger
    this.gameController.addEventListener(
      "passenger_spawned",
      (e) => {
        const { passenger } = /** @type {CustomEvent<{passenger: {id: string}}>} */ (e).detail;
        const viewModel = this.viewModelManager.passengerViewModels.get(passenger.id);
        if (viewModel) {
          presentPassenger(this.dom.getElement("world"), viewModel);
        }
      },
      { signal },
    );

    // Challenge ended - show success/failure feedback
    this.boundHandlers.challenge_ended = /** @type {EventListener} */ ((e) => {
      const { succeeded } = /** @type {CustomEvent<{succeeded: boolean}>} */ (e).detail;
      if (succeeded) {
        presentFeedback(
          this.dom.getElement("feedback"),
          APP_CONSTANTS.MESSAGES.SUCCESS_TITLE,
          APP_CONSTANTS.MESSAGES.SUCCESS_MESSAGE,
          this.urlManager.createParamsUrl({
            challenge: this.app.currentChallenge.id + 2,
          }),
        );
      } else {
        presentFeedback(
          this.dom.getElement("feedback"),
          APP_CONSTANTS.MESSAGES.FAILURE_TITLE,
          APP_CONSTANTS.MESSAGES.FAILURE_MESSAGE,
          "",
        );
      }
    });
    this.gameController.addEventListener(
      "challenge_ended",
      this.boundHandlers.challenge_ended,
      { signal },
    );

    // Cleanup - clean up ViewModelManager, clear world elements, and clean up responsive scaling
    this.gameController.addEventListener(
      "cleanup",
      () => {
        this.viewModelManager.cleanup();
        this.dom.clearElements("world");
        this.responsiveScaling.cleanup();
      },
      { signal },
    );
  }

  /**
   * Sets up layout toggle (vertical/side-by-side) and splitter resize.
   * @private
   * @returns {void}
   */
  setupLayoutToggle() {
    const { signal } = this.abortController;
    const layoutToggle = document.getElementById("layout-toggle");
    const container = document.querySelector(".container");
    const mainContent = document.querySelector(".main-content");
    const splitter = document.getElementById("layout-splitter");

    if (!layoutToggle || !container || !mainContent || !splitter) return;

    // Initialize layout state
    let isResizing = false;
    let isSideBySide = false;

    // Load saved layout preference (default to side-by-side)
    const savedLayout = localStorage.getItem("layout-preference");
    const shouldUseSideBySide =
      savedLayout === null || savedLayout === "side-by-side";

    // Layout toggle functionality
    this.boundHandlers.layoutToggle = /** @type {EventListener} */ (() => {
      isSideBySide = !isSideBySide;

      // Toggle single class on container
      container.classList.toggle("side-by-side", isSideBySide);

      // Update CodeMirror layout mode
      if (this.editor && this.editor.setLayoutMode) {
        this.editor.setLayoutMode(isSideBySide);
      }

      // Update button icon
      const icon = layoutToggle.querySelector(".layout-icon");
      if (icon) {
        icon.textContent = isSideBySide ? "⚎" : "⚏";
      }

      // Save layout preference
      localStorage.setItem(
        "layout-preference",
        isSideBySide ? "side-by-side" : "vertical",
      );
    });

    // Splitter resize functionality
    this.boundHandlers.splitterMouseDown = /** @type {EventListener} */ ((e) => {
      if (!isSideBySide) return;

      isResizing = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      e.preventDefault();
    });

    this.boundHandlers.splitterMouseMove = /** @type {EventListener} */ ((e) => {
      if (!isResizing || !isSideBySide) return;

      const containerRect = mainContent.getBoundingClientRect();
      const codeSection = /** @type {HTMLElement | null} */ (mainContent.querySelector(".code-section"));
      const mouseEvent = /** @type {MouseEvent} */ (e);
      const newWidth = ((mouseEvent.clientX - containerRect.left) / containerRect.width) * 100;

      // Constrain between 20% and 80%
      const constrainedWidth = Math.max(20, Math.min(80, newWidth));

      if (codeSection) {
        codeSection.style.flex = `0 0 ${constrainedWidth}%`;
      }

      e.preventDefault();
    });

    this.boundHandlers.splitterMouseUp = /** @type {EventListener} */ (() => {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    });

    // Add event listeners
    layoutToggle.addEventListener("click", this.boundHandlers.layoutToggle, {
      signal,
    });
    splitter.addEventListener(
      "mousedown",
      this.boundHandlers.splitterMouseDown,
      { signal },
    );
    document.addEventListener(
      "mousemove",
      this.boundHandlers.splitterMouseMove,
      { signal },
    );
    document.addEventListener("mouseup", this.boundHandlers.splitterMouseUp, {
      signal,
    });

    // Initialize layout based on saved preference
    isSideBySide = shouldUseSideBySide;

    // Set single class on container
    container.classList.toggle("side-by-side", isSideBySide);

    // Update CodeMirror layout mode
    if (this.editor && this.editor.setLayoutMode) {
      this.editor.setLayoutMode(isSideBySide);
    }

    // Update button icon
    const icon = layoutToggle.querySelector(".layout-icon");
    if (icon) {
      icon.textContent = isSideBySide ? "⚎" : "⚏";
    }
  }

  /**
   * Cleans up all event listeners via AbortController.
   * @returns {void}
   */
  cleanup() {
    // AbortController automatically removes all event listeners
    this.abortController.abort();

    // Clear bound handlers for memory cleanup
    this.boundHandlers = {};
  }
}
