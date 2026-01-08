import { challenges } from "../game/challenges.js";
import { APP_CONSTANTS } from "../config/constants.js";
import { isLanguageSupported } from "virtual:runtime-registry";

/**
 * @typedef {import('../app.js').ElevatorApp} ElevatorApp
 */

/**
 * Manages URL hash state for challenge selection and settings.
 * Syncs app state with URL for shareable links.
 */
export class URLManager {
  /**
   * Creates a URL manager.
   * @param {ElevatorApp} app - Application instance
   */
  constructor(app) {
    /** @type {ElevatorApp} Application reference */
    this.app = app;
    /** @type {AbortController} Controller for event listener cleanup */
    this.abortController = new AbortController();
    /** @type {(() => void) | null} Bound handler for cleanup */
    this.boundLoadFromUrl = null;
    this.setupHashChangeListener();
  }

  /**
   * Sets up listener for URL hash changes.
   * @private
   * @returns {void}
   */
  setupHashChangeListener() {
    const { signal } = this.abortController;
    this.boundLoadFromUrl = () => this.loadFromUrl();
    window.addEventListener("hashchange", this.boundLoadFromUrl, { signal });
  }

  /**
   * Parses URL hash parameters.
   * @returns {Record<string, string>} Parsed parameters
   */
  parseParams() {
    const hashParams = window.location.hash.replace(/^#/, "").split(",");
    return Object.fromEntries(
      hashParams.filter((p) => p.includes("=")).map((p) => p.split("=")),
    );
  }

  /**
   * Creates a URL hash string with merged parameters.
   * @param {Record<string, string | number>} overrides - Parameters to add/override
   * @returns {string} URL hash string (e.g., "#challenge=2,timescale=1")
   */
  createParamsUrl(overrides) {
    const current = this.parseParams();
    const merged = { ...current, ...overrides };

    return (
      "#" +
      Object.entries(merged)
        .filter(([key, val]) => key != null && val != null)
        .map(([key, val]) => `${key}=${val}`)
        .join(",")
    );
  }

  /**
   * Loads challenge and settings from current URL hash.
   * @returns {void}
   */
  loadFromUrl() {
    const params = this.parseParams();

    // Parse challenge index
    const challengeIndex = Math.min(
      Math.max(0, (parseInt(params.challenge, 10) || 0) - 1),
      challenges.length - 1,
    );

    // Parse time scale
    const timeScale =
      parseFloat(localStorage.getItem(APP_CONSTANTS.TIME_SCALE_KEY)) ||
      parseFloat(params.timescale) ||
      APP_CONSTANTS.DEFAULT_TIME_SCALE;

    // Parse language (if valid)
    const lang = params.lang;
    if (lang && isLanguageSupported(lang)) {
      // Update editor language (async, but we don't need to wait)
      this.app.editor.setLanguage(lang);
      // Update runtime manager's current language
      this.app.runtimeManager.currentLanguage =
        /** @type {import('../runtimes/BaseRuntime.js').LanguageId} */ (lang);
      // Update language selector UI
      const languageSelect = /** @type {HTMLSelectElement | null} */ (
        this.app.dom.getElement("languageSelect")
      );
      if (languageSelect) {
        languageSelect.value = lang;
      }
    }

    // Apply settings and start challenge
    this.app.loadChallenge(challengeIndex);
    this.app.setTimeScale(timeScale);
  }

  /**
   * Cleans up event listeners.
   * @returns {void}
   */
  cleanup() {
    // AbortController automatically removes all event listeners
    this.abortController.abort();

    // Clear bound handlers for memory cleanup
    this.boundLoadFromUrl = null;
  }
}
