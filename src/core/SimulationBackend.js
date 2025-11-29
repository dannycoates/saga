/**
 * Abstract interface for simulation backends.
 * All simulation implementations must implement this interface.
 */
export class SimulationBackend extends EventTarget {
  /**
   * Initialize the simulation with the given configuration
   * @param {Object} config - Configuration object
   * @param {number} config.floorCount - Number of floors
   * @param {number} config.elevatorCount - Number of elevators
   * @param {number[]} config.elevatorCapacities - Capacity for each elevator
   * @param {number} config.spawnRate - Passenger spawn rate
   * @param {number} config.speedFloorsPerSec - Elevator speed
   */
  initialize(config) {
    throw new Error("SimulationBackend.initialize must be implemented");
  }

  /**
   * Advance the simulation by the given time delta
   * @param {number} dt - Time delta in seconds
   */
  tick(dt) {
    throw new Error("SimulationBackend.tick must be implemented");
  }

  /**
   * Get the current state of the simulation
   * @returns {Object} Current state snapshot
   */
  getState() {
    throw new Error("SimulationBackend.getState must be implemented");
  }

  /**
   * Execute user code with current simulation state
   * @param {Object} codeObj - User code object with tick method
   */
  async callUserCode(codeObj, dt) {
    throw new Error("SimulationBackend.callUserCode must be implemented");
  }

  /**
   * Clean up resources
   */
  cleanup() {
    throw new Error("SimulationBackend.cleanup must be implemented");
  }

  /**
   * Get current statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    throw new Error("SimulationBackend.getStats must be implemented");
  }

  /**
   * Check if the simulation has ended
   * @returns {boolean} True if simulation has ended
   */
  hasEnded() {
    throw new Error("SimulationBackend.hasEnded must be implemented");
  }
}
