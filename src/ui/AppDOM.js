import { APP_CONSTANTS } from "../config/constants.js";
import { themeManager } from "./ThemeManager.js";
import { ThemeSwitcher } from "./components/theme-switcher.js";

/**
 * @typedef {Object} DOMElements
 * @property {HTMLElement | null} world - World container
 * @property {HTMLElement | null} stats - Stats container
 * @property {HTMLElement | null} feedback - Feedback container
 * @property {HTMLElement | null} challenge - Challenge container
 * @property {HTMLElement | null} codeStatus - Code status container
 * @property {HTMLElement | null} header - Header element
 * @property {HTMLElement | null} codeArea - Code editor area
 * @property {HTMLElement | null} saveMessage - Save message element
 * @property {HTMLElement | null} runtimeLoading - Runtime loading indicator
 * @property {HTMLSelectElement | null} languageSelect - Language select dropdown
 * @property {HTMLButtonElement | null} buttonReset - Reset button
 * @property {HTMLButtonElement | null} buttonResetUndo - Reset undo button
 * @property {HTMLButtonElement | null} buttonApply - Apply button
 */

/**
 * Manages DOM element caching and manipulation.
 * Provides centralized access to UI elements.
 */
export class AppDOM {
  /**
   * Creates DOM manager and initializes element cache.
   */
  constructor() {
    /** @type {Partial<DOMElements>} Cached DOM elements */
    this.elements = {};
    /** @type {ThemeSwitcher | null} Theme switcher component */
    this.themeSwitcher = null;
    this.initializeElements();
    this.initializeThemeSwitcher();
  }

  /**
   * Caches DOM elements for quick access.
   * @private
   * @returns {void}
   */
  initializeElements() {
    const selectors = APP_CONSTANTS.SELECTORS;

    // Cache DOM elements
    this.elements = {
      world: /** @type {HTMLElement | null} */ (
        document.querySelector(selectors.INNER_WORLD)
      ),
      stats: /** @type {HTMLElement | null} */ (
        document.querySelector(selectors.STATS_CONTAINER)
      ),
      feedback: /** @type {HTMLElement | null} */ (
        document.querySelector(selectors.FEEDBACK_CONTAINER)
      ),
      challenge: /** @type {HTMLElement | null} */ (
        document.querySelector(selectors.CHALLENGE)
      ),
      codeStatus: /** @type {HTMLElement | null} */ (
        document.querySelector(selectors.CODE_STATUS)
      ),
      header: /** @type {HTMLElement | null} */ (
        document.querySelector(selectors.HEADER)
      ),
      codeArea: document.getElementById(selectors.CODE_AREA),
      saveMessage: document.getElementById(selectors.SAVE_MESSAGE),
      runtimeLoading: document.getElementById(selectors.RUNTIME_LOADING),
      languageSelect: /** @type {HTMLSelectElement | null} */ (
        document.getElementById(selectors.LANGUAGE_SELECT)
      ),
      buttonReset: /** @type {HTMLButtonElement | null} */ (
        document.getElementById(selectors.BUTTON_RESET)
      ),
      buttonResetUndo: /** @type {HTMLButtonElement | null} */ (
        document.getElementById(selectors.BUTTON_RESET_UNDO)
      ),
      buttonApply: /** @type {HTMLButtonElement | null} */ (
        document.getElementById(selectors.BUTTON_APPLY)
      ),
    };
  }

  /**
   * Initializes theme switcher component.
   * @private
   * @returns {void}
   */
  initializeThemeSwitcher() {
    // Initialize theme manager
    themeManager.watchSystemTheme();

    // Create and add theme switcher to header-controls
    this.themeSwitcher = new ThemeSwitcher(themeManager);
    const headerControls = document.querySelector(".header-controls");
    if (headerControls) {
      headerControls.appendChild(this.themeSwitcher.getElement());
    }
  }

  /**
   * Gets a cached DOM element by name.
   * @param {keyof DOMElements} name - Element name
   * @returns {HTMLElement | null} The element or null
   */
  getElement(name) {
    return this.elements[name] ?? null;
  }

  /**
   * Shows or hides runtime loading status.
   * @param {boolean} show - Whether to show the loading indicator
   * @param {string} [message="Loading runtime..."] - Loading message
   * @returns {void}
   */
  showRuntimeStatus(show, message = "Loading runtime...") {
    const loadingIndicator = this.elements.runtimeLoading;
    const languageSelect = this.elements.languageSelect;

    if (loadingIndicator) {
      // Direct style manipulation for display (original working approach)
      loadingIndicator.style.display = show ? "inline-flex" : "none";

      if (show) {
        // Update the loading text
        const loadingText = loadingIndicator.querySelector(
          APP_CONSTANTS.SELECTORS.LOADING_TEXT,
        );
        if (loadingText) {
          loadingText.textContent = message;
        }
      }
    }

    // Use disabled property instead of style manipulation
    if (languageSelect) {
      languageSelect.disabled = show;
    }
    this.setStartButtonEnabled(!show);
  }

  /**
   * Enables or disables all start buttons.
   * @param {boolean} enabled - Whether buttons should be enabled
   * @returns {void}
   */
  setStartButtonEnabled(enabled) {
    // Find all challenge-control elements and update their start buttons
    const challengeControls = document.querySelectorAll(
      APP_CONSTANTS.SELECTORS.CHALLENGE_CONTROLS,
    );
    challengeControls.forEach((control) => {
      const button = /** @type {HTMLButtonElement | null} */ (
        control.shadowRoot?.querySelector(
          APP_CONSTANTS.SELECTORS.START_STOP_BUTTON,
        )
      );
      if (button) {
        button.disabled = !enabled;
        button.style.opacity = enabled ? "1" : "0.6";
        button.style.cursor = enabled ? "pointer" : "not-allowed";
      }
    });
  }

  /**
   * Clears content of specified elements.
   * @param {...keyof DOMElements} elementNames - Element names to clear
   * @returns {void}
   */
  clearElements(...elementNames) {
    elementNames.forEach((name) => {
      const element = this.elements[name];
      if (element) {
        element.replaceChildren();
      }
    });
  }

  /**
   * Checks if runtime is currently loading.
   * @returns {boolean} True if loading indicator is visible
   */
  isRuntimeLoading() {
    const loadingIndicator = this.elements.runtimeLoading;
    return loadingIndicator?.style.display === "inline-flex" || false;
  }

  /**
   * Cleans up DOM manager resources.
   * @returns {void}
   */
  cleanup() {
    // Clean up any event listeners or resources if needed
    if (this.themeSwitcher) {
      // Theme switcher cleanup if it has any
    }
  }
}
