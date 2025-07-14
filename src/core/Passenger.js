export class Passenger {
  constructor(weight, startingFloor, destinationFloor) {
    this.weight = weight;
    this.startingFloor = startingFloor;
    this.destinationFloor = destinationFloor;
    this.elevator = null;
    this.slotInElevator = null;
    this.state = "waiting";
    this.id = null; // Will be set by SimulationCore
  }

  enterElevator(elevator, slot) {
    if (this.elevator) {
      return false;
    }
    this.elevator = elevator;
    this.slotInElevator = slot;
    this.state = "riding";
    return true;
  }

  exitElevator() {
    if (!this.elevator) {
      return false;
    }
    this.elevator = null;
    this.state = "exited";
    return true;
  }

  shouldExitAt(floor) {
    return floor === this.destinationFloor;
  }

  get currentFloor() {
    return this.elevator ? this.elevator.currentFloor : this.startingFloor;
  }
}
