import { randomInt } from "../utils/common.js";

// Physics constants
/** @type {number} Acceleration rate in floors per second squared */
const ACCELERATION = 1.1;
/** @type {number} Deceleration rate in floors per second squared */
const DECELERATION = 1.6;

// Timing constants
/** @type {number} Time elevator pauses with doors open (seconds) */
const DOOR_PAUSE_TIME = 1.2;

// Movement thresholds
/** @type {number} Distance threshold to consider elevator arrived at floor */
const ARRIVAL_THRESHOLD = 0.01;
/** @type {number} Multiplier for distance-based acceleration scaling */
const ACCELERATION_DISTANCE_FACTOR = 5;
/** @type {number} Safety margin for stopping distance calculation */
const STOPPING_DISTANCE_MARGIN = 1.05;
/** @type {number} Correction factor for deceleration calculations */
const DECELERATION_CORRECTION = 1.1;

/**
 * @typedef {Object} ElevatorState
 * @property {number} index
 * @property {number} position
 * @property {number} currentFloor
 * @property {number | null} destinationFloor
 * @property {number} velocity
 * @property {boolean[]} buttons
 * @property {({passengerId: string, slot: number} | null)[]} passengers
 * @property {boolean} goingUpIndicator
 * @property {boolean} goingDownIndicator
 * @property {number} capacity
 * @property {number} percentFull
 * @property {number} moves
 */

/**
 * Represents an elevator in the simulation with physics-based movement.
 * Manages passenger loading/unloading, floor buttons, and direction indicators.
 */
export class Elevator {
  /**
   * Creates a new elevator instance.
   * @param {number} index - Unique elevator identifier (0-indexed)
   * @param {number} speedFloorsPerSec - Maximum movement speed in floors per second
   * @param {number} floorCount - Total number of floors in the building
   * @param {number} [capacity=4] - Maximum number of passengers
   */
  constructor(index, speedFloorsPerSec, floorCount, capacity = 4) {
    /** @type {number} Maximum speed in floors per second */
    this.MAXSPEED = speedFloorsPerSec;
    /** @type {number} Total number of floors */
    this.MAXFLOOR = floorCount;
    /** @type {number} Unique elevator index */
    this.index = index;
    /** @type {number} Target floor position */
    this.destination = 0;
    /** @type {number} Current velocity in floors per second */
    this.velocity = 0;
    /** @type {number} Current position (can be fractional during movement) */
    this.position = 0;
    /** @type {number} Total number of floor changes commanded */
    this.moves = 0;
    /** @type {boolean[]} Floor button states (true = pressed) */
    this.buttons = Array(floorCount).fill(false);
    /** @type {(import('./Passenger.js').Passenger | null)[]} Passenger slots */
    this.passengers = Array.from({ length: capacity }, () => null);
    /** @type {boolean} Whether elevator accepts passengers going down */
    this.goingDownIndicator = true;
    /** @type {boolean} Whether elevator accepts passengers going up */
    this.goingUpIndicator = true;
    /** @type {number} Pause time remaining before movement (seconds) */
    this.pause = DOOR_PAUSE_TIME;
  }

  /**
   * Maximum passenger capacity.
   * @type {number}
   * @readonly
   */
  get capacity() {
    return this.passengers.length;
  }

  /**
   * Current floor number (integer, rounded down during movement).
   * @type {number}
   * @readonly
   */
  get currentFloor() {
    return Math.floor(this.position);
  }

  /**
   * Target floor if moving, null if stationary.
   * @type {number | null}
   * @readonly
   */
  get destinationFloor() {
    return this.isMoving ? this.destination : null;
  }

  /**
   * Absolute distance to destination in floors.
   * @type {number}
   * @readonly
   */
  get distanceToDestination() {
    return Math.abs(this.destination - this.position);
  }

  /**
   * Movement direction: 1 (up), -1 (down), or 0 (stationary).
   * @type {-1 | 0 | 1}
   * @readonly
   */
  get direction() {
    return /** @type {-1 | 0 | 1} */ (
      Math.sign(this.destination - this.position)
    );
  }

  /**
   * Whether the elevator is currently moving.
   * @type {boolean}
   * @readonly
   */
  get isMoving() {
    return !!this.direction;
  }

  /**
   * Current load as a fraction of capacity (0.0 to 1.0+).
   * Based on passenger weights where 100 = full passenger weight.
   * @type {number}
   * @readonly
   */
  get percentFull() {
    const load = this.passengers.reduce((sum, passenger) => {
      return sum + (passenger ? passenger.weight : 0);
    }, 0);
    return load / (this.capacity * 100);
  }

  /**
   * Whether all passenger slots are occupied.
   * @type {boolean}
   * @readonly
   */
  get isFull() {
    return this.passengers.every(Boolean);
  }

  /**
   * Whether elevator has no passengers.
   * @type {boolean}
   * @readonly
   */
  get isEmpty() {
    return this.passengers.every((u) => !u);
  }

  /**
   * Updates elevator physics for one time step.
   * Handles pause time, position updates, and arrival detection.
   * @param {number} dt - Time delta in seconds
   * @returns {boolean} True if elevator has arrived at destination or is paused
   */
  tick(dt) {
    this.pause = Math.max(0, this.pause - dt);
    if (!this.isMoving || this.pause > 0) {
      return true;
    }

    // Update position
    this.position += this.velocity * dt;

    // Check if arrived
    if (this.distanceToDestination < ARRIVAL_THRESHOLD) {
      this.position = this.destination;
      this.velocity = 0;
      this.buttons[this.currentFloor] = false;
      this.pause = DOOR_PAUSE_TIME;
      return true;
    }

    // Calculate new velocity, clamped to +/- MAXSPEED
    const newVelocity = Math.max(
      -this.MAXSPEED,
      Math.min(this.MAXSPEED, this.calculateVelocity(dt)),
    );
    this.velocity = newVelocity;

    return false;
  }

  /**
   * Calculates target velocity based on physics simulation.
   * Implements acceleration, deceleration, and stopping distance calculations.
   * @param {number} dt - Time delta in seconds
   * @returns {number} New velocity in floors per second
   */
  calculateVelocity(dt) {
    const targetDirection = this.direction;
    const currentDirection = Math.sign(this.velocity);
    const distance = this.distanceToDestination;

    // Starting from rest
    if (this.velocity === 0) {
      const acceleration = Math.min(
        distance * ACCELERATION_DISTANCE_FACTOR,
        ACCELERATION,
      );
      return targetDirection * acceleration * dt;
    }

    // Moving in wrong direction - need to stop first
    if (targetDirection !== currentDirection) {
      const newVelocity = this.velocity - currentDirection * DECELERATION * dt;
      return Math.sign(newVelocity) !== currentDirection ? 0 : newVelocity;
    }

    // Moving in correct direction - decide whether to accelerate or decelerate
    const stoppingDistance =
      (this.velocity * this.velocity) / (2 * DECELERATION);

    if (stoppingDistance * STOPPING_DISTANCE_MARGIN < distance) {
      // Can safely accelerate
      const acceleration = Math.min(
        distance * ACCELERATION_DISTANCE_FACTOR,
        ACCELERATION,
      );
      return this.velocity + targetDirection * acceleration * dt;
    } else {
      // Need to decelerate
      const requiredDecel = (this.velocity * this.velocity) / (2 * distance);
      const deceleration = Math.min(
        DECELERATION * DECELERATION_CORRECTION,
        requiredDecel,
      );
      return this.velocity - targetDirection * deceleration * dt;
    }
  }

  /**
   * Attempts to add a passenger to the elevator.
   * Assigns passenger to a random free slot and presses their destination button.
   * @param {import('./Passenger.js').Passenger} passenger - Passenger to board
   * @returns {number | false} Assigned slot index, or false if elevator is full
   */
  addPassenger(passenger) {
    const freeSlots = this.passengers
      .map((u, i) => (!!u ? -1 : i))
      .filter((i) => i > -1);
    if (freeSlots.length === 0) {
      return false;
    }
    const slotIndex = randomInt(0, freeSlots.length - 1);
    const slot = freeSlots[slotIndex];
    this.passengers[slot] = passenger;
    this.buttons[passenger.destinationFloor] = true;
    passenger.enterElevator(this, slot);
    return slot;
  }

  /**
   * Removes a passenger from the elevator.
   * @param {import('./Passenger.js').Passenger} passenger - Passenger to remove
   * @returns {boolean} True if passenger was found and removed, false otherwise
   */
  removePassenger(passenger) {
    const index = this.passengers.indexOf(passenger);
    if (index === -1) {
      return false;
    }
    passenger.exitElevator();
    this.passengers[index] = null;
    return true;
  }

  /**
   * Commands the elevator to travel to a floor.
   * Floor is clamped to valid range. Increments move counter if destination changes.
   * @param {number} floor - Target floor number (0-indexed)
   * @returns {void}
   */
  goToFloor(floor) {
    floor = Math.max(0, Math.min(floor, this.MAXFLOOR - 1));
    if (this.destination !== floor) {
      this.destination = floor;
      this.moves++;
    }
  }

  /**
   * Sets the direction indicators for passenger boarding.
   * @param {boolean} up - Whether to accept passengers going up
   * @param {boolean} down - Whether to accept passengers going down
   * @returns {void}
   */
  setIndicators(up, down) {
    this.goingUpIndicator = up;
    this.goingDownIndicator = down;
  }

  /**
   * Serializes elevator state for simulation snapshots.
   * @returns {ElevatorState}
   */
  toJSON() {
    return {
      index: this.index,
      position: this.position,
      currentFloor: this.currentFloor,
      destinationFloor: this.destinationFloor,
      velocity: this.velocity,
      buttons: [...this.buttons],
      passengers: this.passengers.map((p, slot) =>
        p
          ? {
              passengerId: p.id,
              slot,
            }
          : null,
      ),
      goingUpIndicator: this.goingUpIndicator,
      goingDownIndicator: this.goingDownIndicator,
      capacity: this.capacity,
      percentFull: this.percentFull,
      moves: this.moves,
    };
  }

  /**
   * Returns player-facing API object for user code interaction.
   * @returns {{
   *   currentFloor: number,
   *   destinationFloor: number | null,
   *   pressedFloorButtons: number[],
   *   percentFull: number,
   *   goingUpIndicator: boolean,
   *   goingDownIndicator: boolean,
   *   goToFloor: (floor: number) => void
   * }}
   */
  toAPI() {
    return {
      currentFloor: this.currentFloor,
      destinationFloor: this.destinationFloor,
      pressedFloorButtons: this.buttons
        .map((pressed, floor) => (pressed ? floor : null))
        .filter((floor) => floor !== null),
      percentFull: this.percentFull,
      goingUpIndicator: this.goingUpIndicator,
      goingDownIndicator: this.goingDownIndicator,
      goToFloor: (floor) => this.goToFloor(floor),
    };
  }
}
