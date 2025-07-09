import { Movable } from "./Movable.js";

// Simple linear interpolate function
const linearInterpolate = function (value0, value1, x) {
  return value0 + (value1 - value0) * x;
};

export class User extends Movable {
  constructor(weight) {
    super();

    this.weight = weight;
    this.currentFloor = 0;
    this.destinationFloor = 0;
    this.done = false;
    this.removeMe = false;
    this.exitAvailableHandler = null;
  }

  appearOnFloor(floor, destinationFloorNum) {
    const floorPosY = floor.getSpawnPosY();
    this.currentFloor = floor.level;
    this.destinationFloor = destinationFloorNum;
    this.moveTo(null, floorPosY);
    this.pressFloorButton(floor);
  }

  pressFloorButton(floor) {
    if (this.destinationFloor < this.currentFloor) {
      floor.pressDownButton();
    } else {
      floor.pressUpButton();
    }
  }

  handleExit(elevator) {
    if (elevator.currentFloor === this.destinationFloor) {
      elevator.userExiting(this);
      this.currentFloor = elevator.currentFloor;
      this.setParent(null);
      const destination = this.x + 100;
      this.done = true;
      this.dispatchEvent(
        new CustomEvent("exited_elevator", { detail: elevator }),
      );
      this.dispatchEvent(new CustomEvent("new_state"));
      this.dispatchEvent(new CustomEvent("new_display_state"));
      const self = this;
      this.moveToOverTime(
        destination,
        null,
        1 + Math.random() * 0.5,
        linearInterpolate,
        function lastMove() {
          self.removeMe = true;
          self.dispatchEvent(new CustomEvent("removed"));
          // Note: EventTarget doesn't have a built-in way to remove all listeners
        },
      );

      elevator.removeEventListener("exit_available", this.exitAvailableHandler);
    }
  }

  elevatorAvailable(elevator, floor) {
    if (this.done || this.parent !== null || this.isBusy()) {
      return;
    }

    if (
      !elevator.isSuitableForTravelBetween(
        this.currentFloor,
        this.destinationFloor,
      )
    ) {
      // Not suitable for travel - don't use this elevator
      return;
    }

    const pos = elevator.userEntering(this);
    if (pos) {
      // Success
      this.setParent(elevator);
      this.moveToOverTime(pos[0], pos[1], 1, undefined, () => {
        elevator.pressFloorButton(this.destinationFloor);
      });
      this.exitAvailableHandler = (event) => {
        this.handleExit(event.detail);
      };
      elevator.addEventListener("exit_available", this.exitAvailableHandler);
    } else {
      this.pressFloorButton(floor);
    }
  }
}
