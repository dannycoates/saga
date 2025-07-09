class ChallengeControl extends HTMLElement {
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
    this._worldController = null;
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  disconnectedCallback() {
    if (this._worldController) {
      this._worldController.removeEventListener(
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

  set worldController(controller) {
    if (this._worldController) {
      this._worldController.removeEventListener(
        "timescale_changed",
        this._timescaleHandler,
      );
    }

    this._worldController = controller;

    if (controller) {
      this._timescaleHandler = () => {
        this.setAttribute("time-scale", controller.timeScale.toFixed(0) + "x");
        this.setAttribute("is-paused", controller.isPaused);
      };
      controller.addEventListener("timescale_changed", this._timescaleHandler);
      // Set initial values
      this.setAttribute("time-scale", controller.timeScale.toFixed(0) + "x");
      this.setAttribute("is-paused", controller.isPaused);
    }
  }

  attachEventListeners() {
    const startStopBtn = this.shadowRoot.querySelector(".startstop");
    const increaseBtn = this.shadowRoot.querySelector(".timescale_increase");
    const decreaseBtn = this.shadowRoot.querySelector(".timescale_decrease");

    startStopBtn?.addEventListener("click", () => {
      if (this._app) {
        this._app.startStopOrRestart();
      }
    });

    increaseBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      if (this._worldController && this._worldController.timeScale < 40) {
        const timeScale = Math.round(this._worldController.timeScale * 1.618);
        this._worldController.setTimeScale(timeScale);
      }
    });

    decreaseBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      if (this._worldController) {
        const timeScale = Math.round(this._worldController.timeScale / 1.618);
        this._worldController.setTimeScale(timeScale);
      }
    });
  }

  updateDisplay() {
    const button = this.shadowRoot.querySelector(".startstop");
    const timeDisplay = this.shadowRoot.querySelector(".time-scale-value");

    if (button) {
      const isPaused = this.getAttribute("is-paused") === "true";
      button.textContent = isPaused ? "Start" : "Stop";
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
          color: #3c3836; /* Gruvbox dark fg */
          font-weight: normal;
        }

        button {
          height: 32px;
          line-height: 18px;
          font-size: 17px;
          font-weight: bold;
          padding-left: 12px;
          padding-right: 12px;
          color: #fbf1c7; /* Gruvbox light0 */
          background-color: #458588; /* Gruvbox blue */
          text-shadow: none;
          border: 1px solid #076678; /* Gruvbox dark blue */
          border-radius: 5px;
          cursor: pointer;
          width: 110px;
          transition: background-color 0.2s ease;
        }

        button:hover:not(:disabled) {
          background-color: #076678; /* Gruvbox dark blue */
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
          padding: 4px 8px;
          line-height: 20px;
          cursor: pointer;
          color: #3c3836; /* Gruvbox dark fg */
          display: inline-flex;
          align-items: center;
          border-radius: 3px;
          transition: background-color 0.2s ease;
        }

        .timescale_decrease:hover,
        .timescale_increase:hover {
          background-color: #bdae93; /* Gruvbox light3 */
        }

        .timescale_decrease svg,
        .timescale_increase svg {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }

        .time-scale-value {
          color: #3c3836; /* Gruvbox dark fg */
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
        <h3 class="timescale-controls">
          <span class="timescale_decrease unselectable">
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="14" height="14" rx="2" fill="currentColor"/>
              <rect x="4" y="7" width="8" height="2" fill="#fbf1c7"/>
            </svg>
          </span>
          <span class="time-scale-value">${timeScale}</span>
          <span class="timescale_increase unselectable">
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="14" height="14" rx="2" fill="currentColor"/>
              <rect x="4" y="7" width="8" height="2" fill="#fbf1c7"/>
              <rect x="7" y="4" width="2" height="8" fill="#fbf1c7"/>
            </svg>
          </span>
        </h3>
        <button class="startstop unselectable">${isPaused ? "Start" : "Stop"}</button>
      </div>
    `;

    // Set HTML content for description to preserve formatting
    const descElem = this.shadowRoot.querySelector("#description");
    if (descElem) {
      descElem.innerHTML = description;
    }
  }
}

customElements.define("challenge-control", ChallengeControl);