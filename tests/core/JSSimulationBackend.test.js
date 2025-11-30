import { describe, it, expect, beforeEach, vi } from "vitest";
import { JSSimulationBackend } from "../../src/core/JSSimulationBackend.js";
import { EventBus } from "../../src/utils/EventBus.js";

describe("JSSimulationBackend", () => {
  let backend;
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    backend = new JSSimulationBackend(eventBus);
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      expect(backend.floorCount).toBe(0);
      expect(backend.elevatorCount).toBe(0);
      expect(backend.elevatorCapacities).toEqual([]);
      expect(backend.spawnRate).toBe(0.5);
      expect(backend.transportedCount).toBe(0);
      expect(backend.elapsedTime).toBe(0);
      expect(backend.isChallengeEnded).toBe(false);
      expect(backend.floors).toEqual([]);
      expect(backend.elevators).toEqual([]);
      expect(backend.passengers).toEqual([]);
    });
  });

  describe("initialize", () => {
    it("should create correct number of floors", () => {
      backend.initialize({
        floorCount: 5,
        elevatorCount: 2,
        elevatorCapacities: [4],
        spawnRate: 0.5,
      });

      expect(backend.floors.length).toBe(5);
      expect(backend.floors[0].level).toBe(0);
      expect(backend.floors[4].level).toBe(4);
    });

    it("should create correct number of elevators", () => {
      backend.initialize({
        floorCount: 5,
        elevatorCount: 3,
        elevatorCapacities: [4, 6],
        spawnRate: 0.5,
      });

      expect(backend.elevators.length).toBe(3);
      expect(backend.elevators[0].capacity).toBe(4);
      expect(backend.elevators[1].capacity).toBe(6);
      expect(backend.elevators[2].capacity).toBe(4); // Wraps around
    });

    it("should reset all stats on initialize", () => {
      backend.transportedCount = 10;
      backend.elapsedTime = 100;
      backend.isChallengeEnded = true;

      backend.initialize({
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 1,
      });

      expect(backend.transportedCount).toBe(0);
      expect(backend.elapsedTime).toBe(0);
      expect(backend.isChallengeEnded).toBe(false);
    });

    it("should use default speed if not provided", () => {
      backend.initialize({
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 1,
      });

      expect(backend.speedFloorsPerSec).toBe(2.6);
    });

    it("should use custom speed when provided", () => {
      backend.initialize({
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 1,
        speedFloorsPerSec: 5.0,
      });

      expect(backend.speedFloorsPerSec).toBe(5.0);
    });
  });

  describe("tick", () => {
    beforeEach(() => {
      backend.initialize({
        floorCount: 5,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 2, // 2 passengers per second
      });
    });

    it("should increment elapsed time", () => {
      backend.tick(0.1);
      expect(backend.elapsedTime).toBeCloseTo(0.1);

      backend.tick(0.2);
      expect(backend.elapsedTime).toBeCloseTo(0.3);
    });

    it("should spawn passengers over time", () => {
      // At spawnRate of 2, should spawn every 0.5 seconds
      expect(backend.passengers.length).toBe(0);

      // First tick should spawn (elapsedSinceSpawn starts > threshold)
      backend.tick(0.1);
      expect(backend.passengers.length).toBeGreaterThan(0);
    });

    it("should emit state_changed event", () => {
      const listener = vi.fn();
      eventBus.on("simulation:state_changed", listener);

      backend.tick(0.1);

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0];
      expect(event.detail).toHaveProperty("floors");
      expect(event.detail).toHaveProperty("elevators");
      expect(event.detail).toHaveProperty("passengers");
      expect(event.detail).toHaveProperty("dt", 0.1);
    });

    it("should not execute when challenge has ended", () => {
      backend.isChallengeEnded = true;
      const initialTime = backend.elapsedTime;

      backend.tick(1.0);

      expect(backend.elapsedTime).toBe(initialTime);
    });

    it("should emit passenger_spawned event when spawning", () => {
      const listener = vi.fn();
      eventBus.on("simulation:passenger_spawned", listener);

      // Tick enough to trigger spawn
      backend.tick(0.6);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail).toHaveProperty("passenger");
    });
  });

  describe("passenger spawning", () => {
    beforeEach(() => {
      backend.initialize({
        floorCount: 5,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 10,
      });
    });

    it("should create passengers with valid floors", () => {
      backend.tick(0.5);

      backend.passengers.forEach((passenger) => {
        expect(passenger.currentFloor).toBeGreaterThanOrEqual(0);
        expect(passenger.currentFloor).toBeLessThan(5);
        expect(passenger.destinationFloor).toBeGreaterThanOrEqual(0);
        expect(passenger.destinationFloor).toBeLessThan(5);
        expect(passenger.currentFloor).not.toBe(passenger.destinationFloor);
      });
    });

    it("should press floor button when passenger spawns", () => {
      // Directly test the spawnPassenger method by mocking randomStartAndDestination
      // Use a fresh backend to avoid interference from existing spawn timing
      const testEventBus = new EventBus();
      const testBackend = new JSSimulationBackend(testEventBus);
      testBackend.initialize({
        floorCount: 5,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 10,
      });

      // Mock to return predictable values
      testBackend.randomStartAndDestination = () => ({
        currentFloor: 0,
        destinationFloor: 3,
      });

      // Manually call spawnPassenger
      testBackend.spawnPassenger();

      expect(testBackend.floors[0].buttons.up).toBe(true);
      expect(testBackend.passengers.length).toBe(1);
    });

    it("should press down button when going down", () => {
      backend.elapsedSinceSpawn = 0;
      backend.randomStartAndDestination = vi.fn().mockReturnValue({
        currentFloor: 3,
        destinationFloor: 0,
      });

      backend.tick(0.2);

      expect(backend.floors[3].buttons.down).toBe(true);
    });
  });

  describe("handleElevatorArrival", () => {
    beforeEach(() => {
      backend.initialize({
        floorCount: 5,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 0.1, // Very low spawn rate for controlled testing
      });
    });

    it("should allow passengers to exit at destination", () => {
      const elevator = backend.elevators[0];

      // Manually add a passenger going to floor 2
      const passenger = {
        id: "test-passenger",
        weight: 80,
        startingFloor: 0,
        destinationFloor: 2,
        currentFloor: 0,
        spawnTimestamp: 0,
        elevator: null,
        state: "waiting",
        shouldExitAt: (floor) => floor === 2,
        enterElevator: function (e) {
          this.elevator = e;
          this.state = "riding";
        },
        exitElevator: function () {
          this.elevator = null;
          this.state = "exited";
        },
        toJSON: () => ({ id: "test-passenger" }),
      };

      elevator.addPassenger(passenger);
      passenger.elevator = elevator;
      passenger.state = "riding";
      backend.passengers.push(passenger);

      // Move elevator to floor 2
      elevator.position = 2;
      elevator.destination = 2;

      backend.handleElevatorArrival(elevator);

      expect(backend.transportedCount).toBe(1);
    });

    it("should emit passengers_exited event", () => {
      const elevator = backend.elevators[0];
      const listener = vi.fn();
      eventBus.on("simulation:passengers_exited", listener);

      const passenger = {
        id: "test-passenger",
        weight: 80,
        destinationFloor: 2,
        spawnTimestamp: 0,
        elevator: elevator,
        shouldExitAt: (floor) => floor === 2,
        exitElevator: function () {
          this.elevator = null;
        },
        toJSON: () => ({ id: "test-passenger" }),
      };

      elevator.passengers[0] = passenger;
      elevator.position = 2;

      backend.handleElevatorArrival(elevator);

      expect(listener).toHaveBeenCalled();
    });

    it("should allow waiting passengers to board", () => {
      const elevator = backend.elevators[0];
      elevator.goingUpIndicator = true;

      // Create waiting passenger
      const passenger = {
        id: "waiting-passenger",
        weight: 80,
        currentFloor: 0,
        destinationFloor: 3,
        spawnTimestamp: 0,
        elevator: null,
        shouldExitAt: () => false,
        enterElevator: function (e) {
          this.elevator = e;
        },
        toJSON: () => ({ id: "waiting-passenger" }),
      };
      backend.passengers.push(passenger);
      backend.floors[0].buttons.up = true;

      elevator.position = 0;

      backend.handleElevatorArrival(elevator);

      expect(passenger.elevator).toBe(elevator);
    });

    it("should emit passengers_boarded event", () => {
      const elevator = backend.elevators[0];
      elevator.goingUpIndicator = true;
      const listener = vi.fn();
      eventBus.on("simulation:passengers_boarded", listener);

      const passenger = {
        id: "waiting-passenger",
        weight: 80,
        currentFloor: 0,
        destinationFloor: 3,
        spawnTimestamp: 0,
        elevator: null,
        shouldExitAt: () => false,
        enterElevator: function (e) {
          this.elevator = e;
        },
        toJSON: () => ({ id: "waiting-passenger" }),
      };
      backend.passengers.push(passenger);
      backend.floors[0].buttons.up = true;

      elevator.position = 0;

      backend.handleElevatorArrival(elevator);

      expect(listener).toHaveBeenCalled();
    });

    it("should clear floor button when no more waiting passengers", () => {
      const elevator = backend.elevators[0];
      elevator.goingUpIndicator = true;

      const passenger = {
        id: "waiting-passenger",
        weight: 80,
        currentFloor: 0,
        destinationFloor: 3,
        spawnTimestamp: 0,
        elevator: null,
        shouldExitAt: () => false,
        enterElevator: function (e) {
          this.elevator = e;
        },
        toJSON: () => ({ id: "waiting-passenger" }),
      };
      backend.passengers.push(passenger);
      backend.floors[0].buttons.up = true;

      elevator.position = 0;

      backend.handleElevatorArrival(elevator);

      expect(backend.floors[0].buttons.up).toBe(false);
    });

    it("should not board passengers when elevator is full", () => {
      const elevator = backend.elevators[0];
      elevator.goingUpIndicator = true;

      // Fill elevator with mock passengers
      for (let i = 0; i < 4; i++) {
        const fillerPassenger = {
          weight: 80,
          enterElevator: () => {},
          shouldExitAt: () => false,
        };
        elevator.passengers[i] = fillerPassenger;
      }

      const passenger = {
        id: "waiting-passenger",
        weight: 80,
        currentFloor: 0,
        destinationFloor: 3,
        spawnTimestamp: 0,
        elevator: null,
        shouldExitAt: () => false,
        enterElevator: function (e) {
          this.elevator = e;
        },
        toJSON: () => ({ id: "waiting-passenger" }),
      };
      backend.passengers.push(passenger);
      backend.floors[0].buttons.up = true;

      elevator.position = 0;

      backend.handleElevatorArrival(elevator);

      expect(passenger.elevator).toBe(null);
    });
  });

  describe("end conditions", () => {
    it("should emit challenge_ended when condition returns true", () => {
      const listener = vi.fn();
      backend.initialize({
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 1,
        endCondition: {
          evaluate: () => true, // Immediately succeed
        },
      });

      eventBus.on("simulation:challenge_ended", listener);
      backend.tick(0.1);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.succeeded).toBe(true);
      expect(backend.isChallengeEnded).toBe(true);
    });

    it("should emit challenge_ended when condition returns false", () => {
      const listener = vi.fn();
      backend.initialize({
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 1,
        endCondition: {
          evaluate: () => false, // Immediately fail
        },
      });

      eventBus.on("simulation:challenge_ended", listener);
      backend.tick(0.1);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail.succeeded).toBe(false);
    });

    it("should continue when condition returns null", () => {
      const listener = vi.fn();
      backend.initialize({
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 1,
        endCondition: {
          evaluate: () => null, // Continue playing
        },
      });

      eventBus.on("simulation:challenge_ended", listener);
      backend.tick(0.1);
      backend.tick(0.1);
      backend.tick(0.1);

      expect(listener).not.toHaveBeenCalled();
      expect(backend.isChallengeEnded).toBe(false);
    });
  });

  describe("getStats", () => {
    beforeEach(() => {
      backend.initialize({
        floorCount: 3,
        elevatorCount: 2,
        elevatorCapacities: [4],
        spawnRate: 1,
      });
    });

    it("should return current statistics", () => {
      backend.tick(1.0);

      const stats = backend.getStats();

      expect(stats).toHaveProperty("transportedCount");
      expect(stats).toHaveProperty("transportedPerSec");
      expect(stats).toHaveProperty("avgWaitTime");
      expect(stats).toHaveProperty("maxWaitTime");
      expect(stats).toHaveProperty("moveCount");
      expect(stats).toHaveProperty("elapsedTime");
      expect(stats.elapsedTime).toBeCloseTo(1.0);
    });

    it("should calculate transportedPerSec correctly", () => {
      backend.transportedCount = 10;
      backend.elapsedTime = 5;
      backend.recalculateStats();

      expect(backend.transportedPerSec).toBe(2);
    });

    it("should sum elevator moves", () => {
      backend.elevators[0].goToFloor(2);
      backend.elevators[1].goToFloor(1);
      backend.recalculateStats();

      expect(backend.moveCount).toBe(2);
    });
  });

  describe("getState", () => {
    beforeEach(() => {
      backend.initialize({
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 1,
      });
    });

    it("should return full simulation state", () => {
      backend.tick(0.5);

      const state = backend.getState();

      expect(state.floors).toHaveLength(3);
      expect(state.elevators).toHaveLength(1);
      expect(state).toHaveProperty("passengers");
      expect(state).toHaveProperty("stats");
      expect(state).toHaveProperty("isChallengeEnded");
    });

    it("should serialize floors correctly", () => {
      const state = backend.getState();

      expect(state.floors[0]).toHaveProperty("level", 0);
      expect(state.floors[0]).toHaveProperty("buttons");
    });

    it("should serialize elevators correctly", () => {
      backend.elevators[0].goToFloor(2);
      const state = backend.getState();

      expect(state.elevators[0]).toHaveProperty("index", 0);
      expect(state.elevators[0]).toHaveProperty("position");
      expect(state.elevators[0]).toHaveProperty("destinationFloor", 2);
    });
  });

  describe("callUserCode", () => {
    beforeEach(() => {
      backend.initialize({
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 1,
      });
    });

    it("should call user code with elevator and floor APIs", async () => {
      const mockCodeObj = {
        safeTick: vi.fn().mockResolvedValue(),
      };

      await backend.callUserCode(mockCodeObj, 0.1);

      expect(mockCodeObj.safeTick).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        0.1,
      );
    });

    it("should not call user code when challenge ended", async () => {
      backend.isChallengeEnded = true;
      const mockCodeObj = {
        safeTick: vi.fn().mockResolvedValue(),
      };

      await backend.callUserCode(mockCodeObj, 0.1);

      expect(mockCodeObj.safeTick).not.toHaveBeenCalled();
    });

    it("should pass elevator API with correct properties", async () => {
      let capturedElevators;
      const mockCodeObj = {
        safeTick: vi.fn((elevators) => {
          capturedElevators = elevators;
        }),
      };

      await backend.callUserCode(mockCodeObj, 0.1);

      expect(capturedElevators[0]).toHaveProperty("currentFloor");
      expect(capturedElevators[0]).toHaveProperty("destinationFloor");
      expect(capturedElevators[0]).toHaveProperty("pressedFloorButtons");
      expect(capturedElevators[0]).toHaveProperty("percentFull");
      expect(capturedElevators[0]).toHaveProperty("goToFloor");
    });
  });

  describe("cleanup", () => {
    it("should clear all state", () => {
      backend.initialize({
        floorCount: 5,
        elevatorCount: 2,
        elevatorCapacities: [4],
        spawnRate: 1,
      });

      backend.tick(1.0);
      backend.cleanup();

      expect(backend.isChallengeEnded).toBe(true);
      expect(backend.passengers).toEqual([]);
      expect(backend.elevators).toEqual([]);
      expect(backend.floors).toEqual([]);
    });
  });

  describe("randomStartAndDestination", () => {
    beforeEach(() => {
      backend.initialize({
        floorCount: 5,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 1,
      });
    });

    it("should return valid floor numbers", () => {
      for (let i = 0; i < 100; i++) {
        const { currentFloor, destinationFloor } =
          backend.randomStartAndDestination();

        expect(currentFloor).toBeGreaterThanOrEqual(0);
        expect(currentFloor).toBeLessThan(5);
        expect(destinationFloor).toBeGreaterThanOrEqual(0);
        expect(destinationFloor).toBeLessThan(5);
        expect(currentFloor).not.toBe(destinationFloor);
      }
    });

    it("should bias toward ground floor", () => {
      let groundFloorStarts = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const { currentFloor } = backend.randomStartAndDestination();
        if (currentFloor === 0) groundFloorStarts++;
      }

      // Should be around 50% due to the lobby bias
      expect(groundFloorStarts / iterations).toBeGreaterThan(0.3);
    });
  });

  describe("wait time tracking", () => {
    beforeEach(() => {
      backend.initialize({
        floorCount: 3,
        elevatorCount: 1,
        elevatorCapacities: [4],
        spawnRate: 0.1,
      });
    });

    it("should track max wait time", () => {
      const elevator = backend.elevators[0];

      // Create passenger with known spawn time
      const passenger = {
        id: "test",
        weight: 80,
        destinationFloor: 0,
        spawnTimestamp: 0,
        elevator: elevator,
        shouldExitAt: () => true,
        exitElevator: function () {
          this.elevator = null;
        },
        toJSON: () => ({ id: "test" }),
      };

      elevator.passengers[0] = passenger;

      // Advance time
      backend.elapsedTime = 5.0;
      backend.handleElevatorArrival(elevator);

      expect(backend.maxWaitTime).toBe(5.0);
    });

    it("should calculate average wait time", () => {
      const elevator = backend.elevators[0];

      // First passenger waited 4 seconds
      const p1 = {
        id: "p1",
        weight: 80,
        destinationFloor: 0,
        spawnTimestamp: 0,
        elevator: elevator,
        shouldExitAt: () => true,
        exitElevator: function () {
          this.elevator = null;
        },
        toJSON: () => ({ id: "p1" }),
      };

      elevator.passengers[0] = p1;
      backend.elapsedTime = 4.0;
      backend.handleElevatorArrival(elevator);

      expect(backend.avgWaitTime).toBe(4.0);

      // Second passenger waited 6 seconds
      const p2 = {
        id: "p2",
        weight: 80,
        destinationFloor: 0,
        spawnTimestamp: 4.0,
        elevator: elevator,
        shouldExitAt: () => true,
        exitElevator: function () {
          this.elevator = null;
        },
        toJSON: () => ({ id: "p2" }),
      };

      elevator.passengers[0] = p2;
      backend.elapsedTime = 10.0;
      backend.handleElevatorArrival(elevator);

      // Average of 4 and 6 is 5
      expect(backend.avgWaitTime).toBe(5.0);
    });
  });
});
