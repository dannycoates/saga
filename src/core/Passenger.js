export class Passenger {
  constructor(id, weight, startingFloor, destinationFloor, now) {
    this.weight = weight;
    this.startingFloor = startingFloor;
    this.destinationFloor = destinationFloor;
    this.elevator = null;
    this.slotInElevator = null;
    this.state = "waiting";
    this.id = id;
    this.spawnTimestamp = now;
    this.transportedTimestamp = null;
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

  toJSON() {
    return {
      id: this.id,
      weight: this.weight,
      startingFloor: this.startingFloor,
      destinationFloor: this.destinationFloor,
      currentFloor: this.currentFloor,
      state: this.state,
      elevatorIndex: this.elevator ? this.elevator.index : null,
      slotInElevator: this.slotInElevator,
    };
  }
}
