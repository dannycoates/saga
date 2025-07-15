export class ChallengeControl extends HTMLElement {
  static get observedAttributes() {
    return [
      "challenge-num",
      "challenge-description",
      "time-scale",
      "is-paused",
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._app = null;
    this._worldManager = null;
  }

  connectedCallback() {
    this.render();
    this.cacheElements();
    this.attachEventListeners();
  }

  cacheElements() {
    // Cache frequently accessed elements for better performance
    this._cachedElements = {
      startStopButton: this.shadowRoot.querySelector(".startstop"),
      timeDisplay: this.shadowRoot.querySelector(".time-scale-value"),
    };
  }

  disconnectedCallback() {
    if (this._worldManager) {
      this._worldManager.removeEventListener(
        "timescale_changed",
        this._timescaleHandler,
      );
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.updateDisplay();
    }
  }

  set app(app) {
    this._app = app;
  }

  set worldManager(manager) {
    if (this._worldManager) {
      this._worldManager.removeEventListener(
        "timescale_changed",
        this._timescaleHandler,
      );
    }

    this._worldManager = manager;

    if (manager) {
      this._timescaleHandler = () => {
        this.setAttribute("time-scale", manager.timeScale.toFixed(0) + "x");
        this.setAttribute("is-paused", manager.isPaused);
      };
      manager.addEventListener("timescale_changed", this._timescaleHandler);
      // Set initial values
      this.setAttribute("time-scale", manager.timeScale.toFixed(0) + "x");
      this.setAttribute("is-paused", manager.isPaused);
    }
  }

  attachEventListeners() {
    // Use event delegation for better performance and cleaner code
    this.shadowRoot.addEventListener("click", (e) => {
      const button = e.target.closest("button");
      if (!button) return;

      // Use matches() for efficient button identification
      if (button.matches(".startstop")) {
        if (this._app) {
          this._app.startOrStop();
        }
      } else if (button.matches(".timescale_increase")) {
        e.preventDefault();
        if (this._worldManager && this._worldManager.timeScale < 40) {
          const timeScale = Math.round(this._worldManager.timeScale * 1.618);
          this._worldManager.setTimeScale(timeScale);
        }
      } else if (button.matches(".timescale_decrease")) {
        e.preventDefault();
        if (this._worldManager) {
          const timeScale = Math.round(this._worldManager.timeScale / 1.618);
          this._worldManager.setTimeScale(timeScale);
        }
      }
    });
  }

  updateDisplay() {
    // Use cached elements for better performance
    const { startStopButton, timeDisplay } = this._cachedElements || {};

    if (startStopButton) {
      const isPaused = this.getAttribute("is-paused") === "true";
      startStopButton.textContent = isPaused ? "Start" : "Stop";
    }

    if (timeDisplay) {
      timeDisplay.textContent = this.getAttribute("time-scale") || "1x";
    }
  }

  render() {
    const challengeNum = this.getAttribute("challenge-num") || "";
    const description = this.getAttribute("challenge-description") || "";
    const timeScale = this.getAttribute("time-scale") || "1x";
    const isPaused = this.getAttribute("is-paused") === "true";

    this.shadowRoot.innerHTML = `
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
    const descElem = this.shadowRoot.querySelector("#description");
    if (descElem) {
      descElem.innerHTML = description;
    }
  }
}

customElements.define("challenge-control", ChallengeControl);
