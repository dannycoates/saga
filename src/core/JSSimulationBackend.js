import { SimulationBackend } from "./SimulationBackend.js";
import { randomInt, throttle } from "../utils/common.js";
import { Floor } from "./Floor.js";
import { Elevator } from "./Elevator.js";
import { Passenger } from "./Passenger.js";
import { EventBus } from "../utils/EventBus.js";

// Default configuration
/** @type {number} Default passenger spawn rate (passengers per second) */
const DEFAULT_SPAWN_RATE = 0.5;
/** @type {number} Default elevator speed (floors per second) */
const DEFAULT_ELEVATOR_SPEED = 2.6;

// Stats update rate
/** @type {number} Maximum stats update frequency (frames per second) */
const STATS_UPDATE_FPS = 30;

// Spawn timing
/** @type {number} Offset multiplier to trigger immediate first passenger spawn */
const IMMEDIATE_SPAWN_MULTIPLIER = 1.001;

// Passenger generation
/** @type {number} Minimum passenger weight */
const MIN_PASSENGER_WEIGHT = 55;
/** @type {number} Maximum passenger weight */
const MAX_PASSENGER_WEIGHT = 100;
/** @type {number} Odds denominator for going somewhere other than ground floor (1 in N) */
const NON_GROUND_DESTINATION_ODDS = 10;

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
  /**
   * Creates a new simulation backend.
   * @param {EventBus} eventBus - Event bus for emitting simulation events
   */
  constructor(eventBus) {
    super();

    /** @type {EventBus} */
    this.eventBus = eventBus;

    // Configuration
    /** @type {number} Number of floors in building */
    this.floorCount = 0;
    /** @type {number} Number of elevators */
    this.elevatorCount = 0;
    /** @type {number[]} Capacity for each elevator */
    this.elevatorCapacities = [];
    /** @type {number} Passenger spawn rate per second */
    this.spawnRate = DEFAULT_SPAWN_RATE;
    /** @type {number} Elevator speed in floors per second */
    this.speedFloorsPerSec = DEFAULT_ELEVATOR_SPEED;

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

    // Throttled stats update
    /** @type {() => void} */
    this.throttledStats = throttle(() => {
      if (this.isChallengeEnded) {
        return;
      }
      this.recalculateStats();
      this.eventBus.emit("simulation:stats_changed", this.getStats());
    }, 1000 / STATS_UPDATE_FPS);
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
    this.speedFloorsPerSec = config.speedFloorsPerSec || DEFAULT_ELEVATOR_SPEED;
    this.endCondition = config.endCondition;

    // Reset state
    this.transportedCount = 0;
    this.transportedPerSec = 0.0;
    this.moveCount = 0;
    this.elapsedTime = 0.0;
    this.maxWaitTime = 0.0;
    this.avgWaitTime = 0.0;
    this.isChallengeEnded = false;

    // Initialize spawn timer to trigger immediate first spawn
    this.elapsedSinceSpawn = IMMEDIATE_SPAWN_MULTIPLIER / this.spawnRate;

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
    const weight = randomInt(MIN_PASSENGER_WEIGHT, MAX_PASSENGER_WEIGHT);
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

    this.eventBus.emit("simulation:passenger_spawned", {
      passenger: passenger.toJSON(),
    });
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
      // Usually going down to ground floor, but occasionally going elsewhere
      if (randomInt(0, NON_GROUND_DESTINATION_ODDS) === 0) {
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
      this.eventBus.emit("simulation:passengers_exited", {
        passengers: exitingPassengers.map((p) => p.toJSON()),
      });
    }
    if (boardingPassengers.length > 0) {
      this.eventBus.emit("simulation:passengers_boarded", {
        passengers: boardingPassengers.map((p) => p.toJSON()),
      });
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
    this.eventBus.emit("simulation:state_changed", {
      ...this.getState(),
      dt: dt,
    });

    const succeeded = this.endCondition?.evaluate(this.getStats()) ?? null;
    if (succeeded !== null) {
      this.isChallengeEnded = true;
      // Emit final stats update before challenge ends
      this.recalculateStats();
      this.eventBus.emit("simulation:stats_changed", this.getStats());
      // Emit challenge ended with final stats included
      this.eventBus.emit("simulation:challenge_ended", { succeeded });
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
