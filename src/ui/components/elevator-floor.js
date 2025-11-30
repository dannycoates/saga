/**
 * @typedef {import('../viewmodels/FloorViewModel.js').FloorViewModel} FloorViewModel
 */

/**
 * Custom element for displaying a floor with up/down call buttons.
 * Shows floor number and button indicators.
 * @extends HTMLElement
 */
export class ElevatorFloor extends HTMLElement {
  /**
   * Observed attributes for attribute change callbacks.
   * @returns {string[]} List of observed attribute names
   */
  static get observedAttributes() {
    return [
      "floor-number",
      "y-position",
      "up-active",
      "down-active",
      "hide-up",
      "hide-down",
    ];
  }

  /**
   * Creates an elevator floor element.
   */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    /** @type {FloorViewModel | null} */
    this._floor = null;
    /** @type {AbortController | null} */
    this._abortController = null;
  }

  /**
   * Called when element is added to the DOM.
   * @returns {void}
   */
  connectedCallback() {
    this.initializeDOM();
    this.attachEventListeners();
  }

  /**
   * Called when element is removed from the DOM.
   * Cleans up event listeners.
   * @returns {void}
   */
  disconnectedCallback() {
    this._abortController?.abort();
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
      this.updateDisplay(name, newValue);
    }
  }

  /**
   * Sets the floor view model and subscribes to button state changes.
   * @param {FloorViewModel} floor - Floor view model
   */
  set floor(floor) {
    // Abort previous listeners
    this._abortController?.abort();

    this._floor = floor;

    if (floor) {
      // Create new abort controller for this floor's listeners
      this._abortController = new AbortController();
      const { signal } = this._abortController;

      // Set initial attributes
      this.setAttribute("floor-number", String(floor.level));
      this.setAttribute("y-position", String(floor.yPosition));

      // Listen for button state changes
      const buttonStateHandler = (event) => {
        const buttons = event.detail || event;
        this.setAttribute("up-active", String(buttons.up));
        this.setAttribute("down-active", String(buttons.down));
      };
      floor.addEventListener("button_state_change", buttonStateHandler, {
        signal,
      });
    }
  }

  /**
   * Attaches click event listeners to up/down buttons.
   * @private
   * @returns {void}
   */
  attachEventListeners() {
    const upButton = this.shadowRoot.querySelector(".up");
    const downButton = this.shadowRoot.querySelector(".down");

    upButton?.addEventListener("click", () => {
      if (this._floor) {
        this._floor.pressUpButton();
      }
    });

    downButton?.addEventListener("click", () => {
      if (this._floor) {
        this._floor.pressDownButton();
      }
    });
  }

  /**
   * Updates the display based on attribute changes.
   * @private
   * @param {string} name - Attribute name that changed
   * @param {string | null} value - New attribute value
   * @returns {void}
   */
  updateDisplay(name, value) {
    switch (name) {
      case "y-position":
        this.style.top = value + "px";
        break;
      case "up-active":
        const upBtn = this.shadowRoot.querySelector(".up");
        if (upBtn) {
          upBtn.classList.toggle("activated", value === "true");
        }
        break;
      case "down-active":
        const downBtn = this.shadowRoot.querySelector(".down");
        if (downBtn) {
          downBtn.classList.toggle("activated", value === "true");
        }
        break;
      case "hide-up":
        const upBtnHide = this.shadowRoot.querySelector(".up");
        if (upBtnHide) {
          upBtnHide.classList.toggle("invisible", value === "true");
        }
        break;
      case "hide-down":
        const downBtnHide = this.shadowRoot.querySelector(".down");
        if (downBtnHide) {
          downBtnHide.classList.toggle("invisible", value === "true");
        }
        break;
    }
  }

  /**
   * Initializes the component's shadow DOM content.
   * @private
   * @returns {void}
   */
  initializeDOM() {
    const floorNumber = this.getAttribute("floor-number") || "0";
    const yPosition = this.getAttribute("y-position") || "0";
    const upActive = this.getAttribute("up-active") === "true";
    const downActive = this.getAttribute("down-active") === "true";
    const hideUp = this.getAttribute("hide-up") === "true";
    const hideDown = this.getAttribute("hide-down") === "true";

    // Set position on host element
    this.style.top = yPosition + "px";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: absolute;
          width: 100%;
          height: 49px;
          background-color: rgba(255, 255, 255, 0.1);
          background: linear-gradient(
            rgba(255, 255, 255, 0.1),
            rgba(255, 255, 255, 0.2),
            rgba(255, 255, 255, 0.24),
            rgba(255, 255, 255, 0.1)
          );
          border-bottom: 1px solid #333;
          display: block;
        }

        .floornumber {
          position: absolute;
          color: rgba(255, 255, 255, 0.15);
          font-size: 32px;
          line-height: 50px;
          padding-left: 10px;
        }

        .buttonindicator {
          cursor: pointer;
          line-height: 50px;
          padding-left: 50px;
          color: rgba(255, 255, 255, 0.2);
        }

        .buttonindicator svg {
          width: 22px;
          height: 22px;
          vertical-align: middle;
          margin: 0 2px;
          fill: currentColor;
        }

        .buttonindicator .activated {
          color: rgba(55, 255, 55, 1);
        }

        .invisible {
          visibility: hidden;
        }
      </style>

      <span class="floornumber">${floorNumber}</span>
      <span class="buttonindicator">
        <svg class="up ${upActive ? "activated" : ""} ${hideUp ? "invisible" : ""}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="7" fill="currentColor"/>
          <path d="M8 11 L8 5 M5 8 L8 5 L11 8" fill="none" stroke="#4e585f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg class="down ${downActive ? "activated" : ""} ${hideDown ? "invisible" : ""}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="7" fill="currentColor"/>
          <path d="M8 5 L8 11 M5 8 L8 11 L11 8" fill="none" stroke="#4e585f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    `;
  }
}

customElements.define("elevator-floor", ElevatorFloor);
