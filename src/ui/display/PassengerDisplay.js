import { Animated } from "./Animated.js";
import { randomInt } from "../../core/utils.js";

const LINEAR_INTERPOLATE = function (value0, value1, x) {
  return value0 + (value1 - value0) * x;
};

export class PassengerDisplay extends Animated {
  constructor(passengerState, startingY = 0, elevatorDisplays = null) {
    super();

    this.passengerState = passengerState;
    this.state = "new";
    this.startingY = startingY;
    this.elevatorDisplays = elevatorDisplays; // Reference to world's elevator displays Map
    this.isActive = true; // prevents the World from deleting passenger until falsy. NullDisplay is always falsy
    if (randomInt(0, 40) === 0) {
      this.displayType = "child";
    } else if (randomInt(0, 1) === 0) {
      this.displayType = "female";
    } else {
      this.displayType = "male";
    }
    // Set initial position
    this.appearOnFloor();
    this.syncUIComponent(true);
    // Process initial state
    this.updateFromState(passengerState);
  }

  appearOnFloor() {
    this.moveTo(105 + randomInt(0, 40), this.startingY);
  }

  animateExit() {
    this.setParent(null);
    const destination = this.x + 100;
    this.moveToOverTime(destination, null, 1, LINEAR_INTERPOLATE, () => {
      this.isActive = false;
      this.dispatchEvent(new CustomEvent("removed"));
    });
  }

  animateBoarding() {
    if (this.elevatorDisplays && this.passengerState.elevatorIndex !== null) {
      const parent = this.elevatorDisplays.get(
        this.passengerState.elevatorIndex,
      );
      if (parent) {
        this.setParent(parent);
        const [x, y] = parent.getPassengerPosition(
          this.passengerState.slotInElevator,
        );
        this.moveToOverTime(x, y, 1, LINEAR_INTERPOLATE);
      }
    }
  }

  updateFromState(passengerState) {
    this.passengerState = passengerState;

    if (this.state !== passengerState.state) {
      switch (passengerState.state) {
        case "waiting": {
          if (this.state === "new") {
            // Already positioned in constructor
            this.state = "waiting";
          }
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
      this.state = passengerState.state;
    }
  }

  // We need this so we can do the exit animation
  // after the passenger has already been removed
  // from simulation state
  tick(dt) {
    super.tick(dt);
    this.syncUIComponent();
  }
}
