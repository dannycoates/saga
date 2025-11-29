/**
 * Null implementation of DisplayManager for headless operation.
 * Provides the same interface as DisplayManager but performs no operations.
 * Useful for testing WorldManager without DOM dependencies.
 */
export class NullDisplayManager {
  /**
   * Factory method for creating NullDisplayManager instances.
   * @param {any} [_options] - Ignored options (for API compatibility)
   * @returns {NullDisplayManager} A new NullDisplayManager instance
   */
  static create(_options) {
    return new NullDisplayManager();
  }

  constructor() {
    /** @type {Map<number, any>} */
    this.floorDisplays = new Map();
    /** @type {Map<number, any>} */
    this.elevatorDisplays = new Map();
    /** @type {Map<string, any>} */
    this.passengerDisplays = new Map();
  }

  /** @type {Map<number, any>} */
  get floors() {
    return this.floorDisplays;
  }

  /** @type {Map<number, any>} */
  get elevators() {
    return this.elevatorDisplays;
  }

  /** @type {Map<string, any>} */
  get passengers() {
    return this.passengerDisplays;
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
  updateDisplays(_state, _dt = 0) {}

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
    this.floorDisplays.clear();
    this.elevatorDisplays.clear();
    this.passengerDisplays.clear();
  }
}
