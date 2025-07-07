import { limitNumber } from './utils.js';

// Interface that hides actual elevator object behind a more robust facade
export class ElevatorInterface {
  constructor(elevator, floorCount, errorHandler) {
    this.elevator = elevator;
    this.floorCount = floorCount;
    this.errorHandler = errorHandler;
  }

  // Simple goToFloor that directly calls elevator's goToFloor
  goToFloor(floorNum) {
    floorNum = limitNumber(Number(floorNum), 0, this.floorCount - 1);
    try {
      this.elevator.goToFloor(floorNum);
    } catch (e) {
      this.errorHandler(e);
    }
  }

  // Getters for properties
  get currentFloor() {
    return this.elevator.currentFloor;
  }

  get pressedFloorButtons() {
    return this.elevator.getPressedFloors();
  }

  get destinationFloor() {
    // Return the actual destination from the elevator
    return this.elevator.isMoving ? Math.round(this.elevator.getDestinationFloor()) : null;
  }

  get percentFull() {
    return this.elevator.getLoadFactor();
  }

}

// Factory function for backward compatibility
export function asElevatorInterface(obj, elevator, floorCount, errorHandler) {
  const elevatorInterface = new ElevatorInterface(elevator, floorCount, errorHandler);
  // Copy any existing properties from obj to elevatorInterface if needed
  Object.assign(elevatorInterface, obj);
  return elevatorInterface;
}

