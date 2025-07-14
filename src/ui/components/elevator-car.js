export class ElevatorCar extends HTMLElement {
  static get observedAttributes() {
    return ["width", "x-position", "y-position", "current-floor"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._elevator = null;
    this._floorButtons = [];
    this._abortController = null;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this._abortController?.abort();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.updateDisplay(name, newValue);
    }
  }

  set elevator(elevator) {
    // Clean up previous listeners
    this._abortController?.abort();

    this._elevator = elevator;

    if (elevator) {
      // Create new abort controller for this elevator
      this._abortController = new AbortController();
      const { signal } = this._abortController;
      // Set initial attributes
      this.setAttribute("width", elevator.width);
      this._floorButtons = structuredClone(elevator.buttons);

      // Display state handler
      this._displayStateHandler = () => {
        this.setAttribute("x-position", elevator.worldX);
        this.setAttribute("y-position", elevator.worldY);
      };

      // Current floor handler
      this._currentFloorHandler = (event) => {
        const floor = event.detail ?? event;
        this.setAttribute("current-floor", floor);
      };

      // Floor buttons handler
      this._floorButtonsHandler = (event) => {
        const buttons = event.detail;
        buttons.forEach((button, i) => {
          this.updateFloorButton(i, button);
        });
      };

      // Attach listeners with abort signal
      elevator.addEventListener(
        "new_display_state",
        this._displayStateHandler,
        { signal },
      );
      elevator.addEventListener(
        "new_current_floor",
        this._currentFloorHandler,
        { signal },
      );
      elevator.addEventListener(
        "floor_buttons_changed",
        this._floorButtonsHandler,
        { signal },
      );

      // Trigger initial updates
      elevator.dispatchEvent(
        new CustomEvent("new_display_state", { detail: elevator }),
      );
      elevator.dispatchEvent(
        new CustomEvent("new_current_floor", { detail: elevator.currentFloor }),
      );
    }
  }

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

  updatePosition() {
    const x = this.getAttribute("x-position") ?? "0";
    const y = this.getAttribute("y-position") ?? "0";
    
    // Use CSS Custom Properties for better performance and cleaner code
    this.style.setProperty('--translate-x', `${x}px`);
    this.style.setProperty('--translate-y', `${y}px`);
  }

  updateFloorButton(index, isActive) {
    const buttons = this.shadowRoot?.querySelectorAll(".buttonpress");
    buttons?.[index]?.classList.toggle("activated", isActive);
  }

  renderFloorButtons() {
    return this._floorButtons
      .map(
        (isActive, i) =>
          `<span class="buttonpress ${isActive ? "activated" : ""}">${i}</span>`,
      )
      .join("");
  }

  render() {
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
