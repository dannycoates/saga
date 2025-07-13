import { randomInt, throttle } from "./utils.js";
import { Floor } from "./Floor.js";
import { Elevator } from "./Elevator.js";
import { Passenger } from "./Passenger.js";
import { FloorDisplay } from "../ui/display/FloorDisplay.js";
import { ElevatorDisplay } from "../ui/display/ElevatorDisplay.js";
import { PassengerDisplay } from "../ui/display/PassengerDisplay.js";
import { NullDisplay } from "../ui/display/NullDisplay.js";

export class WorldCreator {
  createFloors(floorCount, displayClass = NullDisplay, floorHeight = 0) {
    const floorMap = new Map();
    for (let i = 0; i < floorCount; i++) {
      const floor = new Floor(i);
      const yPos = (floorCount - 1 - i) * floorHeight;
      const display = new displayClass(floor, yPos);
      floorMap.set(floor, display);
    }
    return floorMap;
  }

  createElevators(
    elevatorCount,
    speedFloorsPerSec,
    floorCount,
    elevatorCapacities = [4],
    displayClass = NullDisplay,
  ) {
    const elevatorMap = new Map();
    let currentX = 200.0;
    for (let i = 0; i < elevatorCount; i++) {
      const elevator = new Elevator(
        i,
        speedFloorsPerSec,
        floorCount,
        elevatorCapacities[i % elevatorCapacities.length],
      );
      const display = new displayClass(elevator, currentX, elevator.capacity);
      currentX += 20 + display.width;
      elevatorMap.set(elevator, display);
    }
    return elevatorMap;
  }

  createRandomPassenger(
    currentFloor,
    destinationFloor,
    displayClass = NullDisplay,
    startingY = 0,
    elevatorDisplays = null,
  ) {
    const weight = randomInt(55, 100);
    const passenger = new Passenger(weight, currentFloor, destinationFloor);
    const display = new displayClass(passenger, startingY, elevatorDisplays);
    return { passenger, display };
  }

  randomStartAndDestination(floorCount) {
    const currentFloor =
      randomInt(0, 1) === 0 ? 0 : randomInt(0, floorCount - 1);
    let destinationFloor;
    if (currentFloor === 0) {
      // Definitely going up
      destinationFloor = randomInt(1, floorCount - 1);
    } else {
      // Usually going down, but sometimes not
      if (randomInt(0, 10) === 0) {
        destinationFloor =
          (currentFloor + randomInt(1, floorCount - 1)) % floorCount;
      } else {
        destinationFloor = 0;
      }
    }
    return { currentFloor, destinationFloor };
  }

  createWorld(options) {
    const defaultOptions = {
      floorHeight: 50,
      floorCount: 4,
      elevatorCount: 2,
      spawnRate: 0.5,
      renderingEnabled: true,
    };
    options = { ...defaultOptions, ...options };

    return new World(options, this);
  }
}

export class World extends EventTarget {
  constructor(options, creator) {
    super();

    this.creator = creator;
    this.floorHeight = options.floorHeight;
    this.transportedCounter = 0;
    this.transportedPerSec = 0.0;
    this.moveCount = 0;
    this.elapsedTime = 0.0;
    this.maxWaitTime = 0.0;
    this.avgWaitTime = 0.0;
    this.challengeEnded = false;
    this.options = options;

    this.elapsedSinceSpawn = 1.001 / options.spawnRate;
    this.elapsedSinceStatsUpdate = 0.0;

    this.handlePassengerCodeError = this.handlePassengerCodeError.bind(this);

    const floorDisplayClass =
      options.renderingEnabled !== false ? FloorDisplay : NullDisplay;
    const elevatorDisplayClass =
      options.renderingEnabled !== false ? ElevatorDisplay : NullDisplay;

    this.floors = creator.createFloors(
      options.floorCount,
      floorDisplayClass,
      this.floorHeight,
    );
    this.elevators = creator.createElevators(
      options.elevatorCount,
      2.6, // speedFloorsPerSec
      options.floorCount,
      options.elevatorCapacities,
      elevatorDisplayClass,
    );
    this.passengers = new Map();

    this.throttledStats = throttle(() => {
      this.recalculateStats();
      this.dispatchEvent(new CustomEvent("stats_display_changed"));
    }, 1000 / 30);
  }

  handlePassengerCodeError(e) {
    this.dispatchEvent(new CustomEvent("usercode_error", { detail: e }));
  }

  recalculateStats() {
    this.transportedPerSec = this.transportedCounter / this.elapsedTime;
    this.moveCount = Array.from(this.elevators.keys()).reduce(
      (sum, elevator) => sum + elevator.moves,
      0,
    );
    this.dispatchEvent(new CustomEvent("stats_changed"));
  }

  spawnPassenger() {
    const { currentFloor, destinationFloor } =
      this.creator.randomStartAndDestination(this.options.floorCount);

    const floors = Array.from(this.floors.keys());
    const startFloor = floors[currentFloor];

    const displayClass =
      this.options.renderingEnabled !== false ? PassengerDisplay : NullDisplay;
    const startingY =
      (this.floors.size - 1 - currentFloor) * this.floorHeight + 30;

    const { passenger, display } = this.creator.createRandomPassenger(
      currentFloor,
      destinationFloor,
      displayClass,
      startingY,
      this.elevators,
    );
    passenger.spawnTimestamp = this.elapsedTime;
    this.passengers.set(passenger, display);

    this.dispatchEvent(new CustomEvent("new_passenger", { detail: display }));
    display.tick();

    if (destinationFloor > currentFloor) {
      startFloor.pressButton("up");
    } else if (destinationFloor < currentFloor) {
      startFloor.pressButton("down");
    }
  }

  handleElevatorArrival(elevator) {
    const currentFloor = elevator.currentFloor;

    // Handle passengers exiting
    elevator.passengers.forEach((passenger) => {
      if (passenger && passenger.shouldExitAt(currentFloor)) {
        elevator.removePassenger(passenger);
        passenger.transportedTimestamp = this.elapsedTime;

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
    const waitingPassengers = Array.from(this.passengers.keys()).filter(
      (p) => p.currentFloor === currentFloor && !p.elevator,
    );

    // Check floor buttons and indicators
    const floorModels = Array.from(this.floors.keys());
    const floor = floorModels[currentFloor];
    const goingUp = floor.buttons.up && elevator.goingUpIndicator;
    const goingDown = floor.buttons.down && elevator.goingDownIndicator;

    waitingPassengers.forEach((passenger) => {
      if (elevator.isFull) return;

      const wantsUp = passenger.destinationFloor > currentFloor;
      const wantsDown = passenger.destinationFloor < currentFloor;

      if ((wantsUp && goingUp) || (wantsDown && goingDown)) {
        elevator.addPassenger(passenger);
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
  }

  removeTransportedPassengers() {
    for (const [passenger, display] of this.passengers) {
      if (!display.active && passenger.state === "exited") {
        this.passengers.delete(passenger);
      }
    }
  }

  tick(dt) {
    this.elapsedTime += dt;
    this.elapsedSinceSpawn += dt;
    this.elapsedSinceStatsUpdate += dt;

    while (this.elapsedSinceSpawn > 1.0 / this.options.spawnRate) {
      this.elapsedSinceSpawn -= 1.0 / this.options.spawnRate;
      this.spawnPassenger();
    }

    this.elevators.forEach((display, elevator) => {
      const doorsOpen = elevator.tick(dt);
      if (doorsOpen) {
        this.handleElevatorArrival(elevator);
      }
      display.tick();
    });

    this.floors.forEach((display) => {
      display.tick(dt);
    });

    this.passengers.forEach((display) => {
      display.tick(dt);
    });

    this.removeTransportedPassengers();

    this.throttledStats();
  }

  unWind() {
    this.challengeEnded = true;
    this.passengers.clear();
    // Don't clear elevators and floors Maps as they're reused
  }
}

export class WorldController extends EventTarget {
  constructor(dtMax = 1 / 60) {
    super();
    this.dtMax = dtMax;
    this.timeScale = 1.0;
    this.isPaused = true;
  }

  start(world, codeObj, animationFrameRequester, autoStart) {
    this.isPaused = true;
    let lastT = null;

    world.addEventListener("usercode_error", (e) =>
      this.handlePassengerCodeError(e.detail),
    );

    const updater = async (t) => {
      if (!this.isPaused && !world.challengeEnded && lastT !== null) {
        const dt = t - lastT;
        let scaledDt = dt * 0.001 * this.timeScale;
        scaledDt = Math.min(scaledDt, this.dtMax * 3 * this.timeScale);

        try {
          const elevatorAPIs = Array.from(world.elevators.keys()).map(
            (model) => ({
              currentFloor: model.currentFloor,
              destinationFloor: model.destinationFloor,
              pressedFloorButtons: model.buttons
                .map((pressed, floor) => (pressed ? floor : null))
                .filter((floor) => floor !== null),
              percentFull: model.percentFull,
              goToFloor: (floor) => model.goToFloor(floor),
            }),
          );

          const floorAPIs = Array.from(world.floors.keys()).map((model) => ({
            buttons: model.buttons,
            level: model.level,
          }));

          await codeObj.tick(elevatorAPIs, floorAPIs);
        } catch (e) {
          this.handlePassengerCodeError(e);
        }

        while (scaledDt > 0.0 && !world.challengeEnded) {
          const thisDt = Math.min(this.dtMax, scaledDt);
          world.tick(thisDt);
          scaledDt -= this.dtMax;
        }
      }
      lastT = t;
      if (!world.challengeEnded) {
        animationFrameRequester(updater);
      }
    };

    if (autoStart) {
      this.setPaused(false);
    }
    animationFrameRequester(updater);
  }

  handlePassengerCodeError(e) {
    this.setPaused(true);
    console.log("Usercode error on update", e);
    this.dispatchEvent(new CustomEvent("usercode_error", { detail: e }));
  }

  setPaused(paused) {
    this.isPaused = paused;
    this.dispatchEvent(new CustomEvent("timescale_changed"));
  }

  setTimeScale(timeScale) {
    this.timeScale = timeScale;
    this.dispatchEvent(new CustomEvent("timescale_changed"));
  }
}
