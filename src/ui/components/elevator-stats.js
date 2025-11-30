import { EventBus } from "../../utils/EventBus.js";

/**
 * @typedef {import('../../game/GameController.js').GameController} GameController
 */

/**
 * @typedef {Object} GameStats
 * @property {number} transportedCount - Number of passengers transported
 * @property {number} elapsedTime - Elapsed time in seconds
 * @property {number} transportedPerSec - Passengers transported per second
 * @property {number} avgWaitTime - Average wait time in seconds
 * @property {number} maxWaitTime - Maximum wait time in seconds
 * @property {number} moveCount - Number of floor moves
 */

/**
 * Custom element for displaying game statistics.
 * Shows transported count, elapsed time, efficiency metrics, and move count.
 * @extends HTMLElement
 */
export class ElevatorStats extends HTMLElement {
  /** @type {GameController | null} */
  #world = null;
  /** @type {EventBus | null} */
  #eventBus = null;
  /** @type {AbortController | null} */
  #abortController = null;

  /**
   * Observed attributes for attribute change callbacks.
   * @returns {string[]} List of observed attribute names
   */
  static get observedAttributes() {
    return [
      "transported",
      "elapsed-time",
      "transported-per-sec",
      "avg-wait-time",
      "max-wait-time",
      "move-count",
    ];
  }

  /**
   * Creates an elevator stats element.
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
    this.updateStat(name, newValue);
  }

  /**
   * Sets the event bus and subscribes to stats changes.
   * @param {EventBus} eventBus - Event bus instance
   */
  set eventBus(eventBus) {
    // Clean up previous subscription
    this.#abortController?.abort();

    this.#eventBus = eventBus;

    if (eventBus) {
      this.#abortController = new AbortController();
      eventBus.on(
        "simulation:stats_changed",
        (e) => this.updateFromStats(/** @type {CustomEvent} */ (e).detail),
        { signal: this.#abortController.signal },
      );
    }
  }

  /**
   * Sets the game controller for initial stats.
   * @param {GameController} world - Game controller instance
   */
  set world(world) {
    this.#world = world;
    if (world) {
      this.updateFromStats(world.stats);
    }
  }

  /**
   * Updates attributes from game stats object.
   * @private
   * @param {GameStats} stats - Current game statistics
   * @returns {void}
   */
  updateFromStats(stats) {
    this.setAttribute("transported", String(stats.transportedCount));
    this.setAttribute("elapsed-time", stats.elapsedTime.toFixed(0) + "s");
    this.setAttribute(
      "transported-per-sec",
      stats.transportedPerSec.toFixed(3),
    );
    this.setAttribute("avg-wait-time", stats.avgWaitTime.toFixed(1) + "s");
    this.setAttribute("max-wait-time", stats.maxWaitTime.toFixed(1) + "s");
    this.setAttribute("move-count", String(stats.moveCount));
  }

  /**
   * Updates a single stat display element.
   * @private
   * @param {string} name - Stat attribute name
   * @param {string | null} value - New stat value
   * @returns {void}
   */
  updateStat(name, value) {
    const elem = this.shadowRoot.querySelector(`[data-stat="${name}"]`);
    if (elem) {
      elem.textContent = value || "";
    }
  }

  /**
   * Initializes the component's shadow DOM content.
   * @private
   * @returns {void}
   */
  initializeDOM() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: row;
          justify-content: end;
          gap: 1rem;
          font: 12px Consolas, Monaco, monospace;
          color: #999;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          pointer-events: none;
        }

        .stat {
          border-bottom: 1px solid #504945; /* Gruvbox gray */
        }

        .key {
          color: #928374; /* Gruvbox gray */
        }

        .value {
          color: #ebdbb2; /* Gruvbox light1 */
        }
      </style>

      <div class="stat">
        <span class="key">Transported</span>
        <span class="value" data-stat="transported">${this.getAttribute("transported") || ""}</span>
      </div>
      <div class="stat">
        <span class="key">Elapsed time</span>
        <span class="value" data-stat="elapsed-time">${this.getAttribute("elapsed-time") || ""}</span>
      </div>
      <div class="stat">
        <span class="key">Transported/s</span>
        <span class="value" data-stat="transported-per-sec">${this.getAttribute("transported-per-sec") || ""}</span>
      </div>
      <div class="stat">
        <span class="key">Avg waiting time</span>
        <span class="value" data-stat="avg-wait-time">${this.getAttribute("avg-wait-time") || ""}</span>
      </div>
      <div class="stat">
        <span class="key">Max waiting time</span>
        <span class="value" data-stat="max-wait-time">${this.getAttribute("max-wait-time") || ""}</span>
      </div>
      <div class="stat">
        <span class="key" title="Number of floors that have been travelled by elevators">Moves</span>
        <span class="value" data-stat="move-count">${this.getAttribute("move-count") || ""}</span>
      </div>
    `;
  }
}

customElements.define("elevator-stats", ElevatorStats);
