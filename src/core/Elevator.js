import { randomInt } from "./utils.js";

const ACCELERATION = 1.1;
const DECELERATION = 1.6;

export class Elevator {
  constructor(index, speedFloorsPerSec, floorCount, capacity = 4) {
    this.MAXSPEED = speedFloorsPerSec;
    this.MAXFLOOR = floorCount;
    this.index = index;
    this.destination = 0;
    this.velocity = 0;
    this.position = 0;
    this.moves = 0;
    this.buttons = Array(floorCount).fill(false);
    this.passengers = Array.from({ length: capacity }, () => null);
    this.goingDownIndicator = true;
    this.goingUpIndicator = true;
    this.pause = 1.2;
  }

  get capacity() {
    return this.passengers.length;
  }

  get currentFloor() {
    return Math.floor(this.position);
  }

  get destinationFloor() {
    return this.isMoving ? this.destination : null;
  }

  get distanceToDestination() {
    return Math.abs(this.destination - this.position);
  }

  get direction() {
    return Math.sign(this.destination - this.position);
  }

  get isMoving() {
    return !!this.direction;
  }

  get percentFull() {
    const load = this.passengers.reduce((sum, passenger) => {
      return sum + (passenger ? passenger.weight : 0);
    }, 0);
    return load / (this.capacity * 100);
  }

  get isFull() {
    return this.passengers.every(Boolean);
  }

  get isEmpty() {
    return this.passengers.every((u) => !u);
  }

  tick(dt) {
    this.pause = Math.max(0, this.pause - dt);
    if (!this.isMoving || this.pause > 0) {
      return true;
    }

    // Update position
    this.position += this.velocity * dt;

    // Check if arrived
    if (this.distanceToDestination < 0.01) {
      this.position = this.destination;
      this.velocity = 0;
      this.buttons[this.currentFloor] = false;
      this.pause = 1.2;
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

  calculateVelocity(dt) {
    const targetDirection = this.direction;
    const currentDirection = Math.sign(this.velocity);
    const distance = this.distanceToDestination;

    // Starting from rest
    if (this.velocity === 0) {
      const acceleration = Math.min(distance * 5, ACCELERATION);
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

    if (stoppingDistance * 1.05 < distance) {
      // Can safely accelerate
      const acceleration = Math.min(distance * 5, ACCELERATION);
      return this.velocity + targetDirection * acceleration * dt;
    } else {
      // Need to decelerate
      const requiredDecel = (this.velocity * this.velocity) / (2 * distance);
      const deceleration = Math.min(DECELERATION * 1.1, requiredDecel);
      return this.velocity - targetDirection * deceleration * dt;
    }
  }

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

  removePassenger(passenger) {
    passenger.exitElevator();
    this.passengers[this.passengers.indexOf(passenger)] = null;
  }

  goToFloor(floor) {
    floor = Math.max(0, Math.min(floor, this.MAXFLOOR - 1));
    if (this.destination !== floor) {
      this.destination = floor;
      this.moves++;
    }
  }

  setIndicators(up, down) {
    this.goingUpIndicator = up;
    this.goingDownIndicator = down;
  }

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
