import { Animated } from "./Animated.js";

export class ElevatorDisplay extends Animated {
  constructor(elevatorState, xPos, capacity = 4) {
    super();
    this.state = elevatorState;
    this.floorHeight = 50;
    this.width = capacity * 10;
    this.displayedFloorNumber = 0;
    this.capacity = capacity;
    this.maxFloor = 0; // Will be set when updating state
    this.moveTo(xPos, this.getDisplayYPos(0));
    this.updateFromState(elevatorState);
    // Trigger initial position update for UI
    this.updateDisplayPosition(true);
  }

  getDisplayYPos(position) {
    return (this.maxFloor - 1) * this.floorHeight - position * this.floorHeight;
  }

  getPassengerPosition(slotIndex) {
    return [2 + slotIndex * 10, 30];
  }

  updateFromState(elevatorState) {
    this.state = elevatorState;

    // Update max floor if needed
    if (elevatorState.buttons) {
      this.maxFloor = elevatorState.buttons.length;
    }

    // Update position
    this.moveTo(null, this.getDisplayYPos(elevatorState.position));
    this.updateDisplayPosition();

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

  tick(dt) {
    // Update display position to trigger UI updates
    this.updateDisplayPosition();
  }

  get buttons() {
    return this.state ? this.state.buttons : [];
  }

  get currentFloor() {
    return this.displayedFloorNumber;
  }

  get elevator() {
    // Compatibility getter
    return this.state;
  }
}
