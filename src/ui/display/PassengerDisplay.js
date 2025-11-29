import { Animated } from "./Animated.js";
import { randomInt } from "../../utils/common.js";

/**
 * @typedef {import('../../core/Passenger.js').PassengerStateData} PassengerStateData
 */

/**
 * @typedef {'new' | 'waiting' | 'riding' | 'exited'} DisplayState
 */

/**
 * @typedef {'male' | 'female' | 'child'} DisplayType
 */

/**
 * Linear interpolation function for animations.
 * @type {(value0: number, value1: number, x: number) => number}
 */
const LINEAR_INTERPOLATE = function (value0, value1, x) {
  return value0 + (value1 - value0) * x;
};

/**
 * Display representation of a passenger.
 * Handles visual animations for waiting, boarding, and exiting.
 *
 * @extends Animated
 * @fires PassengerDisplay#removed - Emitted when passenger exit animation completes
 */
export class PassengerDisplay extends Animated {
  /**
   * Creates a passenger display.
   * @param {PassengerStateData} passengerState - Initial passenger state
   * @param {number} [startingY=0] - Starting Y position on floor
   * @param {Map<number, import('./ElevatorDisplay.js').ElevatorDisplay> | null} [elevatorDisplays=null] - Map of elevator displays for parenting
   */
  constructor(passengerState, startingY = 0, elevatorDisplays = null) {
    super();

    /** @type {PassengerStateData} Current passenger state from simulation */
    this.passengerState = passengerState;
    /** @type {DisplayState} Current display animation state */
    this.state = "new";
    /** @type {number} Starting Y position on floor */
    this.startingY = startingY;
    /** @type {Map<number, import('./ElevatorDisplay.js').ElevatorDisplay> | null} Reference to elevator displays for parenting */
    this.elevatorDisplays = elevatorDisplays;
    /** @type {boolean} Whether display is still active (false after exit animation completes) */
    this.isActive = true;
    /** @type {DisplayType} Visual display type for rendering */
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

  /**
   * Positions passenger at random location on floor.
   * @returns {void}
   */
  appearOnFloor() {
    this.moveTo(105 + randomInt(0, 40), this.startingY);
  }

  /**
   * Animates passenger walking off screen after exiting elevator.
   * Sets isActive to false and emits 'removed' event when complete.
   * @private
   * @returns {void}
   */
  animateExit() {
    this.setParent(null);
    const destination = this.x + 100;
    this.moveToOverTime(destination, null, 1, LINEAR_INTERPOLATE, () => {
      this.isActive = false;
      this.dispatchEvent(new CustomEvent("removed"));
    });
  }

  /**
   * Animates passenger boarding an elevator.
   * Parents passenger to elevator display and animates to slot position.
   * @private
   * @returns {void}
   */
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

  /**
   * Updates display based on new passenger state.
   * Triggers appropriate animations on state transitions.
   * @param {PassengerStateData} passengerState - New passenger state
   * @returns {void}
   */
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

  /**
   * Updates display each animation frame.
   * Continues running even after passenger removed from simulation
   * to allow exit animations to complete.
   * @override
   * @param {number} dt - Time delta in seconds
   * @returns {void}
   */
  tick(dt) {
    super.tick(dt);
    this.syncUIComponent();
  }
}
