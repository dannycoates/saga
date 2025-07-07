import { Observable, randomInt, random, map, range, each } from './utils.js';
import { Floor, asFloor } from './Floor.js';
import { Elevator } from './Elevator.js';
import { User } from './User.js';
import { asElevatorInterface } from './interfaces.js';

export class WorldCreator {
  createFloors(floorCount, floorHeight, errorHandler) {
    const floors = range(0, floorCount).map((_, i) => {
      const yPos = (floorCount - 1 - i) * floorHeight;
      return new Floor(i, yPos, errorHandler);
    });
    return floors;
  }

  createElevators(elevatorCount, floorCount, floorHeight, elevatorCapacities = [4]) {
    let currentX = 200.0;
    const elevators = range(0, elevatorCount).map((_, i) => {
      const elevator = new Elevator(2.6, floorCount, floorHeight, elevatorCapacities[i % elevatorCapacities.length]);

      // Move to right x position
      elevator.moveTo(currentX, null);
      elevator.setFloorPosition(0);
      elevator.updateDisplayPosition();
      currentX += (20 + elevator.width);
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
    const currentFloor = randomInt(0, 1) === 0 ? 0 : randomInt(0, floorCount - 1);
    let destinationFloor;
    if (currentFloor === 0) {
      // Definitely going up
      destinationFloor = randomInt(1, floorCount - 1);
    } else {
      // Usually going down, but sometimes not
      if (randomInt(0, 10) === 0) {
        destinationFloor = (currentFloor + randomInt(1, floorCount - 1)) % floorCount;
      } else {
        destinationFloor = 0;
      }
    }
    user.appearOnFloor(floors[currentFloor], destinationFloor);
    return user;
  }

  createWorld(options) {
    console.log("Creating world with options", options);
    const defaultOptions = { floorHeight: 50, floorCount: 4, elevatorCount: 2, spawnRate: 0.5 };
    options = { ...defaultOptions, ...options };
    
    const world = new World(options, this);
    return world;
  }
}

export class World extends Observable {
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
    
    this.floors = creator.createFloors(options.floorCount, this.floorHeight, this.handleUserCodeError);
    this.elevators = creator.createElevators(options.elevatorCount, options.floorCount, this.floorHeight, options.elevatorCapacities);
    this.elevatorInterfaces = this.elevators.map(e => asElevatorInterface({}, e, options.floorCount, this.handleUserCodeError));
    this.users = [];

    this.setupEventHandlers();
  }

  handleUserCodeError(e) {
    this.trigger("usercode_error", e);
  }

  recalculateStats() {
    this.transportedPerSec = this.transportedCounter / this.elapsedTime;
    // TODO: Optimize this loop?
    this.moveCount = this.elevators.reduce((sum, elevator) => sum + elevator.moveCount, 0);
    this.trigger("stats_changed");
  }

  registerUser(user) {
    this.users.push(user);
    user.updateDisplayPosition(true);
    user.spawnTimestamp = this.elapsedTime;
    this.trigger("new_user", user);
    
    const self = this;
    user.on("exited_elevator", function() {
      self.transportedCounter++;
      self.maxWaitTime = Math.max(self.maxWaitTime, self.elapsedTime - user.spawnTimestamp);
      self.avgWaitTime = (self.avgWaitTime * (self.transportedCounter - 1) + (self.elapsedTime - user.spawnTimestamp)) / self.transportedCounter;
      self.recalculateStats();
    });
    user.updateDisplayPosition(true);
  }

  handleElevAvailability(elevator) {
    // Use regular loops for memory/performance reasons
    // Notify floors first because overflowing users
    // will press buttons again.
    for (let i = 0, len = this.floors.length; i < len; ++i) {
      const floor = this.floors[i];
      if (elevator.currentFloor === i) {
        floor.elevatorAvailable(elevator);
      }
    }
    for (let i = 0, len = this.users.length; i < len; ++i) {
      const user = this.users[i];
      if (user.currentFloor === elevator.currentFloor) {
        user.elevatorAvailable(elevator, this.floors[elevator.currentFloor]);
      }
    }
  }

  handleButtonRepressing(eventName, floor) {
    // Need randomize iteration order or we'll tend to fill up first elevator
    for (let i = 0, len = this.elevators.length, offset = randomInt(0, len - 1); i < len; ++i) {
      const elevIndex = (i + offset) % len;
      const elevator = this.elevators[elevIndex];
      if (eventName === "up_button_pressed" && elevator.goingUpIndicator ||
          eventName === "down_button_pressed" && elevator.goingDownIndicator) {

        // Elevator is heading in correct direction, check for suitability
        if (elevator.currentFloor === floor.level && elevator.isOnAFloor() && !elevator.isMoving && !elevator.isFull()) {
          // Potentially suitable to get into
          // Use the interface queue functionality to queue up this action
          this.elevatorInterfaces[elevIndex].goToFloor(floor.level, true);
          return;
        }
      }
    }
  }

  setupEventHandlers() {
    // Bind elevators to handle availability
    for (let i = 0; i < this.elevators.length; ++i) {
      this.elevators[i].on("entrance_available", (e) => this.handleElevAvailability(e));
    }

    // Handle button repressing
    for (let i = 0; i < this.floors.length; ++i) {
      this.floors[i].on("up_button_pressed down_button_pressed", (eventName, floor) => this.handleButtonRepressing(eventName, floor));
    }
  }

  update(dt) {
    this.elapsedTime += dt;
    this.elapsedSinceSpawn += dt;
    this.elapsedSinceStatsUpdate += dt;
    
    while (this.elapsedSinceSpawn > 1.0 / this.options.spawnRate) {
      this.elapsedSinceSpawn -= 1.0 / this.options.spawnRate;
      this.registerUser(this.creator.spawnUserRandomly(this.options.floorCount, this.floorHeight, this.floors));
    }

    // Use regular for loops for performance and memory friendliness
    for (let i = 0, len = this.elevators.length; i < len; ++i) {
      const e = this.elevators[i];
      e.update(dt);
      e.updateElevatorMovement(dt);
    }
    
    for (let i = 0, len = this.users.length; i < len; ++i) {
      const u = this.users[i];
      u.update(dt);
      this.maxWaitTime = Math.max(this.maxWaitTime, this.elapsedTime - u.spawnTimestamp);
    }

    // Remove users marked for removal
    for (let i = this.users.length - 1; i >= 0; i--) {
      const u = this.users[i];
      if (u.removeMe) {
        this.users.splice(i, 1);
      }
    }
    
    this.recalculateStats();
  }

  updateDisplayPositions() {
    for (let i = 0, len = this.elevators.length; i < len; ++i) {
      this.elevators[i].updateDisplayPosition();
    }
    for (let i = 0, len = this.users.length; i < len; ++i) {
      this.users[i].updateDisplayPosition();
    }
  }

  unWind() {
    console.log("Unwinding", this);
    const allObjects = [...this.elevators, ...this.elevatorInterfaces, ...this.users, ...this.floors, this];
    allObjects.forEach(obj => {
      if (typeof obj.off === 'function') {
        obj.off("*");
      }
    });
    this.challengeEnded = true;
    this.elevators = [];
    this.elevatorInterfaces = [];
    this.users = [];
    this.floors = [];
  }

  init() {
    // No initialization needed for simplified interface
  }
}

export class WorldController extends Observable {
  constructor(dtMax = 1/60) {
    super();
    this.dtMax = dtMax;
    this.timeScale = 1.0;
    this.isPaused = true;
  }

  start(world, codeObj, animationFrameRequester, autoStart) {
    this.isPaused = true;
    let lastT = null;
    let firstUpdate = true;
    
    world.on("usercode_error", (e) => this.handleUserCodeError(e));
    
    const updater = (t) => {
      if (!this.isPaused && !world.challengeEnded && lastT !== null) {
        if (firstUpdate) {
          firstUpdate = false;
          // This logic prevents infinite loops in usercode from breaking the page permanently - don't evaluate user code until game is unpaused.
          world.init();
        }

        const dt = (t - lastT);
        let scaledDt = dt * 0.001 * this.timeScale;
        scaledDt = Math.min(scaledDt, this.dtMax * 3 * this.timeScale); // Limit to prevent unhealthy substepping
        
        try {
          codeObj.update(scaledDt, world.elevatorInterfaces, world.floors);
        } catch (e) {
          this.handleUserCodeError(e);
        }
        
        while (scaledDt > 0.0 && !world.challengeEnded) {
          const thisDt = Math.min(this.dtMax, scaledDt);
          world.update(thisDt);
          scaledDt -= this.dtMax;
        }
        world.updateDisplayPositions();
        world.trigger("stats_display_changed"); // TODO: Trigger less often for performance reasons etc
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
    this.trigger("usercode_error", e);
  }

  setPaused(paused) {
    this.isPaused = paused;
    this.trigger("timescale_changed");
  }

  setTimeScale(timeScale) {
    this.timeScale = timeScale;
    this.trigger("timescale_changed");
  }
}

// Factory functions for backward compatibility
export function createWorldCreator() {
  return new WorldCreator();
}

export function createWorldController(dtMax) {
  return new WorldController(dtMax);
}