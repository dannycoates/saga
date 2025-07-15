import { FloorDisplay } from "./display/FloorDisplay.js";
import { ElevatorDisplay } from "./display/ElevatorDisplay.js";
import { PassengerDisplay } from "./display/PassengerDisplay.js";

/**
 * Manages all display objects and updates them based on simulation state
 */
export class DisplayManager {
  constructor(options = {}) {
    this.renderingEnabled = options.renderingEnabled !== false;
    this.floorHeight = options.floorHeight || 50;

    this.floorDisplays = new Map();
    this.elevatorDisplays = new Map();
    this.passengerDisplays = new Map();

    this.abortController = new AbortController();
  }

  get floors() {
    return this.floorDisplays;
  }

  get elevators() {
    return this.elevatorDisplays;
  }

  get passengers() {
    return this.passengerDisplays;
  }

  /**
   * Initialize displays based on initial simulation state
   */
  initialize(initialState) {
    if (!this.renderingEnabled) return;

    // Clear existing displays
    this.cleanup();

    // Create floor displays
    initialState.floors.forEach((floor, index) => {
      const yPos = (initialState.floors.length - 1 - index) * this.floorHeight;
      const display = new FloorDisplay(floor, yPos);
      this.floorDisplays.set(floor.level, display);
    });

    // Create elevator displays
    let currentX = 200.0;
    initialState.elevators.forEach((elevator) => {
      const display = new ElevatorDisplay(
        elevator,
        currentX,
        elevator.capacity,
      );
      currentX += 20 + display.width;
      this.elevatorDisplays.set(elevator.index, display);
    });

    // Initial render with tick to set up positions
    this.updateDisplays(initialState, 0);
  }

  /**
   * Subscribe to simulation backend events
   */
  subscribeToBackend(backend) {
    const { signal } = this.abortController;

    backend.addEventListener(
      "state_changed",
      (e) => {
        const dt = e.detail.dt ?? 0;
        this.updateDisplays(e.detail, dt);
      },
      { signal },
    );

    backend.addEventListener(
      "passenger_spawned",
      (e) => {
        this.handlePassengerSpawned(e.detail.passenger);
      },
      { signal },
    );

    backend.addEventListener(
      "passengers_exited",
      (e) => {
        this.handlePassengersExited(e.detail.passengers);
      },
      { signal },
    );
  }

  /**
   * Update all displays based on current state
   */
  updateDisplays(state, dt = 0) {
    if (!this.renderingEnabled) return;

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
      if (display.active) {
        display.tick(dt);
      }
    }

    // Clean up exited passengers
    this.cleanupExitedPassengers();
  }

  /**
   * Handle new passenger spawn
   */
  handlePassengerSpawned(passengerState) {
    if (!this.renderingEnabled) return;

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
   * Handle passengers exiting elevators
   */
  handlePassengersExited(passengers) {
    if (!this.renderingEnabled) return;

    passengers.forEach((passenger) => {
      const display = this.passengerDisplays.get(passenger.id);
      if (display) {
        display.updateFromState(passenger);
      }
    });
  }

  /**
   * Clean up displays for exited passengers
   */
  cleanupExitedPassengers() {
    for (const [id, display] of this.passengerDisplays) {
      if (!display.active) {
        // Force DOM cleanup for inactive displays
        display.dispatchEvent(new CustomEvent("removed"));
        this.passengerDisplays.delete(id);
      }
    }
  }

  /**
   * Clean up all displays
   */
  cleanup() {
    this.abortController.abort();
    this.floorDisplays.clear();
    this.elevatorDisplays.clear();
    this.passengerDisplays.clear();
    this.abortController = new AbortController();
  }
}
