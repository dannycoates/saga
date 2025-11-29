/**
 * Null implementation of ViewModelManager for headless operation.
 * Provides the same interface as ViewModelManager but performs no operations.
 * Useful for testing WorldManager without DOM dependencies.
 */
export class NullViewModelManager {
  /**
   * Factory method for creating NullViewModelManager instances.
   * @param {any} [_options] - Ignored options (for API compatibility)
   * @returns {NullViewModelManager} A new NullViewModelManager instance
   */
  static create(_options) {
    return new NullViewModelManager();
  }

  constructor() {
    /** @type {Map<number, any>} */
    this.floorViewModels = new Map();
    /** @type {Map<number, any>} */
    this.elevatorViewModels = new Map();
    /** @type {Map<string, any>} */
    this.passengerViewModels = new Map();
  }

  /** @type {Map<number, any>} */
  get floors() {
    return this.floorViewModels;
  }

  /** @type {Map<number, any>} */
  get elevators() {
    return this.elevatorViewModels;
  }

  /** @type {Map<string, any>} */
  get passengers() {
    return this.passengerViewModels;
  }

  /**
   * No-op initialization.
   * @param {any} _initialState - Ignored
   */
  initialize(_initialState) {}

  /**
   * No-op subscription.
   * @param {any} _backend - Ignored
   */
  subscribeToBackend(_backend) {}

  /**
   * No-op update.
   * @param {any} _state - Ignored
   * @param {number} [_dt=0] - Ignored
   */
  updateViewModels(_state, _dt = 0) {}

  /**
   * No-op handler.
   * @param {any} _passengerState - Ignored
   */
  handlePassengerSpawned(_passengerState) {}

  /**
   * No-op handler.
   * @param {any[]} _passengers - Ignored
   */
  handlePassengersExited(_passengers) {}

  /**
   * No-op cleanup.
   */
  cleanup() {
    this.floorViewModels.clear();
    this.elevatorViewModels.clear();
    this.passengerViewModels.clear();
  }
}
