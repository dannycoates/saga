import { FloorViewModel } from "./viewmodels/FloorViewModel.js";
import { ElevatorViewModel } from "./viewmodels/ElevatorViewModel.js";
import { PassengerViewModel } from "./viewmodels/PassengerViewModel.js";
import { EventBus } from "../utils/EventBus.js";

/**
 * @typedef {import('../core/SimulationBackend.js').SimulationState} SimulationState
 * @typedef {import('../core/Passenger.js').PassengerStateData} PassengerStateData
 */

/**
 * @typedef {Object} ViewModelManagerOptions
 * @property {boolean} [isRenderingEnabled=true] - Whether to create and update view models
 * @property {number} [floorHeight=50] - Height of each floor in pixels
 * @property {EventBus} [eventBus] - Event bus to subscribe to
 * @property {SimulationState} [initialState] - Initial simulation state
 */

/**
 * Manages all view model objects and updates them based on simulation state.
 * Subscribes to event bus for simulation events and maintains view model lifecycle.
 * Can be disabled for headless operation.
 */
export class ViewModelManager {
  /**
   * Factory method for creating ViewModelManager instances.
   * If eventBus and initialState are provided, initializes view models and subscribes to events.
   * @param {ViewModelManagerOptions} [options={}] - Configuration options
   * @returns {ViewModelManager} A new ViewModelManager instance
   */
  static create(options = {}) {
    const instance = new ViewModelManager(options);
    if (options.initialState) {
      instance.initialize(options.initialState);
    }
    if (options.eventBus) {
      instance.subscribeToEvents();
    }
    return instance;
  }

  /**
   * Creates a view model manager.
   * @param {ViewModelManagerOptions} [options={}] - Configuration options
   */
  constructor(options = {}) {
    /** @type {boolean} Whether rendering is enabled */
    this.isRenderingEnabled = options.isRenderingEnabled !== false;
    /** @type {number} Height of each floor in pixels */
    this.floorHeight = options.floorHeight || 50;
    /** @type {EventBus | undefined} Event bus for simulation events */
    this.eventBus = options.eventBus;

    /** @type {Map<number, FloorViewModel>} Floor view models keyed by level */
    this.floorViewModels = new Map();
    /** @type {Map<number, ElevatorViewModel>} Elevator view models keyed by index */
    this.elevatorViewModels = new Map();
    /** @type {Map<string, PassengerViewModel>} Passenger view models keyed by ID */
    this.passengerViewModels = new Map();

    /** @type {AbortController} Controller for event listener cleanup */
    this.abortController = new AbortController();
  }

  /**
   * Floor view models map (alias for floorViewModels).
   * @type {Map<number, FloorViewModel>}
   * @readonly
   */
  get floors() {
    return this.floorViewModels;
  }

  /**
   * Elevator view models map (alias for elevatorViewModels).
   * @type {Map<number, ElevatorViewModel>}
   * @readonly
   */
  get elevators() {
    return this.elevatorViewModels;
  }

  /**
   * Passenger view models map (alias for passengerViewModels).
   * @type {Map<string, PassengerViewModel>}
   * @readonly
   */
  get passengers() {
    return this.passengerViewModels;
  }

  /**
   * Initializes view models based on initial simulation state.
   * Creates floor and elevator view models positioned for the world.
   * @param {SimulationState} initialState - Initial simulation state
   * @returns {void}
   */
  initialize(initialState) {
    if (!this.isRenderingEnabled) return;

    // Clear existing view models
    this.cleanup();

    // Create floor view models
    initialState.floors.forEach((floor, index) => {
      const yPos = (initialState.floors.length - 1 - index) * this.floorHeight;
      const viewModel = new FloorViewModel(floor, yPos);
      this.floorViewModels.set(floor.level, viewModel);
    });

    // Create elevator view models
    const elevatorGutter = 20;
    const initialXOffset = 200; // For floor view model
    const elevatorViewModels = initialState.elevators.map((elevator) => {
      return new ElevatorViewModel(elevator, 0, elevator.capacity);
    });

    const totalElevatorWidth = elevatorViewModels.reduce((sum, viewModel) => {
      return sum + viewModel.width + elevatorGutter;
    }, 0);

    const innerWorld = /** @type {HTMLElement | null} */ (
      document.querySelector(".innerworld")
    );
    if (innerWorld) {
      innerWorld.style.minWidth = `${totalElevatorWidth + initialXOffset}px`;
    }

    let currentX = initialXOffset;
    elevatorViewModels.forEach((viewModel, i) => {
      viewModel.moveTo(
        currentX,
        viewModel.getDisplayYPos(initialState.elevators[i].position),
      );
      this.elevatorViewModels.set(initialState.elevators[i].index, viewModel);
      currentX += viewModel.width + elevatorGutter;
    });

    // Initial render with tick to set up positions
    this.updateViewModels(initialState, 0);
  }

  /**
   * Subscribes to simulation events via the event bus.
   * Uses AbortController for proper cleanup on dispose.
   * @returns {void}
   */
  subscribeToEvents() {
    if (!this.eventBus) return;

    const { signal } = this.abortController;

    this.eventBus.on(
      "simulation:state_changed",
      (e) => {
        const detail =
          /** @type {CustomEvent<SimulationState & {dt?: number}>} */ (e)
            .detail;
        const dt = detail.dt ?? 0;
        this.updateViewModels(detail, dt);
      },
      { signal },
    );

    this.eventBus.on(
      "simulation:passenger_spawned",
      (e) => {
        const detail =
          /** @type {CustomEvent<{passenger: PassengerStateData}>} */ (e)
            .detail;
        this.handlePassengerSpawned(detail.passenger);
      },
      { signal },
    );

    this.eventBus.on(
      "simulation:passengers_exited",
      (e) => {
        const detail =
          /** @type {CustomEvent<{passengers: PassengerStateData[]}>} */ (e)
            .detail;
        this.handlePassengersExited(detail.passengers);
      },
      { signal },
    );
  }

  /**
   * Updates all view models based on current simulation state.
   * Called on each state change event from the backend.
   * @param {SimulationState} state - Current simulation state
   * @param {number} [dt=0] - Time delta in seconds
   * @returns {void}
   */
  updateViewModels(state, dt = 0) {
    if (!this.isRenderingEnabled) return;

    // Update floor view models
    state.floors.forEach((floor) => {
      const viewModel = this.floorViewModels.get(floor.level);
      if (viewModel) {
        viewModel.updateFromState(floor);
        viewModel.tick(dt);
      }
    });

    // Update elevator view models
    state.elevators.forEach((elevator) => {
      const viewModel = this.elevatorViewModels.get(elevator.index);
      if (viewModel) {
        viewModel.updateFromState(elevator);
        viewModel.tick(dt);
      }
    });

    // Update passenger view models
    state.passengers.forEach((passenger) => {
      let viewModel = this.passengerViewModels.get(passenger.id);
      if (viewModel) {
        viewModel.updateFromState(passenger);
      }
    });

    // Tick all passenger view models, including those not in simulation anymore
    // This allows exit animations to continue running
    for (const [id, viewModel] of this.passengerViewModels) {
      if (viewModel.isActive) {
        viewModel.tick(dt);
      }
    }

    // Clean up exited passengers
    this.cleanupExitedPassengers();
  }

  /**
   * Handles new passenger spawn event.
   * Creates a new passenger view model at the appropriate floor position.
   * @param {PassengerStateData} passengerState - Spawned passenger state
   * @returns {void}
   */
  handlePassengerSpawned(passengerState) {
    if (!this.isRenderingEnabled) return;

    const startingY =
      (this.floorViewModels.size - 1 - passengerState.currentFloor) *
        this.floorHeight +
      30;
    const viewModel = new PassengerViewModel(
      passengerState,
      startingY,
      this.elevatorViewModels,
    );

    this.passengerViewModels.set(passengerState.id, viewModel);

    // Emit event so UI can present the new passenger
    if (this.eventBus) {
      this.eventBus.emit("viewmodel:passenger_created", {
        passengerId: passengerState.id,
        viewModel,
      });
    }
  }

  /**
   * Handles passengers exiting elevators.
   * Updates passenger view models to trigger exit animations.
   * @param {PassengerStateData[]} passengers - Array of exited passenger states
   * @returns {void}
   */
  handlePassengersExited(passengers) {
    if (!this.isRenderingEnabled) return;

    passengers.forEach((passenger) => {
      const viewModel = this.passengerViewModels.get(passenger.id);
      if (viewModel) {
        viewModel.updateFromState(passenger);
      }
    });
  }

  /**
   * Cleans up view models for passengers that have completed exit animations.
   * Removes inactive passenger view models from the map.
   * @private
   * @returns {void}
   */
  cleanupExitedPassengers() {
    for (const [id, viewModel] of this.passengerViewModels) {
      if (!viewModel.isActive) {
        // Force DOM cleanup for inactive view models
        viewModel.dispatchEvent(new CustomEvent("removed"));
        this.passengerViewModels.delete(id);
      }
    }
  }

  /**
   * Cleans up all view models and event subscriptions.
   * Cancels all animations, aborts event listeners, and clears view model maps.
   * @returns {void}
   */
  cleanup() {
    this.abortController.abort();

    // Cancel animations on all view models to release closures
    for (const viewModel of this.elevatorViewModels.values()) {
      viewModel.cancelAnimation();
    }
    for (const viewModel of this.passengerViewModels.values()) {
      viewModel.cancelAnimation();
    }

    this.floorViewModels.clear();
    this.elevatorViewModels.clear();
    this.passengerViewModels.clear();
    this.abortController = new AbortController();
  }
}
