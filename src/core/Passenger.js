/**
 * Passenger state type.
 * @typedef {'waiting' | 'riding' | 'exited'} PassengerState
 */

/**
 * Serialized passenger state for simulation snapshots.
 * @typedef {Object} PassengerStateData
 * @property {string} id - Unique identifier
 * @property {number} weight - Passenger weight
 * @property {number} startingFloor - Floor where passenger spawned
 * @property {number} destinationFloor - Target floor
 * @property {number} currentFloor - Current floor location
 * @property {PassengerState} state - Current passenger state
 * @property {number | null} elevatorIndex - Index of elevator or null
 * @property {number | null} slotInElevator - Slot in elevator or null
 */

/**
 * Represents a passenger with a state machine for waiting, riding, and exiting.
 */
export class Passenger {
  /**
   * Creates a new passenger instance.
   * @param {string} id - Unique passenger identifier
   * @param {number} weight - Passenger weight (100 = standard full weight)
   * @param {number} startingFloor - Floor where passenger spawned
   * @param {number} destinationFloor - Target floor
   * @param {number} now - Spawn timestamp (elapsed simulation time)
   */
  constructor(id, weight, startingFloor, destinationFloor, now) {
    /** @type {number} Passenger weight for capacity calculations */
    this.weight = weight;
    /** @type {number} Floor where passenger spawned */
    this.startingFloor = startingFloor;
    /** @type {number} Target floor */
    this.destinationFloor = destinationFloor;
    /** @type {import('./Elevator.js').Elevator | null} Current elevator or null if not riding */
    this.elevator = null;
    /** @type {number | null} Slot index in elevator or null */
    this.slotInElevator = null;
    /** @type {'waiting' | 'riding' | 'exited'} Current passenger state */
    this.state = "waiting";
    /** @type {string} Unique identifier */
    this.id = id;
    /** @type {number} Simulation time when passenger spawned */
    this.spawnTimestamp = now;
    /** @type {number | null} Simulation time when passenger reached destination */
    this.transportedTimestamp = null;
  }

  /**
   * Boards an elevator, transitioning from waiting to riding state.
   * @param {import('./Elevator.js').Elevator} elevator - Elevator to board
   * @param {number} slot - Slot index in elevator
   * @returns {boolean} True if boarded successfully, false if already in an elevator
   */
  enterElevator(elevator, slot) {
    if (this.elevator) {
      return false;
    }
    this.elevator = elevator;
    this.slotInElevator = slot;
    this.state = "riding";
    return true;
  }

  /**
   * Exits the current elevator, transitioning to exited state.
   * @returns {boolean} True if exited successfully, false if not in an elevator
   */
  exitElevator() {
    if (!this.elevator) {
      return false;
    }
    this.elevator = null;
    this.state = "exited";
    return true;
  }

  /**
   * Checks if passenger should exit at the given floor.
   * @param {number} floor - Floor to check
   * @returns {boolean} True if this is the passenger's destination
   */
  shouldExitAt(floor) {
    return floor === this.destinationFloor;
  }

  /**
   * Current floor location (elevator's floor if riding, starting floor if waiting).
   * @type {number}
   * @readonly
   */
  get currentFloor() {
    return this.elevator ? this.elevator.currentFloor : this.startingFloor;
  }

  /**
   * Serializes passenger state for simulation snapshots.
   * @returns {{
   *   id: string,
   *   weight: number,
   *   startingFloor: number,
   *   destinationFloor: number,
   *   currentFloor: number,
   *   state: 'waiting' | 'riding' | 'exited',
   *   elevatorIndex: number | null,
   *   slotInElevator: number | null
   * }}
   */
  toJSON() {
    return {
      id: this.id,
      weight: this.weight,
      startingFloor: this.startingFloor,
      destinationFloor: this.destinationFloor,
      currentFloor: this.currentFloor,
      state: this.state,
      elevatorIndex: this.elevator ? this.elevator.index : null,
      slotInElevator: this.slotInElevator,
    };
  }
}
