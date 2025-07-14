import { APP_CONSTANTS } from "../config/constants.js";
import { themeManager } from "./theme-manager.js";
import { ThemeSwitcher } from "./components/theme-switcher.js";

export class AppDOM {
  constructor() {
    this.elements = {};
    this.themeSwitcher = null;
    this.initializeElements();
    this.initializeThemeSwitcher();
  }

  initializeElements() {
    const selectors = APP_CONSTANTS.SELECTORS;
    
    // Cache DOM elements
    this.elements = {
      world: document.querySelector(selectors.INNER_WORLD),
      stats: document.querySelector(selectors.STATS_CONTAINER),
      feedback: document.querySelector(selectors.FEEDBACK_CONTAINER),
      challenge: document.querySelector(selectors.CHALLENGE),
      codeStatus: document.querySelector(selectors.CODE_STATUS),
      header: document.querySelector(selectors.HEADER),
      codeArea: document.getElementById(selectors.CODE_AREA),
      saveMessage: document.getElementById(selectors.SAVE_MESSAGE),
      runtimeLoading: document.getElementById(selectors.RUNTIME_LOADING),
      languageSelect: document.getElementById(selectors.LANGUAGE_SELECT),
      buttonReset: document.getElementById(selectors.BUTTON_RESET),
      buttonResetUndo: document.getElementById(selectors.BUTTON_RESET_UNDO),
      buttonApply: document.getElementById(selectors.BUTTON_APPLY)
    };
  }

  initializeThemeSwitcher() {
    // Initialize theme manager
    themeManager.watchSystemTheme();

    // Create and add theme switcher to header
    this.themeSwitcher = new ThemeSwitcher(themeManager);
    if (this.elements.header) {
      this.elements.header.appendChild(this.themeSwitcher.getElement());
    }
  }

  getElement(name) {
    return this.elements[name];
  }

  showRuntimeLoading(show, message = "Loading runtime...") {
    const loadingIndicator = this.elements.runtimeLoading;
    const languageSelect = this.elements.languageSelect;

    if (loadingIndicator) {
      // Direct style manipulation for display (original working approach)
      loadingIndicator.style.display = show ? "inline-flex" : "none";
      
      if (show) {
        // Update the loading text
        const loadingText = loadingIndicator.querySelector(APP_CONSTANTS.SELECTORS.LOADING_TEXT);
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

  setStartButtonEnabled(enabled) {
    // Find all challenge-control elements and update their start buttons
    const challengeControls = document.querySelectorAll(APP_CONSTANTS.SELECTORS.CHALLENGE_CONTROLS);
    challengeControls.forEach((control) => {
      const button = control.shadowRoot?.querySelector(APP_CONSTANTS.SELECTORS.START_STOP_BUTTON);
      if (button) {
        button.disabled = !enabled;
        button.style.opacity = enabled ? "1" : "0.6";
        button.style.cursor = enabled ? "pointer" : "not-allowed";
      }
    });
  }

  clearElements(elementNames) {
    elementNames.forEach((name) => {
      const element = this.elements[name];
      if (element) {
        element.replaceChildren();
      }
    });
  }

  isRuntimeLoading() {
    const loadingIndicator = this.elements.runtimeLoading;
    return loadingIndicator?.style.display === 'inline-flex' ?? false;
  }

  cleanup() {
    // Clean up any event listeners or resources if needed
    if (this.themeSwitcher) {
      // Theme switcher cleanup if it has any
    }
  }
}