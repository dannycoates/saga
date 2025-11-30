import { SimulationBackend } from "./SimulationBackend.js";
import { randomInt, throttle } from "../utils/common.js";
import { Floor } from "./Floor.js";
import { Elevator } from "./Elevator.js";
import { Passenger } from "./Passenger.js";

/**
 * JavaScript implementation of the simulation backend.
 * Handles elevator physics, passenger spawning, and game logic.
 *
 * @extends SimulationBackend
 *
 * @fires JSSimulationBackend#state_changed - Emitted each tick with current state
 * @fires JSSimulationBackend#stats_changed - Emitted periodically with updated statistics
 * @fires JSSimulationBackend#passenger_spawned - Emitted when a new passenger spawns
 * @fires JSSimulationBackend#passengers_exited - Emitted when passengers exit an elevator
 * @fires JSSimulationBackend#passengers_boarded - Emitted when passengers board an elevator
 * @fires JSSimulationBackend#challenge_ended - Emitted when the challenge ends (win or lose)
 */
export class JSSimulationBackend extends SimulationBackend {
  constructor() {
    super();

    // Configuration
    /** @type {number} Number of floors in building */
    this.floorCount = 0;
    /** @type {number} Number of elevators */
    this.elevatorCount = 0;
    /** @type {number[]} Capacity for each elevator */
    this.elevatorCapacities = [];
    /** @type {number} Passenger spawn rate per second */
    this.spawnRate = 0;
    /** @type {number} Elevator speed in floors per second */
    this.speedFloorsPerSec = 2.6;

    // Stats
    /** @type {number} Total passengers successfully transported */
    this.transportedCount = 0;
    /** @type {number} Transport rate (passengers per second) */
    this.transportedPerSec = 0.0;
    /** @type {number} Total elevator move commands issued */
    this.moveCount = 0;
    /** @type {number} Elapsed simulation time in seconds */
    this.elapsedTime = 0.0;
    /** @type {number} Maximum passenger wait time in seconds */
    this.maxWaitTime = 0.0;
    /** @type {number} Average passenger wait time in seconds */
    this.avgWaitTime = 0.0;
    /** @type {boolean} Whether the challenge has ended */
    this.isChallengeEnded = false;

    // Internal state
    /** @type {number} Time since last passenger spawn */
    this.elapsedSinceSpawn = 0;

    // Simulation entities
    /** @type {Floor[]} All floors in building */
    this.floors = [];
    /** @type {Elevator[]} All elevators */
    this.elevators = [];
    /** @type {Passenger[]} Active passengers (waiting or riding) */
    this.passengers = [];

    /** @type {{evaluate: (stats: import('./SimulationBackend.js').SimulationStats) => boolean | null} | undefined} */
    this.endCondition = undefined;

    // Throttled stats update (30 FPS max)
    /** @type {() => void} */
    this.throttledStats = throttle(() => {
      if (this.isChallengeEnded) {
        return;
      }
      this.recalculateStats();
      this.dispatchEvent(
        new CustomEvent("stats_changed", { detail: this.getStats() }),
      );
    }, 1000 / 30);
  }

  /**
   * Initialize the simulation with the given configuration.
   * Creates floors, elevators, and resets all state.
   * @override
   * @param {import('./SimulationBackend.js').SimulationConfig} config - Configuration object
   * @returns {void}
   */
  initialize(config) {
    this.floorCount = config.floorCount;
    this.elevatorCount = config.elevatorCount;
    this.elevatorCapacities = config.elevatorCapacities || [4];
    this.spawnRate = config.spawnRate;
    this.speedFloorsPerSec = config.speedFloorsPerSec || 2.6;
    this.endCondition = config.endCondition;

    // Reset state
    this.transportedCount = 0;
    this.transportedPerSec = 0.0;
    this.moveCount = 0;
    this.elapsedTime = 0.0;
    this.maxWaitTime = 0.0;
    this.avgWaitTime = 0.0;
    this.isChallengeEnded = false;

    this.elapsedSinceSpawn = 1.001 / this.spawnRate;

    this.passengers = [];
    this.floors = Array.from(
      { length: this.floorCount },
      (_, i) => new Floor(i),
    );
    this.elevators = Array.from({ length: this.elevatorCount }, (_, i) => {
      const capacity =
        this.elevatorCapacities[i % this.elevatorCapacities.length];
      const elevator = new Elevator(
        i,
        this.speedFloorsPerSec,
        this.floorCount,
        capacity,
      );
      return elevator;
    });
  }

  /**
   * Spawns a new passenger at a random floor with a random destination.
   * Emits passenger_spawned event.
   * @private
   * @returns {void}
   */
  spawnPassenger() {
    const { currentFloor, destinationFloor } = this.randomStartAndDestination();
    const weight = randomInt(55, 100);
    const passenger = new Passenger(
      `passenger_${this.elapsedTime}_${Math.random()}`,
      weight,
      currentFloor,
      destinationFloor,
      this.elapsedTime,
    );
    this.passengers.push(passenger);

    // Press floor button
    const startFloor = this.floors[currentFloor];
    if (destinationFloor > currentFloor) {
      startFloor.pressButton("up");
    } else if (destinationFloor < currentFloor) {
      startFloor.pressButton("down");
    }

    this.dispatchEvent(
      new CustomEvent("passenger_spawned", {
        detail: { passenger: passenger.toJSON() },
      }),
    );
  }

  /**
   * Generates random start and destination floors for a new passenger.
   * Biased toward ground floor (lobby pattern).
   * @private
   * @returns {{currentFloor: number, destinationFloor: number}}
   */
  randomStartAndDestination() {
    const currentFloor =
      randomInt(0, 1) === 0 ? 0 : randomInt(0, this.floorCount - 1);
    let destinationFloor;

    if (currentFloor === 0) {
      // Definitely going up
      destinationFloor = randomInt(1, this.floorCount - 1);
    } else {
      // Usually going down, but sometimes not
      if (randomInt(0, 10) === 0) {
        destinationFloor =
          (currentFloor + randomInt(1, this.floorCount - 1)) % this.floorCount;
      } else {
        destinationFloor = 0;
      }
    }

    return { currentFloor, destinationFloor };
  }

  /**
   * Handles passenger boarding and exiting when an elevator arrives at a floor.
   * Updates statistics and emits passengers_exited/passengers_boarded events.
   * @private
   * @param {Elevator} elevator - The elevator that has arrived
   * @returns {void}
   */
  handleElevatorArrival(elevator) {
    const currentFloor = elevator.currentFloor;

    // Handle passengers exiting
    /** @type {Passenger[]} */
    const exitingPassengers = [];
    elevator.passengers.forEach((passenger) => {
      if (passenger && passenger.shouldExitAt(currentFloor)) {
        elevator.removePassenger(passenger);
        passenger.transportedTimestamp = this.elapsedTime;
        exitingPassengers.push(passenger);

        // Update stats
        this.transportedCount++;
        const waitTime = this.elapsedTime - passenger.spawnTimestamp;
        this.maxWaitTime = Math.max(this.maxWaitTime, waitTime);
        this.avgWaitTime =
          (this.avgWaitTime * (this.transportedCount - 1) + waitTime) /
          this.transportedCount;
      }
    });

    // Handle passengers boarding
    const waitingPassengers = this.passengers.filter(
      (p) => p.currentFloor === currentFloor && !p.elevator,
    );

    const floor = this.floors[currentFloor];
    const goingUp = floor.buttons.up && elevator.goingUpIndicator;
    const goingDown = floor.buttons.down && elevator.goingDownIndicator;

    /** @type {Passenger[]} */
    const boardingPassengers = [];
    waitingPassengers.forEach((passenger) => {
      if (elevator.isFull) return;

      const wantsUp = passenger.destinationFloor > currentFloor;
      const wantsDown = passenger.destinationFloor < currentFloor;

      if ((wantsUp && goingUp) || (wantsDown && goingDown)) {
        elevator.addPassenger(passenger);
        boardingPassengers.push(passenger);
      }
    });

    // Clear floor buttons if no more passengers waiting
    const remainingUp = waitingPassengers.some(
      (p) => !p.elevator && p.destinationFloor > currentFloor,
    );
    const remainingDown = waitingPassengers.some(
      (p) => !p.elevator && p.destinationFloor < currentFloor,
    );

    if (goingUp && !remainingUp) {
      floor.clearButton("up");
    }
    if (goingDown && !remainingDown) {
      floor.clearButton("down");
    }

    // Emit events
    if (exitingPassengers.length > 0) {
      this.dispatchEvent(
        new CustomEvent("passengers_exited", {
          detail: {
            passengers: exitingPassengers.map((p) => p.toJSON()),
          },
        }),
      );
    }
    if (boardingPassengers.length > 0) {
      this.dispatchEvent(
        new CustomEvent("passengers_boarded", {
          detail: {
            passengers: boardingPassengers.map((p) => p.toJSON()),
          },
        }),
      );
    }

    this.recalculateStats();
  }

  /**
   * Advances the simulation by the given time delta.
   * Spawns passengers, updates elevator physics, handles arrivals,
   * and checks end conditions.
   * @override
   * @param {number} dt - Time delta in seconds
   * @returns {void}
   */
  tick(dt) {
    if (this.isChallengeEnded) return;

    this.elapsedTime += dt;
    this.elapsedSinceSpawn += dt;

    // Spawn passengers
    while (this.elapsedSinceSpawn > 1.0 / this.spawnRate) {
      this.elapsedSinceSpawn -= 1.0 / this.spawnRate;
      this.spawnPassenger();
    }

    // Update elevators
    this.elevators.forEach((elevator) => {
      const doorsOpen = elevator.tick(dt);
      if (doorsOpen) {
        this.handleElevatorArrival(elevator);
      }
    });

    // Remove transported passengers
    this.passengers = this.passengers.filter((p) => p.state !== "exited");

    // Emit state update
    this.dispatchEvent(
      new CustomEvent("state_changed", {
        detail: {
          ...this.getState(),
          dt: dt,
        },
      }),
    );

    const succeeded = this.endCondition?.evaluate(this.getStats()) ?? null;
    if (succeeded !== null) {
      this.isChallengeEnded = true;
      // Emit final stats update before challenge ends
      this.recalculateStats();
      this.dispatchEvent(
        new CustomEvent("stats_changed", { detail: this.getStats() }),
      );
      // Emit challenge ended with final stats included
      this.dispatchEvent(
        new CustomEvent("challenge_ended", {
          detail: {
            succeeded: succeeded,
          },
        }),
      );
    } else {
      this.throttledStats();
    }
  }

  /**
   * Recalculates derived statistics (transport rate, move count).
   * @private
   * @returns {void}
   */
  recalculateStats() {
    this.transportedPerSec = this.transportedCount / this.elapsedTime;
    this.moveCount = this.elevators.reduce(
      (sum, elevator) => sum + elevator.moves,
      0,
    );
  }

  /**
   * Returns current simulation statistics.
   * @override
   * @returns {import('./SimulationBackend.js').SimulationStats}
   */
  getStats() {
    return {
      transportedCount: this.transportedCount,
      transportedPerSec: this.transportedPerSec,
      avgWaitTime: this.avgWaitTime,
      maxWaitTime: this.maxWaitTime,
      moveCount: this.moveCount,
      elapsedTime: this.elapsedTime,
    };
  }

  /**
   * Returns current simulation state snapshot.
   * @override
   * @returns {import('./SimulationBackend.js').SimulationState}
   */
  getState() {
    return {
      floors: this.floors.map((floor) => floor.toJSON()),
      elevators: this.elevators.map((elevator) => elevator.toJSON()),
      passengers: this.passengers.map((passenger) => passenger.toJSON()),
      stats: this.getStats(),
      isChallengeEnded: this.isChallengeEnded,
    };
  }

  /**
   * Executes user code with current elevator and floor APIs.
   * @override
   * @param {import('./SimulationBackend.js').UserCodeObject} codeObj - User code object
   * @param {number} dt - Time delta in seconds
   * @returns {Promise<void>}
   */
  async callUserCode(codeObj, dt) {
    if (this.isChallengeEnded) return;
    const elevatorAPIs = this.elevators.map((elevator) => elevator.toAPI());
    const floorAPIs = this.floors.map((floor) => floor.toJSON());
    await codeObj.safeTick(elevatorAPIs, floorAPIs, dt);
  }

  /**
   * Cleans up simulation resources.
   * @override
   * @returns {void}
   */
  cleanup() {
    this.isChallengeEnded = true;
    this.passengers = [];
    this.elevators = [];
    this.floors = [];
  }
}
