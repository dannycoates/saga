import { Observable, limitNumber, epsilonEquals, createBoolPassthroughFunction } from './utils.js';

// Interface that hides actual elevator object behind a more robust facade,
// while also exposing relevant events, and providing some helper queue
// functions that allow programming without async logic.
export class ElevatorInterface extends Observable {
  constructor(elevator, floorCount, errorHandler) {
    super();
    
    this.elevator = elevator;
    this.floorCount = floorCount;
    this.errorHandler = errorHandler;
    this.destinationQueue = [];

    // Set up passthrough functions
    this.setUpLight = createBoolPassthroughFunction(this, elevator, "goingUpIndicator");
    this.setDownLight = createBoolPassthroughFunction(this, elevator, "goingDownIndicator");

    // Set up event forwarding
    this.setupEventForwarding();
  }

  tryTrigger(event, arg1, arg2, arg3, arg4) {
    try {
      this.trigger(event, arg1, arg2, arg3, arg4);
    } catch (e) {
      this.errorHandler(e);
    }
  }

  checkDestinationQueue() {
    if (!this.elevator.isBusy()) {
      if (this.destinationQueue.length) {
        this.elevator.goToFloor(this.destinationQueue[0]);
      } else {
        this.tryTrigger("idle");
      }
    }
  }

  // TODO: Write tests for this queueing logic
  goToFloor(floorNum) {
    floorNum = limitNumber(Number(floorNum), 0, this.floorCount - 1);
    // Auto-prevent immediately duplicate destinations
    if (this.destinationQueue.length) {
      const adjacentElement = this.destinationQueue[0];
      if (epsilonEquals(floorNum, adjacentElement)) {
        return;
      }
    }
    this.destinationQueue.unshift(floorNum);
    this.checkDestinationQueue();
  }

  stop() {
    this.destinationQueue = [];
    if (!this.elevator.isBusy()) {
      this.elevator.goToFloor(this.elevator.getExactFutureFloorIfStopped());
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
    return this.destinationQueue[0] ?? null;
  }

  get percentFull() {
    return this.elevator.getLoadFactor();
  }

  setupEventForwarding() {
    const self = this;
    
    this.elevator.on("stopped", function(position) {
      if (self.destinationQueue.length && epsilonEquals(self.destinationQueue[0], position)) {
        // Reached the destination, so remove element at front of queue
        self.destinationQueue = self.destinationQueue.slice(1);
        if (self.elevator.isOnAFloor()) {
          self.elevator.wait(1, function() {
            self.checkDestinationQueue();
          });
        } else {
          self.checkDestinationQueue();
        }
      }
    });

    this.elevator.on("passing_floor", function(floorNum, direction) {
      self.tryTrigger("passing_floor", floorNum, direction);
    });

    this.elevator.on("stopped_at_floor", function(floorNum) {
      self.tryTrigger("stopped_at_floor", floorNum);
    });

    this.elevator.on("floor_button_pressed", function(floorNum) {
      self.tryTrigger("floor_button_pressed", floorNum);
    });
  }
}

// Factory function for backward compatibility
export function asElevatorInterface(obj, elevator, floorCount, errorHandler) {
  const elevatorInterface = new ElevatorInterface(elevator, floorCount, errorHandler);
  // Copy any existing properties from obj to elevatorInterface if needed
  Object.assign(elevatorInterface, obj);
  return elevatorInterface;
}

// Floor interface could be added here if needed
export class FloorInterface extends Observable {
  constructor(floor, errorHandler) {
    super();
    this.floor = floor;
    this.errorHandler = errorHandler;
  }

  // Add floor interface methods here if needed
}