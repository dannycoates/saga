/**
 * @typedef {import('../viewmodels/PassengerViewModel.js').PassengerViewModel} PassengerViewModel
 */

/**
 * Custom element for displaying a passenger.
 * Shows passenger icon and handles position/state updates.
 * Uses IntersectionObserver for performance optimization.
 * @extends HTMLElement
 */
export class ElevatorPassenger extends HTMLElement {
  /** @type {PassengerViewModel | null} */
  #model = null;
  /** @type {boolean} Whether the element is visible in viewport */
  #isVisible = true;
  /** @type {IntersectionObserver | null} */
  #intersectionObserver = null;
  /** @type {AbortController | null} */
  #abortController = null;

  /**
   * Observed attributes for attribute change callbacks.
   * @returns {string[]} List of observed attribute names
   */
  static get observedAttributes() {
    return ["passenger-type", "x-position", "y-position", "state"];
  }

  /**
   * Creates an elevator passenger element.
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
    this.setupIntersectionObserver();
  }

  /**
   * Called when element is removed from the DOM.
   * Cleans up event listeners and observers.
   * @returns {void}
   */
  disconnectedCallback() {
    this.#abortController?.abort();
    this.#intersectionObserver?.disconnect();
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
   * Sets the passenger view model and subscribes to its events.
   * @param {PassengerViewModel} model - Passenger view model
   */
  set model(model) {
    // Abort previous listeners
    this.#abortController?.abort();

    this.#model = model;

    if (model) {
      // Create new abort controller for this passenger's listeners
      this.#abortController = new AbortController();
      const { signal } = this.#abortController;

      // Set initial attributes
      this.setAttribute("passenger-type", model.displayType);
      this.setAttribute("state", model.done ? "leaving" : "");

      // Display state handler
      const displayStateHandler = () => {
        this.setAttribute("x-position", String(model.worldX));
        this.setAttribute("y-position", String(model.worldY));
        if (model.done) {
          this.setAttribute("state", "leaving");
        }
      };

      // Removed handler
      const removedHandler = () => {
        this.remove();
      };

      // Attach listeners with abort signal
      model.addEventListener("new_display_state", displayStateHandler, {
        signal,
      });
      model.addEventListener("removed", removedHandler, { signal });

      // Update initial position
      displayStateHandler();
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
      case "state":
        const icon = this.shadowRoot?.querySelector(".passenger-icon");
        if (icon) {
          icon.classList.toggle("leaving", value === "leaving");
        }
        break;
      case "passenger-type":
        const passengerIcon = this.shadowRoot?.querySelector(".passenger-icon");
        if (passengerIcon) {
          passengerIcon.className = `passenger-icon ${this.getAttribute("state") || ""}`;
        }
        break;
    }
  }

  /**
   * Sets up IntersectionObserver for viewport visibility tracking.
   * Only updates transforms when element is visible for performance.
   * @private
   * @returns {void}
   */
  setupIntersectionObserver() {
    // Use Intersection Observer for performance optimization
    this.#intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.#isVisible = entry.isIntersecting;
          // Only update transforms when visible for better performance
          if (this.#isVisible) {
            this.updatePosition();
          }
        });
      },
      {
        rootMargin: "50px", // Start rendering slightly before coming into view
        threshold: 0,
      },
    );
    this.#intersectionObserver.observe(this);
  }

  /**
   * Updates the passenger's CSS transform position.
   * Only updates when element is visible for performance.
   * @private
   * @returns {void}
   */
  updatePosition() {
    // Only update position if visible to improve performance
    if (!this.#isVisible) return;

    const x = +(this.getAttribute("x-position") || "0") - 4;
    const y = +(this.getAttribute("y-position") || "0") - 4;

    // Use CSS Custom Properties for better performance and cleaner code
    this.style.setProperty("--translate-x", `${x}px`);
    this.style.setProperty("--translate-y", `${y}px`);
  }

  /**
   * Gets the SVG markup for a passenger type.
   * @private
   * @param {string} passengerType - Type of passenger ('male', 'female', or 'child')
   * @returns {string} SVG markup string
   */
  getPassengerSvg(passengerType) {
    /** @type {Record<string, string>} */
    const svgMap = {
      male: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M112 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm40 304l0 128c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-223.1L59.4 304.5c-9.1 15.1-28.8 20-43.9 10.9s-20-28.8-10.9-43.9l58.3-97c17.4-28.9 48.6-46.6 82.3-46.6l29.7 0c33.7 0 64.9 17.7 82.3 46.6l58.3 97c9.1 15.1 4.2 34.8-10.9 43.9s-34.8 4.2-43.9-10.9L232 256.9 232 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-128-16 0z"/></svg>`,
      female: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M160 0a48 48 0 1 1 0 96 48 48 0 1 1 0-96zM88 384l-17.8 0c-10.9 0-18.6-10.7-15.2-21.1L93.3 248.1 59.4 304.5c-9.1 15.1-28.8 20-43.9 10.9s-20-28.8-10.9-43.9l53.6-89.2c20.3-33.7 56.7-54.3 96-54.3l11.6 0c39.3 0 75.7 20.6 96 54.3l53.6 89.2c9.1 15.1 4.2 34.8-10.9 43.9s-34.8 4.2-43.9-10.9l-33.9-56.3L265 362.9c3.5 10.4-4.3 21.1-15.2 21.1L232 384l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96-16 0 0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96z"/></svg>`,
      child: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M160 0a48 48 0 1 1 0 96 48 48 0 1 1 0-96zM88 384l-17.8 0c-10.9 0-18.6-10.7-15.2-21.1L93.3 248.1 59.4 304.5c-9.1 15.1-28.8 20-43.9 10.9s-20-28.8-10.9-43.9l53.6-89.2c20.3-33.7 56.7-54.3 96-54.3l11.6 0c39.3 0 75.7 20.6 96 54.3l53.6 89.2c9.1 15.1 4.2 34.8-10.9 43.9s-34.8 4.2-43.9-10.9l-33.9-56.3L265 362.9c3.5 10.4-4.3 21.1-15.2 21.1L232 384l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96-16 0 0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96z"/></svg>`,
    };
    return svgMap[passengerType] || svgMap.male;
  }

  /**
   * Initializes the component's shadow DOM content.
   * @private
   * @returns {void}
   */
  initializeDOM() {
    const passengerType = this.getAttribute("passenger-type") || "male";
    const state = this.getAttribute("state") || "";

    /** @type {ShadowRoot} */ (this.shadowRoot).innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 0;
          left: 0;
          display: block;
          z-index: 2;
          /* Use CSS Custom Properties for transforms - hardware accelerated */
          transform: translate3d(var(--translate-x, 0px), var(--translate-y, 0px), 0);
          contain: layout style paint;
        }

        .passenger-icon {
          display: block;
          width: 18px;
          height: 18px;
        }

        .passenger-icon svg {
          width: 100%;
          height: 100%;
          fill: white;
          filter: drop-shadow(0 1px 3px black);
        }

        .passenger-icon.happy svg {
          /* Future state */
        }

        .passenger-icon.frustrated svg {
          fill: yellow;
        }

        .passenger-icon.disappointed svg {
          fill: red;
        }

        .passenger-icon.leaving svg {
          fill: #eee;
        }
      </style>
      <span class="passenger-icon ${state}">
        ${this.getPassengerSvg(passengerType)}
      </span>
    `;

    this.updatePosition();
  }
}

customElements.define("elevator-passenger", ElevatorPassenger);
