import { Movable } from "./Movable.js";
import {
  limitNumber,
  distanceNeededToAchieveSpeed,
  accelerationNeededToAchieveChangeDistance,
  epsilonEquals,
  randomInt,
} from "./utils.js";

export class Elevator extends Movable {
  constructor(speedFloorsPerSec, floorCount, floorHeight, maxUsers = 4) {
    super();

    this.ACCELERATION = floorHeight * 2.1;
    this.DECELERATION = floorHeight * 2.6;
    this.MAXSPEED = floorHeight * speedFloorsPerSec;
    this.floorCount = floorCount;
    this.floorHeight = floorHeight;
    this.maxUsers = maxUsers;
    this.destinationY = 0.0;
    this.velocityY = 0.0;
    // isMoving flag is needed when going to same floor again - need to re-raise events
    this.isMoving = false;

    this.goingDownIndicator = true;
    this.goingUpIndicator = true;

    this.currentFloor = 0;
    this.previousTruncFutureFloorIfStopped = 0;
    this.buttons = Array(floorCount).fill(false);
    this.moveCount = 0;
    this.removed = false;
    this.userSlots = Array.from({ length: this.maxUsers }, (_, i) => ({
      pos: [2 + i * 10, 30],
      user: null,
    }));
    this.width = this.maxUsers * 10;
    this.destinationY = this.getYPosOfFloor(this.currentFloor);

    // Bind event handlers
    this.addEventListener("new_state", () => this.handleNewState());
  }

  setFloorPosition(floor) {
    const destination = this.getYPosOfFloor(floor);
    this.currentFloor = floor;
    this.previousTruncFutureFloorIfStopped = floor;
    this.moveTo(null, destination);
  }

  userEntering(user) {
    const randomOffset = randomInt(0, this.userSlots.length - 1);
    for (let i = 0; i < this.userSlots.length; i++) {
      const slot = this.userSlots[(i + randomOffset) % this.userSlots.length];
      if (slot.user === null) {
        slot.user = user;
        return slot.pos;
      }
    }
    return false;
  }

  pressFloorButton(floorNumber) {
    floorNumber = limitNumber(floorNumber, 0, this.floorCount - 1);
    const prev = this.buttons[floorNumber];
    this.buttons[floorNumber] = true;
    if (!prev) {
      this.dispatchEvent(new CustomEvent("floor_buttons_changed", { detail: [this.buttons, floorNumber] }));
    }
  }

  userExiting(user) {
    for (let i = 0; i < this.userSlots.length; i++) {
      const slot = this.userSlots[i];
      if (slot.user === user) {
        slot.user = null;
      }
    }
  }

  updateElevatorMovement(dt) {
    if (this.isBusy()) {
      // TODO: Consider if having a nonzero velocity here should throw error..
      return;
    }

    // Make sure we're not speeding
    this.velocityY = limitNumber(this.velocityY, -this.MAXSPEED, this.MAXSPEED);

    // Move elevator
    this.moveTo(null, this.y + this.velocityY * dt);

    const destinationDiff = this.destinationY - this.y;
    const directionSign = Math.sign(destinationDiff);
    const velocitySign = Math.sign(this.velocityY);
    let acceleration = 0.0;

    if (destinationDiff !== 0.0) {
      if (directionSign === velocitySign) {
        // Moving in correct direction
        const distanceNeededToStop = distanceNeededToAchieveSpeed(
          this.velocityY,
          0.0,
          this.DECELERATION,
        );
        if (distanceNeededToStop * 1.05 < -Math.abs(destinationDiff)) {
          // Slow down
          // Allow a certain factor of extra breaking, to enable a smooth breaking movement after detecting overshoot
          const requiredDeceleration =
            accelerationNeededToAchieveChangeDistance(
              this.velocityY,
              0.0,
              destinationDiff,
            );
          const deceleration = Math.min(
            this.DECELERATION * 1.1,
            Math.abs(requiredDeceleration),
          );
          this.velocityY -= directionSign * deceleration * dt;
        } else {
          // Speed up (or keep max speed...)
          acceleration = Math.min(
            Math.abs(destinationDiff * 5),
            this.ACCELERATION,
          );
          this.velocityY += directionSign * acceleration * dt;
        }
      } else if (velocitySign === 0) {
        // Standing still - should accelerate
        acceleration = Math.min(
          Math.abs(destinationDiff * 5),
          this.ACCELERATION,
        );
        this.velocityY += directionSign * acceleration * dt;
      } else {
        // Moving in wrong direction - decelerate as much as possible
        this.velocityY -= velocitySign * this.DECELERATION * dt;
        // Make sure we don't change direction within this time step - let standstill logic handle it
        if (Math.sign(this.velocityY) !== velocitySign) {
          this.velocityY = 0.0;
        }
      }
    }

    if (
      this.isMoving &&
      Math.abs(destinationDiff) < 0.5 &&
      Math.abs(this.velocityY) < 3
    ) {
      // Snap to destination and stop
      this.moveTo(null, this.destinationY);
      this.velocityY = 0.0;
      this.isMoving = false;
      this.handleDestinationArrival();
    }
  }

  handleDestinationArrival() {
    if (this.isOnAFloor()) {
      this.buttons[this.currentFloor] = false;
      this.dispatchEvent(new CustomEvent("floor_buttons_changed", { detail: [this.buttons, this.currentFloor] }));
      // Need to allow users to get off first, so that new ones
      // can enter on the same floor
      this.dispatchEvent(new CustomEvent("exit_available", { detail: [this.currentFloor, this] }));
      this.dispatchEvent(new CustomEvent("entrance_available", { detail: this }));
    }
  }

  goToFloor(floor) {
    this.makeSureNotBusy();
    this.isMoving = true;
    this.destinationY = this.getYPosOfFloor(floor);
  }

  getPressedFloors() {
    const arr = [];
    for (let i = 0; i < this.buttons.length; i++) {
      if (this.buttons[i]) {
        arr.push(i);
      }
    }
    return arr;
  }

  // Interface properties for user code
  get pressedFloorButtons() {
    return this.getPressedFloors();
  }

  get destinationFloor() {
    return this.isMoving ? Math.round(this.getDestinationFloor()) : null;
  }

  get percentFull() {
    return this.getLoadFactor();
  }

  isSuitableForTravelBetween(fromFloorNum, toFloorNum) {
    if (fromFloorNum > toFloorNum) {
      return this.goingDownIndicator;
    }
    if (fromFloorNum < toFloorNum) {
      return this.goingUpIndicator;
    }
    return true;
  }

  getYPosOfFloor(floorNum) {
    return (
      (this.floorCount - 1) * this.floorHeight - floorNum * this.floorHeight
    );
  }

  getExactFloorOfYPos(y) {
    return ((this.floorCount - 1) * this.floorHeight - y) / this.floorHeight;
  }

  getExactCurrentFloor() {
    return this.getExactFloorOfYPos(this.y);
  }

  getDestinationFloor() {
    return this.getExactFloorOfYPos(this.destinationY);
  }

  getRoundedCurrentFloor() {
    return Math.round(this.getExactCurrentFloor());
  }

  getExactFutureFloorIfStopped() {
    const distanceNeededToStop = distanceNeededToAchieveSpeed(
      this.velocityY,
      0.0,
      this.DECELERATION,
    );
    return this.getExactFloorOfYPos(
      this.y - Math.sign(this.velocityY) * distanceNeededToStop,
    );
  }

  isApproachingFloor(floorNum) {
    const floorYPos = this.getYPosOfFloor(floorNum);
    const elevToFloor = floorYPos - this.y;
    return (
      this.velocityY !== 0.0 &&
      Math.sign(this.velocityY) === Math.sign(elevToFloor)
    );
  }

  isOnAFloor() {
    return epsilonEquals(
      this.getExactCurrentFloor(),
      this.getRoundedCurrentFloor(),
    );
  }

  getLoadFactor() {
    const load = this.userSlots.reduce((sum, slot) => {
      return sum + (slot.user ? slot.user.weight : 0);
    }, 0);
    return load / (this.maxUsers * 100);
  }

  isFull() {
    for (let i = 0; i < this.userSlots.length; i++) {
      if (this.userSlots[i].user === null) {
        return false;
      }
    }
    return true;
  }

  isEmpty() {
    for (let i = 0; i < this.userSlots.length; i++) {
      if (this.userSlots[i].user !== null) {
        return false;
      }
    }
    return true;
  }

  handleNewState() {
    // Recalculate the floor number etc
    const currentFloor = this.getRoundedCurrentFloor();
    if (currentFloor !== this.currentFloor) {
      this.moveCount++;
      this.currentFloor = currentFloor;
      this.dispatchEvent(new CustomEvent("new_current_floor", { detail: this.currentFloor }));
    }

    // Check if we are about to pass a floor
    const futureTruncFloorIfStopped = Math.trunc(
      this.getExactFutureFloorIfStopped(),
    );
    if (futureTruncFloorIfStopped !== this.previousTruncFutureFloorIfStopped) {
      // The following is somewhat ugly.
      // A formally correct solution should iterate and generate events for all passed floors,
      // because the elevator could theoretically have such a velocity that it would
      // pass more than one floor over the course of one state change (update).
      // But I can't currently be arsed to implement it because it's overkill.
      const floorBeingPassed = Math.round(this.getExactFutureFloorIfStopped());

      // The passing_floor event was removed as it's not used by the UI
    }
    this.previousTruncFutureFloorIfStopped = futureTruncFloorIfStopped;
  }
}
