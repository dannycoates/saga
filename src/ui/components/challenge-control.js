import { EventBus } from "../../utils/EventBus.js";

/**
 * @typedef {import('../../app.js').ElevatorApp} ElevatorApp
 * @typedef {import('../../game/GameController.js').GameController} GameController
 */

/**
 * @typedef {Object} CachedElements
 * @property {HTMLButtonElement | null} startStopButton - Start/stop button
 * @property {HTMLElement | null} timeDisplay - Time scale display element
 */

/**
 * Custom element for challenge controls including start/stop and time scale.
 * Displays challenge information and provides game control buttons.
 * @extends HTMLElement
 */
export class ChallengeControl extends HTMLElement {
  /** @type {ElevatorApp | null} */
  #app = null;
  /** @type {GameController | null} */
  #gameController = null;
  /** @type {EventBus | null} */
  #eventBus = null;
  /** @type {AbortController | null} */
  #abortController = null;
  /** @type {CachedElements | null} */
  #cachedElements = null;

  /**
   * Observed attributes for attribute change callbacks.
   * @returns {string[]} List of observed attribute names
   */
  static get observedAttributes() {
    return [
      "challenge-num",
      "challenge-description",
      "time-scale",
      "is-paused",
    ];
  }

  /**
   * Creates a challenge control element.
   */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  /**
   * Called when element is added to the DOM.
   * @returns {void}
   */
  connectedCallback() {
    this.initializeDOM();
    this.cacheElements();
    this.attachEventListeners();
  }

  /**
   * Caches frequently accessed DOM elements for better performance.
   * @private
   * @returns {void}
   */
  cacheElements() {
    // Cache frequently accessed elements for better performance
    this.#cachedElements = {
      startStopButton: this.shadowRoot?.querySelector(".startstop") ?? null,
      timeDisplay: this.shadowRoot?.querySelector(".time-scale-value") ?? null,
    };
  }

  /**
   * Called when element is removed from the DOM.
   * Cleans up event listeners.
   * @returns {void}
   */
  disconnectedCallback() {
    this.#abortController?.abort();
  }

  /**
   * Called when an observed attribute changes.
   * @param {string} name - Attribute name
   * @param {string | null} oldValue - Previous value
   * @param {string | null} newValue - New value
   * @returns {void}
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.updateDisplay();
    }
  }

  /**
   * Sets the application instance.
   * @param {ElevatorApp} app - Application instance
   */
  set app(app) {
    this.#app = app;
  }

  /**
   * Sets the event bus and subscribes to time scale changes.
   * @param {EventBus} eventBus - Event bus instance
   */
  set eventBus(eventBus) {
    // Clean up previous subscription
    this.#abortController?.abort();

    this.#eventBus = eventBus;

    if (eventBus) {
      this.#abortController = new AbortController();
      eventBus.on(
        "game:timescale_changed",
        (e) => {
          const { timeScale, isPaused } = /** @type {CustomEvent} */ (e).detail;
          this.setAttribute("time-scale", timeScale.toFixed(0) + "x");
          this.setAttribute("is-paused", String(isPaused));
        },
        { signal: this.#abortController.signal },
      );
    }
  }

  /**
   * Sets the game controller for initial values and control actions.
   * @param {GameController} manager - Game controller instance
   */
  set gameController(manager) {
    this.#gameController = manager;

    if (manager) {
      // Set initial values
      this.setAttribute("time-scale", manager.timeScale.toFixed(0) + "x");
      this.setAttribute("is-paused", String(manager.isPaused));
    }
  }

  /**
   * Attaches click event listeners using event delegation.
   * Handles start/stop and time scale buttons.
   * @private
   * @returns {void}
   */
  attachEventListeners() {
    // Use event delegation for better performance and cleaner code
    this.shadowRoot?.addEventListener("click", (e) => {
      const target = /** @type {Element} */ (e.target);
      const button = target.closest("button");
      if (!button) return;

      // Use matches() for efficient button identification
      if (button.matches(".startstop")) {
        if (this.#app) {
          this.#app.startOrStop();
        }
      } else if (button.matches(".timescale_increase")) {
        e.preventDefault();
        if (this.#gameController && this.#gameController.timeScale < 40) {
          const timeScale = Math.round(this.#gameController.timeScale * 1.618);
          this.#gameController.setTimeScale(timeScale);
        }
      } else if (button.matches(".timescale_decrease")) {
        e.preventDefault();
        if (this.#gameController) {
          const timeScale = Math.round(this.#gameController.timeScale / 1.618);
          this.#gameController.setTimeScale(timeScale);
        }
      }
    });
  }

  /**
   * Updates the display based on current attribute values.
   * Updates button text and time scale display.
   * @private
   * @returns {void}
   */
  updateDisplay() {
    // Use cached elements for better performance
    const { startStopButton, timeDisplay } = this.#cachedElements || {};

    if (startStopButton) {
      const isPaused = this.getAttribute("is-paused") === "true";
      startStopButton.textContent = isPaused ? "Start" : "Stop";
    }

    if (timeDisplay) {
      timeDisplay.textContent = this.getAttribute("time-scale") || "1x";
    }
  }

  /**
   * Initializes the component's shadow DOM content.
   * @private
   * @returns {void}
   */
  initializeDOM() {
    const challengeNum = this.getAttribute("challenge-num") || "";
    const description = this.getAttribute("challenge-description") || "";
    const timeScale = this.getAttribute("time-scale") || "1x";
    const isPaused = this.getAttribute("is-paused") === "true";

    /** @type {ShadowRoot} */ (this.shadowRoot).innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 5px 0;

          /* CSS-based state management */
          --state-paused: 0;
          --state-running: 1;
        }

        :host([is-paused="true"]) {
          --state-paused: 1;
          --state-running: 0;
        }

        .challenge-info {
          flex: 1;
        }

        .controls-group {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        h3 {
          line-height: 30px;
          font-size: 20px;
          margin: 0;
          color: var(--text-primary, #3c3836);
          font-weight: normal;
        }

        button {
          height: 32px;
          line-height: 18px;
          font-size: 17px;
          font-weight: bold;
          padding-left: 12px;
          padding-right: 12px;
          color: var(--button-text, #fbf1c7);
          background-color: var(--accent-secondary, #458588);
          text-shadow: none;
          border: 1px solid var(--accent-tertiary, #076678);
          border-radius: 5px;
          cursor: pointer;
          width: 110px;
          transition: all 0.2s ease;

          /* Use CSS state variables for dynamic styling */
          opacity: calc(var(--state-running) * 1 + var(--state-paused) * 0.8);
          transform: scale(calc(var(--state-running) * 1 + var(--state-paused) * 0.98));
        }

        button:hover:not(:disabled) {
          background-color: var(--accent-tertiary, #076678);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .timescale-controls {
          display: flex;
          align-items: center;
        }

        .timescale_decrease,
        .timescale_increase {
          margin: 0 4px;
          padding: 4px 4px;
          line-height: 20px;
          cursor: pointer;
          color: var(--text-primary, #3c3836);
          background: transparent;
          border: none;
          display: inline-flex;
          align-items: center;
          border-radius: 3px;
          transition: background-color 0.2s ease;
          width: auto;
          height: auto;
          font-size: inherit;
          font-weight: inherit;
        }

        .timescale_decrease:hover,
        .timescale_increase:hover {
          background-color: var(--bg-tertiary, #bdae93);
          color: var(--button-text);
        }

        .timescale_decrease svg,
        .timescale_increase svg {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }

        .time-scale-value {
          color: var(--text-primary, #3c3836);
          text-shadow: none;
          display: inline-block;
          width: 22px;
          text-align: center;
          font-weight: bold;
        }

        .unselectable {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
      </style>

      <div class="challenge-info">
        <h3>Challenge #${challengeNum}: <span id="description"></span></h3>
      </div>
      <div class="controls-group">
        <div class="timescale-controls">
          <button class="timescale_decrease unselectable" aria-label="Decrease time scale">
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="7" width="8" height="2"/>
            </svg>
          </button>
          <span class="time-scale-value">${timeScale}</span>
          <button class="timescale_increase unselectable" aria-label="Increase time scale">
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="7" width="8" height="2"/>
              <rect x="7" y="4" width="2" height="8"/>
            </svg>
          </button>
        </div>
        <button class="startstop unselectable">${isPaused ? "Start" : "Stop"}</button>
      </div>
    `;

    // Re-cache elements after innerHTML update
    this.cacheElements();

    // Set HTML content for description to preserve formatting
    const descElem = this.shadowRoot?.querySelector("#description");
    if (descElem) {
      descElem.innerHTML = description;
    }
  }
}

customElements.define("challenge-control", ChallengeControl);
