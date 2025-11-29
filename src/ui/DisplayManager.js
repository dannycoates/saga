import { FloorDisplay } from "./display/FloorDisplay.js";
import { ElevatorDisplay } from "./display/ElevatorDisplay.js";
import { PassengerDisplay } from "./display/PassengerDisplay.js";

/**
 * @typedef {import('../core/SimulationBackend.js').SimulationState} SimulationState
 * @typedef {import('../core/Passenger.js').PassengerStateData} PassengerStateData
 */

/**
 * @typedef {Object} DisplayManagerOptions
 * @property {boolean} [isRenderingEnabled=true] - Whether to create and update displays
 * @property {number} [floorHeight=50] - Height of each floor in pixels
 */

/**
 * Manages all display objects and updates them based on simulation state.
 * Subscribes to backend events and maintains display object lifecycle.
 * Can be disabled for headless operation.
 */
export class DisplayManager {
  /**
   * Factory method for creating DisplayManager instances.
   * @param {DisplayManagerOptions} [options={}] - Configuration options
   * @returns {DisplayManager} A new DisplayManager instance
   */
  static create(options = {}) {
    return new DisplayManager(options);
  }

  /**
   * Creates a display manager.
   * @param {DisplayManagerOptions} [options={}] - Configuration options
   */
  constructor(options = {}) {
    /** @type {boolean} Whether rendering is enabled */
    this.isRenderingEnabled = options.isRenderingEnabled !== false;
    /** @type {number} Height of each floor in pixels */
    this.floorHeight = options.floorHeight || 50;

    /** @type {Map<number, FloorDisplay>} Floor displays keyed by level */
    this.floorDisplays = new Map();
    /** @type {Map<number, ElevatorDisplay>} Elevator displays keyed by index */
    this.elevatorDisplays = new Map();
    /** @type {Map<string, PassengerDisplay>} Passenger displays keyed by ID */
    this.passengerDisplays = new Map();

    /** @type {AbortController} Controller for event listener cleanup */
    this.abortController = new AbortController();
  }

  /**
   * Floor displays map (alias for floorDisplays).
   * @type {Map<number, FloorDisplay>}
   * @readonly
   */
  get floors() {
    return this.floorDisplays;
  }

  /**
   * Elevator displays map (alias for elevatorDisplays).
   * @type {Map<number, ElevatorDisplay>}
   * @readonly
   */
  get elevators() {
    return this.elevatorDisplays;
  }

  /**
   * Passenger displays map (alias for passengerDisplays).
   * @type {Map<string, PassengerDisplay>}
   * @readonly
   */
  get passengers() {
    return this.passengerDisplays;
  }

  /**
   * Initializes displays based on initial simulation state.
   * Creates floor and elevator displays positioned for the world.
   * @param {SimulationState} initialState - Initial simulation state
   * @returns {void}
   */
  initialize(initialState) {
    if (!this.isRenderingEnabled) return;

    // Clear existing displays
    this.cleanup();

    // Create floor displays
    initialState.floors.forEach((floor, index) => {
      const yPos = (initialState.floors.length - 1 - index) * this.floorHeight;
      const display = new FloorDisplay(floor, yPos);
      this.floorDisplays.set(floor.level, display);
    });

    // Create elevator displays
    const elevatorGutter = 20;
    const initialXOffset = 200; // For floor display
    const elevatorDisplays = initialState.elevators.map((elevator) => {
      return new ElevatorDisplay(elevator, 0, elevator.capacity);
    });

    const totalElevatorWidth = elevatorDisplays.reduce((sum, display) => {
      return sum + display.width + elevatorGutter;
    }, 0);

    const innerWorld = /** @type {HTMLElement | null} */ (document.querySelector(".innerworld"));
    if (innerWorld) {
      innerWorld.style.minWidth = `${totalElevatorWidth + initialXOffset}px`;
    }

    let currentX = initialXOffset;
    elevatorDisplays.forEach((display, i) => {
      display.moveTo(currentX, display.getDisplayYPos(initialState.elevators[i].position));
      this.elevatorDisplays.set(initialState.elevators[i].index, display);
      currentX += display.width + elevatorGutter;
    });

    // Initial render with tick to set up positions
    this.updateDisplays(initialState, 0);
  }

  /**
   * Subscribes to simulation backend events for state updates.
   * Uses AbortController for proper cleanup on dispose.
   * @param {import('../core/SimulationBackend.js').SimulationBackend} backend - Backend to subscribe to
   * @returns {void}
   */
  subscribeToBackend(backend) {
    const { signal } = this.abortController;

    backend.addEventListener(
      "state_changed",
      (e) => {
        const detail = /** @type {CustomEvent<SimulationState & {dt?: number}>} */ (e).detail;
        const dt = detail.dt ?? 0;
        this.updateDisplays(detail, dt);
      },
      { signal },
    );

    backend.addEventListener(
      "passenger_spawned",
      (e) => {
        const detail = /** @type {CustomEvent<{passenger: PassengerStateData}>} */ (e).detail;
        this.handlePassengerSpawned(detail.passenger);
      },
      { signal },
    );

    backend.addEventListener(
      "passengers_exited",
      (e) => {
        const detail = /** @type {CustomEvent<{passengers: PassengerStateData[]}>} */ (e).detail;
        this.handlePassengersExited(detail.passengers);
      },
      { signal },
    );
  }

  /**
   * Updates all displays based on current simulation state.
   * Called on each state change event from the backend.
   * @param {SimulationState} state - Current simulation state
   * @param {number} [dt=0] - Time delta in seconds
   * @returns {void}
   */
  updateDisplays(state, dt = 0) {
    if (!this.isRenderingEnabled) return;

    // Update floor displays
    state.floors.forEach((floor) => {
      const display = this.floorDisplays.get(floor.level);
      if (display) {
        display.updateFromState(floor);
        display.tick(dt);
      }
    });

    // Update elevator displays
    state.elevators.forEach((elevator) => {
      const display = this.elevatorDisplays.get(elevator.index);
      if (display) {
        display.updateFromState(elevator);
        display.tick(dt);
      }
    });

    // Update passenger displays
    state.passengers.forEach((passenger) => {
      let display = this.passengerDisplays.get(passenger.id);
      if (display) {
        display.updateFromState(passenger);
      }
    });

    // Tick all passenger displays, including those not in simulation anymore
    // This allows exit animations to continue running
    for (const [id, display] of this.passengerDisplays) {
      if (display.isActive) {
        display.tick(dt);
      }
    }

    // Clean up exited passengers
    this.cleanupExitedPassengers();
  }

  /**
   * Handles new passenger spawn event.
   * Creates a new passenger display at the appropriate floor position.
   * @param {PassengerStateData} passengerState - Spawned passenger state
   * @returns {void}
   */
  handlePassengerSpawned(passengerState) {
    if (!this.isRenderingEnabled) return;

    const startingY =
      (this.floorDisplays.size - 1 - passengerState.currentFloor) *
        this.floorHeight +
      30;
    const display = new PassengerDisplay(
      passengerState,
      startingY,
      this.elevatorDisplays,
    );

    this.passengerDisplays.set(passengerState.id, display);
  }

  /**
   * Handles passengers exiting elevators.
   * Updates passenger displays to trigger exit animations.
   * @param {PassengerStateData[]} passengers - Array of exited passenger states
   * @returns {void}
   */
  handlePassengersExited(passengers) {
    if (!this.isRenderingEnabled) return;

    passengers.forEach((passenger) => {
      const display = this.passengerDisplays.get(passenger.id);
      if (display) {
        display.updateFromState(passenger);
      }
    });
  }

  /**
   * Cleans up displays for passengers that have completed exit animations.
   * Removes inactive passenger displays from the map.
   * @private
   * @returns {void}
   */
  cleanupExitedPassengers() {
    for (const [id, display] of this.passengerDisplays) {
      if (!display.isActive) {
        // Force DOM cleanup for inactive displays
        display.dispatchEvent(new CustomEvent("removed"));
        this.passengerDisplays.delete(id);
      }
    }
  }

  /**
   * Cleans up all displays and event subscriptions.
   * Cancels all animations, aborts event listeners, and clears display maps.
   * @returns {void}
   */
  cleanup() {
    this.abortController.abort();

    // Cancel animations on all displays to release closures
    for (const display of this.elevatorDisplays.values()) {
      display.cancelAnimation();
    }
    for (const display of this.passengerDisplays.values()) {
      display.cancelAnimation();
    }

    this.floorDisplays.clear();
    this.elevatorDisplays.clear();
    this.passengerDisplays.clear();
    this.abortController = new AbortController();
  }
}
