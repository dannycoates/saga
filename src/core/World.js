import { randomInt, throttle } from "./utils.js";
import { Floor } from "./Floor.js";
import { Elevator } from "./Elevator.js";
import { User } from "./User.js";

export class WorldCreator {
  createFloors(floorCount, floorHeight) {
    const floors = Array.from({ length: floorCount }, (_, i) => {
      const yPos = (floorCount - 1 - i) * floorHeight;
      return new Floor(i, yPos);
    });
    return floors;
  }

  createElevators(
    elevatorCount,
    floorCount,
    floorHeight,
    elevatorCapacities = [4],
  ) {
    let currentX = 200.0;
    const elevators = Array.from({ length: elevatorCount }, (_, i) => {
      const elevator = new Elevator(
        2.6,
        floorCount,
        floorHeight,
        elevatorCapacities[i % elevatorCapacities.length],
      );

      // Move to right x position
      elevator.moveTo(currentX, null);
      elevator.setFloorPosition(0);
      elevator.updateDisplayPosition();
      currentX += 20 + elevator.width;
      return elevator;
    });
    return elevators;
  }

  createRandomUser() {
    const weight = randomInt(55, 100);
    const user = new User(weight);
    if (randomInt(0, 40) === 0) {
      user.displayType = "child";
    } else if (randomInt(0, 1) === 0) {
      user.displayType = "female";
    } else {
      user.displayType = "male";
    }
    return user;
  }

  spawnUserRandomly(floorCount, floorHeight, floors) {
    const user = this.createRandomUser();
    user.moveTo(105 + randomInt(0, 40), 0);
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
    user.appearOnFloor(floors[currentFloor], destinationFloor);
    return user;
  }

  createWorld(options) {
    const defaultOptions = {
      floorHeight: 50,
      floorCount: 4,
      elevatorCount: 2,
      spawnRate: 0.5,
    };
    options = { ...defaultOptions, ...options };

    const world = new World(options, this);
    return world;
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

    this.handleUserCodeError = this.handleUserCodeError.bind(this);

    this.floors = creator.createFloors(options.floorCount, this.floorHeight);
    this.elevators = creator.createElevators(
      options.elevatorCount,
      options.floorCount,
      this.floorHeight,
      options.elevatorCapacities,
    );

    this.users = [];
    this.userEventHandlers = new WeakMap();
    this.handleElevAvailability = this.handleElevAvailability.bind(this);
    this.setupEventHandlers();
    this.throttledStats = throttle(() => {
      this.recalculateStats();
      this.dispatchEvent(new CustomEvent("stats_display_changed"));
    }, 1000);
  }

  handleUserCodeError(e) {
    this.dispatchEvent(new CustomEvent("usercode_error", { detail: e }));
  }

  recalculateStats() {
    this.transportedPerSec = this.transportedCounter / this.elapsedTime;
    this.moveCount = this.elevators.reduce(
      (sum, elevator) => sum + elevator.moveCount,
      0,
    );
    this.dispatchEvent(new CustomEvent("stats_changed"));
  }

  registerUser(user) {
    this.users.push(user);
    user.updateDisplayPosition(true);
    user.spawnTimestamp = this.elapsedTime;
    this.dispatchEvent(new CustomEvent("new_user", { detail: user }));

    const exitedElevatorHandler = () => {
      this.transportedCounter++;
      this.maxWaitTime = Math.max(
        this.maxWaitTime,
        this.elapsedTime - user.spawnTimestamp,
      );
      this.avgWaitTime =
        (this.avgWaitTime * (this.transportedCounter - 1) +
          (this.elapsedTime - user.spawnTimestamp)) /
        this.transportedCounter;
      this.recalculateStats();
    };

    user.addEventListener("exited_elevator", exitedElevatorHandler);
    this.userEventHandlers.set(user, { exitedElevator: exitedElevatorHandler });

    user.updateDisplayPosition(true);
  }

  handleElevAvailability(event) {
    const elevator = event.detail;
    // Notify floors first because overflowing users
    // will press buttons again.
    this.floors
      .filter((_, i) => elevator.currentFloor === i)
      .forEach((floor) => floor.elevatorAvailable(elevator));

    this.users
      .filter((user) => user.currentFloor === elevator.currentFloor)
      .forEach((user) =>
        user.elevatorAvailable(elevator, this.floors[elevator.currentFloor]),
      );
  }

  setupEventHandlers() {
    // Bind elevators to handle availability
    this.elevators.forEach((elevator) => {
      elevator.addEventListener(
        "entrance_available",
        this.handleElevAvailability,
      );
    });
  }

  tick(dt) {
    this.elapsedTime += dt;
    this.elapsedSinceSpawn += dt;
    this.elapsedSinceStatsUpdate += dt;

    while (this.elapsedSinceSpawn > 1.0 / this.options.spawnRate) {
      this.elapsedSinceSpawn -= 1.0 / this.options.spawnRate;
      this.registerUser(
        this.creator.spawnUserRandomly(
          this.options.floorCount,
          this.floorHeight,
          this.floors,
        ),
      );
    }

    // Update all elevators
    this.elevators.forEach((elevator) => {
      elevator.tick(dt);
    });

    // Update all users
    this.users.forEach((user) => {
      user.tick(dt);
      this.maxWaitTime = Math.max(
        this.maxWaitTime,
        this.elapsedTime - user.spawnTimestamp,
      );
    });

    // Remove users marked for removal
    this.users = this.users.filter((user) => !user.removeMe);

    this.throttledStats();
  }

  updateDisplayPositions() {
    this.elevators.forEach((elevator) => elevator.updateDisplayPosition());
    this.users.forEach((user) => user.updateDisplayPosition());
  }

  unWind() {
    this.users.forEach((user) => {
      const handlers = this.userEventHandlers.get(user);
      if (handlers) {
        if (handlers.exitedElevator) {
          user.removeEventListener("exited_elevator", handlers.exitedElevator);
        }
        this.userEventHandlers.delete(user);
      }
    });
    this.elevators.forEach((elevator) => {
      elevator.removeEventListener(
        "entrance_available",
        this.handleElevAvailability,
      );
    });
    this.challengeEnded = true;
    this.users = [];
    this.elevators = [];
    this.floors = [];
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
      this.handleUserCodeError(e.detail),
    );

    const updater = async (t) => {
      if (!this.isPaused && !world.challengeEnded && lastT !== null) {
        const dt = t - lastT;
        let scaledDt = dt * 0.001 * this.timeScale;
        scaledDt = Math.min(scaledDt, this.dtMax * 3 * this.timeScale); // Limit to prevent unhealthy substepping

        try {
          await codeObj.tick(
            world.elevators.map((el) => el.toAPI()),
            world.floors.map((fl) => fl.toAPI()),
          );
        } catch (e) {
          this.handleUserCodeError(e);
        }

        while (scaledDt > 0.0 && !world.challengeEnded) {
          const thisDt = Math.min(this.dtMax, scaledDt);
          world.tick(thisDt);
          scaledDt -= this.dtMax;
        }
        world.updateDisplayPositions();
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

  handleUserCodeError(e) {
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

// Factory functions for backward compatibility
export function createWorldCreator() {
  return new WorldCreator();
}

export function createWorldController(dtMax) {
  return new WorldController(dtMax);
}
