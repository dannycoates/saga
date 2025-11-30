/**
 * @typedef {import('../viewmodels/ElevatorViewModel.js').ElevatorViewModel} ElevatorViewModel
 */

/**
 * Custom element for displaying an elevator car.
 * Shows floor indicator, floor buttons, and handles position updates.
 * @extends HTMLElement
 */
export class ElevatorCar extends HTMLElement {
  /** @type {ElevatorViewModel | null} */
  #model = null;
  /** @type {boolean[]} Floor button states */
  #floorButtons = [];
  /** @type {AbortController | null} */
  #abortController = null;
  /** @type {(() => void) | null} */
  #displayStateHandler = null;
  /** @type {((event: Event) => void) | null} */
  #currentFloorHandler = null;
  /** @type {((event: Event) => void) | null} */
  #floorButtonsHandler = null;

  /**
   * Observed attributes for attribute change callbacks.
   * @returns {string[]} List of observed attribute names
   */
  static get observedAttributes() {
    return ["width", "x-position", "y-position", "current-floor"];
  }

  /**
   * Creates an elevator car element.
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
   * Cleans up event listeners via abort controller.
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
      this.updateDisplay(name, newValue);
    }
  }

  /**
   * Sets the elevator view model and subscribes to its events.
   * @param {ElevatorViewModel} model - Elevator view model
   */
  set model(model) {
    // Clean up previous listeners
    this.#abortController?.abort();

    this.#model = model;

    if (model) {
      // Create new abort controller for this elevator
      this.#abortController = new AbortController();
      const { signal } = this.#abortController;
      // Set initial attributes
      this.setAttribute("width", String(model.width));
      this.#floorButtons = structuredClone(model.buttons);

      // Display state handler
      this.#displayStateHandler = () => {
        this.setAttribute("x-position", String(model.worldX));
        this.setAttribute("y-position", String(model.worldY));
      };

      // Current floor handler
      this.#currentFloorHandler = (event) => {
        const floor = /** @type {CustomEvent} */ (event).detail ?? event;
        this.setAttribute("current-floor", String(floor));
      };

      // Floor buttons handler
      this.#floorButtonsHandler = (event) => {
        const buttons = /** @type {CustomEvent} */ (event).detail;
        buttons.forEach((button, i) => {
          this.updateFloorButton(i, button);
        });
      };

      // Attach listeners with abort signal
      model.addEventListener("new_display_state", this.#displayStateHandler, {
        signal,
      });
      model.addEventListener("new_current_floor", this.#currentFloorHandler, {
        signal,
      });
      model.addEventListener(
        "floor_buttons_changed",
        this.#floorButtonsHandler,
        { signal },
      );

      // Trigger initial updates
      model.dispatchEvent(
        new CustomEvent("new_display_state", { detail: model }),
      );
      model.dispatchEvent(
        new CustomEvent("new_current_floor", { detail: model.currentFloor }),
      );
    }
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
      case "x-position":
      case "y-position":
        this.updatePosition();
        break;
      case "current-floor":
        const floorIndicator = this.shadowRoot?.querySelector(".floor-number");
        if (floorIndicator) {
          floorIndicator.textContent = value;
        }
        break;
    }
  }

  /**
   * Updates the elevator's CSS transform position.
   * Uses CSS custom properties for hardware-accelerated transforms.
   * @private
   * @returns {void}
   */
  updatePosition() {
    const x = this.getAttribute("x-position") ?? "0";
    const y = this.getAttribute("y-position") ?? "0";

    // Use CSS Custom Properties for better performance and cleaner code
    this.style.setProperty("--translate-x", `${x}px`);
    this.style.setProperty("--translate-y", `${y}px`);
  }

  /**
   * Updates a floor button's active state.
   * @private
   * @param {number} index - Floor button index
   * @param {boolean} isActive - Whether the button is active
   * @returns {void}
   */
  updateFloorButton(index, isActive) {
    const buttons = this.shadowRoot?.querySelectorAll(".buttonpress");
    buttons?.[index]?.classList.toggle("activated", isActive);
  }

  /**
   * Renders floor button indicators as HTML.
   * @private
   * @returns {string} HTML string for floor buttons
   */
  renderFloorButtons() {
    return this.#floorButtons
      .map(
        (isActive, i) =>
          `<span class="buttonpress ${isActive ? "activated" : ""}">${i}</span>`,
      )
      .join("");
  }

  /**
   * Initializes the component's shadow DOM content.
   * @private
   * @returns {void}
   */
  initializeDOM() {
    const width = this.getAttribute("width") ?? "60";
    const currentFloor = this.getAttribute("current-floor") ?? "0";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --elevator-width: ${width}px;
          --elevator-bg-color: #4f8686;
          --elevator-border-color: white;
          --elevator-height: 48px;
          --floor-text-color: rgba(255, 255, 255, 0.3);
          --button-active-color: #33ff44;

          position: absolute;
          top: 0;
          left: 0;
          display: block;
          background-color: var(--elevator-bg-color);
          border: 2px solid var(--elevator-border-color);
          height: var(--elevator-height);
          z-index: 1;
          width: var(--elevator-width);
          /* Use CSS Custom Properties for transforms - hardware accelerated */
          transform: translate3d(var(--translate-x, 0px), var(--translate-y, 0px), 0);
          contain: layout style paint;
        }

        .floorindicator {
          display: inline-block;
          position: absolute;
          width: 100%;
          font-size: 15px;
          text-align: center;
          color: var(--floor-text-color);
        }

        .buttonindicator {
          display: inline-block;
          position: absolute;
          top: 15px;
          width: 95%;
          text-align: center;
          font-size: 8px;
          line-height: 8px;
          color: var(--floor-text-color);
        }

        .buttonpress {
          cursor: pointer;
          margin: 0;
          display: inline-block;
        }

        .buttonpress.activated {
          color: var(--button-active-color);
        }
      </style>

      <span class="floorindicator">
        <span class="floor-number">${currentFloor}</span>
      </span>

      <span class="buttonindicator">
        ${this.renderFloorButtons()}
      </span>
    `;

    this.updatePosition();
  }
}

customElements.define("elevator-car", ElevatorCar);
