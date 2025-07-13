import { Animated } from "./Animated.js";

export class ElevatorDisplay extends Animated {
  constructor(elevator, xPos, capacity = 4) {
    super();
    this.elevator = elevator;
    this.floorHeight = 50;
    this.width = capacity * 10;
    this.displayedFloorNumber = 0;
    this.capacity = capacity;
    this.moveTo(xPos, this.getDisplayYPos(0));
    this.tick();
  }

  getDisplayYPos(position) {
    return (
      (this.elevator.MAXFLOOR - 1) * this.floorHeight -
      position * this.floorHeight
    );
  }

  getPassengerPosition(slotIndex) {
    return [2 + slotIndex * 10, 30];
  }

  tick(dt) {
    this.moveTo(null, this.getDisplayYPos(this.elevator.position));
    this.updateDisplayPosition();
    const newFloor = this.elevator.currentFloor;
    if (newFloor !== this.displayedFloorNumber) {
      this.displayedFloorNumber = newFloor;
      this.dispatchEvent(
        new CustomEvent("new_current_floor", { detail: newFloor }),
      );
      this.dispatchEvent(
        new CustomEvent("floor_buttons_changed", {
          detail: this.elevator.buttons,
        }),
      );
    }
  }

  get buttons() {
    return this.elevator.buttons;
  }

  get currentFloor() {
    return this.displayedFloorNumber;
  }
}
