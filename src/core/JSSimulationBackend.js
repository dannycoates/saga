import { SimulationBackend } from "./SimulationBackend.js";
import { randomInt, throttle } from "./utils.js";
import { Floor } from "./Floor.js";
import { Elevator } from "./Elevator.js";
import { Passenger } from "./Passenger.js";

/**
 * JavaScript implementation of the simulation backend
 */
export class JSSimulationBackend extends SimulationBackend {
  constructor() {
    super();

    // Configuration
    this.floorCount = 0;
    this.elevatorCount = 0;
    this.elevatorCapacities = [];
    this.spawnRate = 0;
    this.speedFloorsPerSec = 2.6;

    // Stats
    this.transportedCounter = 0;
    this.transportedPerSec = 0.0;
    this.moveCount = 0;
    this.elapsedTime = 0.0;
    this.maxWaitTime = 0.0;
    this.avgWaitTime = 0.0;
    this.challengeEnded = false;

    // Internal state
    this.elapsedSinceSpawn = 0;

    // Simulation entities
    this.floors = [];
    this.elevators = [];
    this.passengers = [];

    // Throttled stats update
    this.throttledStats = throttle(() => {
      if (this.challengeEnded) {
        return;
      }
      this.recalculateStats();
      this.dispatchEvent(
        new CustomEvent("stats_changed", { detail: this.getStats() }),
      );
    }, 1000 / 30);
  }

  initialize(config) {
    this.floorCount = config.floorCount;
    this.elevatorCount = config.elevatorCount;
    this.elevatorCapacities = config.elevatorCapacities || [4];
    this.spawnRate = config.spawnRate;
    this.speedFloorsPerSec = config.speedFloorsPerSec || 2.6;
    this.endCondition = config.endCondition;

    // Reset state
    this.transportedCounter = 0;
    this.transportedPerSec = 0.0;
    this.moveCount = 0;
    this.elapsedTime = 0.0;
    this.maxWaitTime = 0.0;
    this.avgWaitTime = 0.0;
    this.challengeEnded = false;

    this.elapsedSinceSpawn = 1.001 / this.spawnRate;

    this.passengers = [];
    this.floors = Array.from(
      { length: this.floorCount },
      (_, i) => new Floor(i),
    );
    this.elevators = Array.from({ length: this.elevatorCount }, (_, i) => {
      const capacity =
        this.elevatorCapacities[i % this.elevatorCapacities.length];
      const elevator = new Elevator(
        i,
        this.speedFloorsPerSec,
        this.floorCount,
        capacity,
      );
      return elevator;
    });
  }

  spawnPassenger() {
    const { currentFloor, destinationFloor } = this.randomStartAndDestination();
    const weight = randomInt(55, 100);
    const passenger = new Passenger(
      `passenger_${this.elapsedTime}_${Math.random()}`,
      weight,
      currentFloor,
      destinationFloor,
      this.elapsedTime,
    );
    this.passengers.push(passenger);

    // Press floor button
    const startFloor = this.floors[currentFloor];
    if (destinationFloor > currentFloor) {
      startFloor.pressButton("up");
    } else if (destinationFloor < currentFloor) {
      startFloor.pressButton("down");
    }

    this.dispatchEvent(
      new CustomEvent("passenger_spawned", {
        detail: { passenger: passenger.toJSON() },
      }),
    );
  }

  randomStartAndDestination() {
    const currentFloor =
      randomInt(0, 1) === 0 ? 0 : randomInt(0, this.floorCount - 1);
    let destinationFloor;

    if (currentFloor === 0) {
      // Definitely going up
      destinationFloor = randomInt(1, this.floorCount - 1);
    } else {
      // Usually going down, but sometimes not
      if (randomInt(0, 10) === 0) {
        destinationFloor =
          (currentFloor + randomInt(1, this.floorCount - 1)) % this.floorCount;
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
    elevator.passengers.forEach((passenger) => {
      if (passenger && passenger.shouldExitAt(currentFloor)) {
        elevator.removePassenger(passenger);
        passenger.transportedTimestamp = this.elapsedTime;
        exitingPassengers.push(passenger);

        // Update stats
        this.transportedCounter++;
        const waitTime = this.elapsedTime - passenger.spawnTimestamp;
        this.maxWaitTime = Math.max(this.maxWaitTime, waitTime);
        this.avgWaitTime =
          (this.avgWaitTime * (this.transportedCounter - 1) + waitTime) /
          this.transportedCounter;
      }
    });

    // Handle passengers boarding
    const waitingPassengers = this.passengers.filter(
      (p) => p.currentFloor === currentFloor && !p.elevator,
    );

    const floor = this.floors[currentFloor];
    const goingUp = floor.buttons.up && elevator.goingUpIndicator;
    const goingDown = floor.buttons.down && elevator.goingDownIndicator;

    const boardingPassengers = [];
    waitingPassengers.forEach((passenger) => {
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
      (p) => !p.elevator && p.destinationFloor > currentFloor,
    );
    const remainingDown = waitingPassengers.some(
      (p) => !p.elevator && p.destinationFloor < currentFloor,
    );

    if (goingUp && !remainingUp) {
      floor.clearButton("up");
    }
    if (goingDown && !remainingDown) {
      floor.clearButton("down");
    }

    // Emit events
    if (exitingPassengers.length > 0) {
      this.dispatchEvent(
        new CustomEvent("passengers_exited", {
          detail: {
            passengers: exitingPassengers.map((p) => p.toJSON()),
          },
        }),
      );
    }
    if (boardingPassengers.length > 0) {
      this.dispatchEvent(
        new CustomEvent("passengers_boarded", {
          detail: {
            passengers: boardingPassengers.map((p) => p.toJSON()),
          },
        }),
      );
    }

    this.recalculateStats();
  }

  tick(dt) {
    if (this.challengeEnded) return;

    this.elapsedTime += dt;
    this.elapsedSinceSpawn += dt;

    // Spawn passengers
    while (this.elapsedSinceSpawn > 1.0 / this.spawnRate) {
      this.elapsedSinceSpawn -= 1.0 / this.spawnRate;
      this.spawnPassenger();
    }

    // Update elevators
    this.elevators.forEach((elevator) => {
      const doorsOpen = elevator.tick(dt);
      if (doorsOpen) {
        this.handleElevatorArrival(elevator);
      }
    });

    // Remove transported passengers
    this.passengers = this.passengers.filter((p) => p.state !== "exited");

    // Emit state update
    this.dispatchEvent(
      new CustomEvent("state_changed", {
        detail: {
          ...this.getState(),
          dt: dt,
        },
      }),
    );

    const succeeded = this.endCondition.evaluate(this.getStats());
    if (succeeded !== null) {
      this.challengeEnded = true;
      this.dispatchEvent(
        new CustomEvent("challenge_ended", { detail: succeeded }),
      );
    } else {
      this.throttledStats();
    }
  }

  recalculateStats() {
    this.transportedPerSec = this.transportedCounter / this.elapsedTime;
    this.moveCount = this.elevators.reduce(
      (sum, elevator) => sum + elevator.moves,
      0,
    );
  }

  getStats() {
    return {
      transportedCounter: this.transportedCounter,
      transportedPerSec: this.transportedPerSec,
      avgWaitTime: this.avgWaitTime,
      maxWaitTime: this.maxWaitTime,
      moveCount: this.moveCount,
      elapsedTime: this.elapsedTime,
    };
  }

  getState() {
    return {
      floors: this.floors.map((floor) => floor.toJSON()),
      elevators: this.elevators.map((elevator) => elevator.toJSON()),
      passengers: this.passengers.map((passenger) => passenger.toJSON()),
      stats: this.getStats(),
      challengeEnded: this.challengeEnded,
    };
  }

  async callUserCode(codeObj, dt) {
    if (this.challengeEnded) return;
    const elevatorAPIs = this.elevators.map((elevator) => elevator.toAPI());
    const floorAPIs = this.floors.map((floor) => floor.toJSON());
    await codeObj.tick(elevatorAPIs, floorAPIs, dt);
  }

  dispose() {
    this.challengeEnded = true;
    this.passengers = [];
    this.elevators = [];
    this.floors = [];
  }
}
