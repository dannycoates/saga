/**
 * @typedef {Object} SimulationConfig
 * @property {number} floorCount - Number of floors in the building
 * @property {number} elevatorCount - Number of elevators
 * @property {number[]} elevatorCapacities - Capacity for each elevator
 * @property {number} spawnRate - Passenger spawn rate per second
 * @property {number} speedFloorsPerSec - Elevator speed in floors per second
 * @property {{evaluate: (stats: SimulationStats) => boolean | null}} endCondition - Challenge end condition
 */

/**
 * @typedef {Object} SimulationStats
 * @property {number} transportedCount - Total passengers transported
 * @property {number} transportedPerSec - Transport rate per second
 * @property {number} avgWaitTime - Average passenger wait time in seconds
 * @property {number} maxWaitTime - Maximum passenger wait time in seconds
 * @property {number} moveCount - Total elevator move commands
 * @property {number} elapsedTime - Elapsed simulation time in seconds
 */

/**
 * @typedef {Object} SimulationState
 * @property {Array<{level: number, buttons: {up: boolean, down: boolean}}>} floors - Floor states
 * @property {Array<import('./Elevator.js').ElevatorState>} elevators - Elevator states
 * @property {Array<import('./Passenger.js').PassengerStateData>} passengers - Passenger states
 * @property {SimulationStats} stats - Current statistics
 * @property {boolean} isChallengeEnded - Whether challenge has ended
 */

/**
 * @typedef {Object} UserCodeObject
 * @property {(elevators: Array<import('../runtimes/BaseRuntime.js').ElevatorAPI>, floors: Array<import('../runtimes/BaseRuntime.js').FloorAPI>, dt: number) => Promise<void>} safeTick - User tick function with error handling
 * @property {() => Promise<void>} [start] - Optional start function
 */

/**
 * Abstract interface for simulation backends.
 * All simulation implementations must extend this class and implement its methods.
 * Extends EventTarget to emit simulation events.
 *
 * @abstract
 * @extends EventTarget
 *
 * @fires SimulationBackend#state_changed - Emitted each tick with current state
 * @fires SimulationBackend#stats_changed - Emitted periodically with updated statistics
 * @fires SimulationBackend#passenger_spawned - Emitted when a new passenger spawns
 * @fires SimulationBackend#passengers_exited - Emitted when passengers exit an elevator
 * @fires SimulationBackend#passengers_boarded - Emitted when passengers board an elevator
 * @fires SimulationBackend#challenge_ended - Emitted when the challenge ends
 */
export class SimulationBackend extends EventTarget {
  /**
   * Initialize the simulation with the given configuration.
   * Must be called before tick() or callUserCode().
   * @abstract
   * @param {SimulationConfig} config - Configuration object
   * @returns {void}
   */
  initialize(config) {
    throw new Error("SimulationBackend.initialize must be implemented");
  }

  /**
   * Advance the simulation by the given time delta.
   * Updates physics, spawns passengers, and emits state events.
   * @abstract
   * @param {number} dt - Time delta in seconds
   * @returns {void}
   */
  tick(dt) {
    throw new Error("SimulationBackend.tick must be implemented");
  }

  /**
   * Get the current state of the simulation.
   * @abstract
   * @returns {SimulationState} Current state snapshot
   */
  getState() {
    throw new Error("SimulationBackend.getState must be implemented");
  }

  /**
   * Execute user code with current simulation state.
   * Provides elevator and floor APIs to user's tick function.
   * @abstract
   * @param {UserCodeObject} codeObj - User code object with tick method
   * @param {number} dt - Time delta in seconds
   * @returns {Promise<void>}
   */
  async callUserCode(codeObj, dt) {
    throw new Error("SimulationBackend.callUserCode must be implemented");
  }

  /**
   * Clean up resources and reset state.
   * Should be called when ending a simulation.
   * @abstract
   * @returns {void}
   */
  cleanup() {
    throw new Error("SimulationBackend.cleanup must be implemented");
  }

  /**
   * Get current simulation statistics.
   * @abstract
   * @returns {SimulationStats} Statistics object
   */
  getStats() {
    throw new Error("SimulationBackend.getStats must be implemented");
  }
}
