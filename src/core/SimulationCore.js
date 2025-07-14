import { randomInt, throttle } from "./utils.js";
import { Floor } from "./Floor.js";
import { Elevator } from "./Elevator.js";
import { Passenger } from "./Passenger.js";

export class SimulationCore extends EventTarget {
  constructor(options) {
    super();

    this.floorCount = options.floorCount;
    this.elevatorCount = options.elevatorCount;
    this.elevatorCapacities = options.elevatorCapacities || [4];
    this.spawnRate = options.spawnRate;
    this.speedFloorsPerSec = options.speedFloorsPerSec || 2.6;

    this.transportedCounter = 0;
    this.transportedPerSec = 0.0;
    this.moveCount = 0;
    this.elapsedTime = 0.0;
    this.maxWaitTime = 0.0;
    this.avgWaitTime = 0.0;
    this.challengeEnded = false;

    this.elapsedSinceSpawn = 1.001 / this.spawnRate;
    this.elapsedSinceStatsUpdate = 0.0;

    this.floors = [];
    this.elevators = [];
    this.passengers = [];

    this.initializeSimulation();

    this.throttledStats = throttle(() => {
      this.recalculateStats();
      this.dispatchEvent(new CustomEvent("stats_changed", { detail: this.getStats() }));
    }, 1000 / 30);
  }

  initializeSimulation() {
    // Create floors
    for (let i = 0; i < this.floorCount; i++) {
      this.floors.push(new Floor(i));
    }

    // Create elevators
    for (let i = 0; i < this.elevatorCount; i++) {
      const capacity = this.elevatorCapacities[i % this.elevatorCapacities.length];
      const elevator = new Elevator(i, this.speedFloorsPerSec, this.floorCount, capacity);
      this.elevators.push(elevator);
    }
  }

  spawnPassenger() {
    const { currentFloor, destinationFloor } = this.randomStartAndDestination();
    const weight = randomInt(55, 100);
    const passenger = new Passenger(weight, currentFloor, destinationFloor);
    passenger.spawnTimestamp = this.elapsedTime;
    passenger.id = `passenger_${this.elapsedTime}_${Math.random()}`;
    
    this.passengers.push(passenger);

    // Press floor button
    const startFloor = this.floors[currentFloor];
    if (destinationFloor > currentFloor) {
      startFloor.pressButton("up");
    } else if (destinationFloor < currentFloor) {
      startFloor.pressButton("down");
    }

    this.dispatchEvent(new CustomEvent("passenger_spawned", { 
      detail: { passenger: this.createPassengerSnapshot(passenger) }
    }));
  }

  randomStartAndDestination() {
    const currentFloor = randomInt(0, 1) === 0 ? 0 : randomInt(0, this.floorCount - 1);
    let destinationFloor;
    
    if (currentFloor === 0) {
      // Definitely going up
      destinationFloor = randomInt(1, this.floorCount - 1);
    } else {
      // Usually going down, but sometimes not
      if (randomInt(0, 10) === 0) {
        destinationFloor = (currentFloor + randomInt(1, this.floorCount - 1)) % this.floorCount;
      } else {
        destinationFloor = 0;
      }
    }
    
    return { currentFloor, destinationFloor };
  }

  handleElevatorArrival(elevator) {
    const currentFloor = elevator.currentFloor;

    // Handle passengers exiting
    const exitingPassengers = [];
    elevator.passengers.forEach((passenger, slot) => {
      if (passenger && passenger.shouldExitAt(currentFloor)) {
        elevator.removePassenger(passenger);
        passenger.transportedTimestamp = this.elapsedTime;
        passenger.state = "exited"; // Ensure state is set to exited
        exitingPassengers.push(passenger);

        // Update stats
        this.transportedCounter++;
        const waitTime = this.elapsedTime - passenger.spawnTimestamp;
        this.maxWaitTime = Math.max(this.maxWaitTime, waitTime);
        this.avgWaitTime = 
          (this.avgWaitTime * (this.transportedCounter - 1) + waitTime) / 
          this.transportedCounter;
        this.recalculateStats();
      }
    });

    // Handle passengers boarding
    const waitingPassengers = this.passengers.filter(
      p => p.currentFloor === currentFloor && !p.elevator
    );

    const floor = this.floors[currentFloor];
    const goingUp = floor.buttons.up && elevator.goingUpIndicator;
    const goingDown = floor.buttons.down && elevator.goingDownIndicator;

    const boardingPassengers = [];
    waitingPassengers.forEach(passenger => {
      if (elevator.isFull) return;

      const wantsUp = passenger.destinationFloor > currentFloor;
      const wantsDown = passenger.destinationFloor < currentFloor;

      if ((wantsUp && goingUp) || (wantsDown && goingDown)) {
        elevator.addPassenger(passenger);
        boardingPassengers.push(passenger);
      }
    });

    // Clear floor buttons if no more passengers waiting
    const remainingUp = waitingPassengers.some(
      p => !p.elevator && p.destinationFloor > currentFloor
    );
    const remainingDown = waitingPassengers.some(
      p => !p.elevator && p.destinationFloor < currentFloor
    );

    if (goingUp && !remainingUp) {
      floor.clearButton("up");
    }
    if (goingDown && !remainingDown) {
      floor.clearButton("down");
    }

    // Emit events
    if (exitingPassengers.length > 0) {
      this.dispatchEvent(new CustomEvent("passengers_exited", {
        detail: { passengers: exitingPassengers.map(p => this.createPassengerSnapshot(p)) }
      }));
    }
    if (boardingPassengers.length > 0) {
      this.dispatchEvent(new CustomEvent("passengers_boarded", {
        detail: { passengers: boardingPassengers.map(p => this.createPassengerSnapshot(p)) }
      }));
    }
  }

  cleanupExitedPassengers(dt) {
    // Mark exited passengers with exit timestamp
    this.passengers.forEach(p => {
      if (p.state === "exited" && !p.exitTimestamp) {
        p.exitTimestamp = this.elapsedTime;
      }
    });
    
    // Remove passengers that have been exited for enough time (2 seconds)
    const beforeCount = this.passengers.length;
    this.passengers = this.passengers.filter(p => {
      if (p.state === "exited" && p.exitTimestamp) {
        const timeExited = this.elapsedTime - p.exitTimestamp;
        return timeExited < 2.0; // Keep for 2 seconds to allow animation
      }
      return true; // Keep non-exited passengers
    });
    const afterCount = this.passengers.length;
    if (beforeCount !== afterCount) {
      // Debug: console.log(`[SimulationCore] Removed ${beforeCount - afterCount} exited passengers from simulation after animation delay`);
    }
  }

  tick(dt) {
    if (this.challengeEnded) return;

    this.elapsedTime += dt;
    this.elapsedSinceSpawn += dt;
    this.elapsedSinceStatsUpdate += dt;

    // Spawn passengers
    while (this.elapsedSinceSpawn > 1.0 / this.spawnRate) {
      this.elapsedSinceSpawn -= 1.0 / this.spawnRate;
      this.spawnPassenger();
    }

    // Update elevators
    this.elevators.forEach(elevator => {
      const doorsOpen = elevator.tick(dt);
      if (doorsOpen) {
        this.handleElevatorArrival(elevator);
      }
    });

    // Remove transported passengers (delay to allow exit animations)
    this.cleanupExitedPassengers(dt);

    // Emit state update
    this.dispatchEvent(new CustomEvent("state_changed", { 
      detail: { 
        ...this.getState(),
        dt: dt // Include the scaled dt for animations
      }
    }));

    this.throttledStats();
  }

  recalculateStats() {
    this.transportedPerSec = this.transportedCounter / this.elapsedTime;
    this.moveCount = this.elevators.reduce((sum, elevator) => sum + elevator.moves, 0);
  }

  getStats() {
    return {
      transportedCounter: this.transportedCounter,
      transportedPerSec: this.transportedPerSec,
      avgWaitTime: this.avgWaitTime,
      maxWaitTime: this.maxWaitTime,
      moveCount: this.moveCount,
      elapsedTime: this.elapsedTime
    };
  }

  getState() {
    return {
      floors: this.floors.map(floor => this.createFloorSnapshot(floor)),
      elevators: this.elevators.map(elevator => this.createElevatorSnapshot(elevator)),
      passengers: this.passengers.map(passenger => this.createPassengerSnapshot(passenger)),
      stats: this.getStats(),
      challengeEnded: this.challengeEnded
    };
  }

  createFloorSnapshot(floor) {
    return {
      level: floor.level,
      buttons: { ...floor.buttons }
    };
  }

  createElevatorSnapshot(elevator) {
    return {
      index: elevator.index,
      position: elevator.position,
      currentFloor: elevator.currentFloor,
      destinationFloor: elevator.destinationFloor,
      velocity: elevator.velocity,
      buttons: [...elevator.buttons],
      passengers: elevator.passengers.map((p, slot) => p ? { 
        passengerId: p.id, 
        slot 
      } : null),
      goingUpIndicator: elevator.goingUpIndicator,
      goingDownIndicator: elevator.goingDownIndicator,
      capacity: elevator.capacity,
      percentFull: elevator.percentFull,
      moves: elevator.moves
    };
  }

  createPassengerSnapshot(passenger) {
    return {
      id: passenger.id,
      weight: passenger.weight,
      startingFloor: passenger.startingFloor,
      destinationFloor: passenger.destinationFloor,
      currentFloor: passenger.currentFloor,
      state: passenger.state,
      elevatorIndex: passenger.elevator ? passenger.elevator.index : null,
      slotInElevator: passenger.slotInElevator
    };
  }

  // API for user code execution
  async callUserCode(codeObj) {
    const elevatorAPIs = this.elevators.map(elevator => ({
      currentFloor: elevator.currentFloor,
      destinationFloor: elevator.destinationFloor,
      pressedFloorButtons: elevator.buttons
        .map((pressed, floor) => pressed ? floor : null)
        .filter(floor => floor !== null),
      percentFull: elevator.percentFull,
      goingUpIndicator: elevator.goingUpIndicator,
      goingDownIndicator: elevator.goingDownIndicator,
      goToFloor: (floor) => elevator.goToFloor(floor)
    }));

    const floorAPIs = this.floors.map(floor => ({
      buttons: { ...floor.buttons },
      level: floor.level
    }));

    await codeObj.tick(elevatorAPIs, floorAPIs);
  }

  dispose() {
    this.challengeEnded = true;
    this.passengers = [];
    this.elevators = [];
    this.floors = [];
  }
}