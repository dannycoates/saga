import { Animated } from "./Animated.js";
import { randomInt } from "../../core/utils.js";

const linearInterpolate = function (value0, value1, x) {
  return value0 + (value1 - value0) * x;
};

export class PassengerDisplay extends Animated {
  constructor(passenger, startingY = 0, elevatorDisplays = null) {
    super();

    this.passenger = passenger;
    this.state = "new";
    this.startingY = startingY;
    this.elevatorDisplays = elevatorDisplays; // Reference to world's elevator displays Map
    this.active = true; // prevents the World from deleting passenger until falsy. NullDisplay is always falsy
    if (randomInt(0, 40) === 0) {
      this.displayType = "child";
    } else if (randomInt(0, 1) === 0) {
      this.displayType = "female";
    } else {
      this.displayType = "male";
    }
  }

  appearOnFloor() {
    this.moveTo(105 + randomInt(0, 40), this.startingY);
  }

  animateExit() {
    this.setParent(null);
    const destination = this.x + 100;
    this.moveToOverTime(destination, null, 1, linearInterpolate, () => {
      this.active = false;
      this.dispatchEvent(new CustomEvent("removed"));
    });
  }

  animateBoarding() {
    if (this.elevatorDisplays && this.passenger.elevator) {
      const parent = this.elevatorDisplays.get(this.passenger.elevator);
      if (parent) {
        this.setParent(parent);
        const [x, y] = parent.getPassengerPosition(
          this.passenger.slotInElevator,
        );
        this.moveToOverTime(x, y, 1, linearInterpolate);
      }
    }
  }

  tick(dt) {
    super.tick(dt);
    this.updateDisplayPosition();
    if (this.state !== this.passenger.state) {
      switch (this.passenger.state) {
        case "waiting": {
          this.appearOnFloor();
          break;
        }
        case "riding": {
          this.animateBoarding();
          break;
        }
        case "exited": {
          this.animateExit();
          break;
        }
      }
      this.state = this.passenger.state;
    }
  }
}
