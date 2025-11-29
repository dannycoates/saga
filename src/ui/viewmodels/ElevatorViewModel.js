import { AnimatedViewModel } from "./AnimatedViewModel.js";

/**
 * @typedef {Object} ElevatorState
 * @property {number} index - Elevator index
 * @property {number} position - Current position (fractional floor)
 * @property {number} currentFloor - Current floor (integer)
 * @property {number | null} destinationFloor - Target floor or null
 * @property {number} velocity - Current velocity
 * @property {boolean[]} buttons - Floor button states
 * @property {Array<{passengerId: string, slot: number} | null>} passengers - Passenger slots
 * @property {boolean} goingUpIndicator - Up indicator state
 * @property {boolean} goingDownIndicator - Down indicator state
 * @property {number} capacity - Maximum passengers
 * @property {number} percentFull - Load percentage (0-1)
 * @property {number} moves - Total move commands
 */

/**
 * View model for an elevator.
 * Tracks position and emits events for UI updates.
 *
 * @extends AnimatedViewModel
 * @fires ElevatorViewModel#new_current_floor - Emitted when elevator reaches a new floor
 * @fires ElevatorViewModel#floor_buttons_changed - Emitted when floor buttons change
 */
export class ElevatorViewModel extends AnimatedViewModel {
  /**
   * Creates an elevator display.
   * @param {ElevatorState} elevatorState - Initial elevator state
   * @param {number} xPosition - X position in pixels
   * @param {number} [capacity=4] - Elevator capacity (affects width)
   */
  constructor(elevatorState, xPosition, capacity = 4) {
    super();
    /** @type {ElevatorState} Current elevator state */
    this.state = elevatorState;
    /** @type {number} Height of each floor in pixels */
    this.floorHeight = 50;
    /** @type {number} Display width based on capacity */
    this.width = capacity * 10;
    /** @type {number} Last displayed floor number */
    this.displayedFloorNumber = 0;
    /** @type {number} Elevator capacity */
    this.capacity = capacity;
    /** @type {number} Maximum floor number (set from button array length) */
    this.maxFloor = 0;
    this.moveTo(xPosition, this.getDisplayYPos(0));
    this.updateFromState(elevatorState);
    // Trigger initial position update for UI
    this.syncUIComponent(true);
  }

  /**
   * Converts floor position to Y coordinate.
   * @param {number} position - Floor position (can be fractional)
   * @returns {number} Y position in pixels
   */
  getDisplayYPos(position) {
    return (this.maxFloor - 1) * this.floorHeight - position * this.floorHeight;
  }

  /**
   * Gets the position for a passenger at a given slot.
   * @param {number} slotIndex - Passenger slot index
   * @returns {[number, number]} [x, y] position relative to elevator
   */
  getPassengerPosition(slotIndex) {
    return [2 + slotIndex * 10, 30];
  }

  /**
   * Updates display from new elevator state.
   * Emits events when floor or buttons change.
   * @param {ElevatorState} elevatorState - New state
   * @returns {void}
   */
  updateFromState(elevatorState) {
    this.state = elevatorState;

    // Update max floor if needed
    if (elevatorState.buttons) {
      this.maxFloor = elevatorState.buttons.length;
    }

    // Update position
    this.moveTo(null, this.getDisplayYPos(elevatorState.position));
    this.syncUIComponent();

    // Check for floor changes
    const newFloor = elevatorState.currentFloor;
    if (newFloor !== this.displayedFloorNumber) {
      this.displayedFloorNumber = newFloor;
      this.dispatchEvent(
        new CustomEvent("new_current_floor", { detail: newFloor }),
      );
      this.dispatchEvent(
        new CustomEvent("floor_buttons_changed", {
          detail: elevatorState.buttons,
        }),
      );
    }
  }

  /**
   * Updates display each animation frame.
   * @override
   * @param {number} dt - Time delta in seconds
   * @returns {void}
   */
  tick(dt) {
    // Update display position to trigger UI updates
    this.syncUIComponent();
  }

  /**
   * Current floor button states.
   * @type {boolean[]}
   * @readonly
   */
  get buttons() {
    return this.state ? this.state.buttons : [];
  }

  /**
   * Current displayed floor number.
   * @type {number}
   * @readonly
   */
  get currentFloor() {
    return this.displayedFloorNumber;
  }

  /**
   * Current elevator state (compatibility getter).
   * @type {ElevatorState}
   * @readonly
   */
  get elevator() {
    return this.state;
  }
}
