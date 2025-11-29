import { describe, it, expect, beforeEach, vi } from "vitest";
import { JSSimulationBackend } from "../src/core/JSSimulationBackend.js";
import { DisplayManager } from "../src/ui/DisplayManager.js";
import { NullDisplayManager } from "../src/ui/NullDisplayManager.js";
import { WorldManager } from "../src/game/WorldManager.js";

describe("Modern Architecture", () => {
  describe("JSSimulationBackend Core Functionality", () => {
    let simulation;

    beforeEach(() => {
      simulation = new JSSimulationBackend();
      simulation.initialize({
        floorCount: 4,
        elevatorCount: 2,
        elevatorCapacities: [4, 6],
        spawnRate: 0.5,
        speedFloorsPerSec: 2.0,
        endCondition: {
          evaluate: () => null, // Never end during tests
        },
      });
    });

    it("should initialize with correct configuration", () => {
      expect(simulation.floors).toHaveLength(4);
      expect(simulation.elevators).toHaveLength(2);
      expect(simulation.elevators[0].capacity).toBe(4);
      expect(simulation.elevators[1].capacity).toBe(6);
    });

    it("should spawn passengers based on spawn rate", () => {
      const spawnSpy = vi.spyOn(simulation, "spawnPassenger");

      // Advance time by 2 seconds (should spawn 1 passenger at 0.5 rate)
      simulation.tick(2.0);

      expect(spawnSpy).toHaveBeenCalled();
      expect(simulation.passengers.length).toBeGreaterThan(0);
    });

    it("should emit state_changed events", () => {
      const stateHandler = vi.fn();
      simulation.addEventListener("state_changed", stateHandler);

      simulation.tick(0.1);

      expect(stateHandler).toHaveBeenCalled();
      const state = stateHandler.mock.calls[0][0].detail;
      expect(state).toHaveProperty("floors");
      expect(state).toHaveProperty("elevators");
      expect(state).toHaveProperty("passengers");
      expect(state).toHaveProperty("stats");
    });

    it("should create immutable state snapshots", () => {
      const state1 = simulation.getState();
      simulation.tick(0.1);
      const state2 = simulation.getState();

      expect(state1).not.toBe(state2);
      expect(state1.stats.elapsedTime).toBeLessThan(state2.stats.elapsedTime);
    });
  });

  describe("JSSimulationBackend", () => {
    let backend;

    beforeEach(() => {
      backend = new JSSimulationBackend();
      backend.initialize({
        floorCount: 3,
        elevatorCount: 1,
        spawnRate: 1.0,
        endCondition: {
          evaluate: () => null,
        },
      });
    });

    it("should implement SimulationBackend interface", () => {
      expect(backend.initialize).toBeDefined();
      expect(backend.tick).toBeDefined();
      expect(backend.getState).toBeDefined();
      expect(backend.callUserCode).toBeDefined();
      expect(backend.cleanup).toBeDefined();
      expect(backend.getStats).toBeDefined();
      expect(backend.hasEnded).toBeDefined();
    });

    it("should forward events from SimulationCore", () => {
      const stateHandler = vi.fn();
      backend.addEventListener("state_changed", stateHandler);

      backend.tick(0.1);

      expect(stateHandler).toHaveBeenCalled();
    });

    it("should handle user code execution", async () => {
      const mockCodeObj = {
        tick: vi.fn(),
      };

      await backend.callUserCode(mockCodeObj, 1);

      expect(mockCodeObj.tick).toHaveBeenCalledWith(
        expect.any(Array), // elevator APIs
        expect.any(Array), // floor APIs
        expect.any(Number),
      );
    });
  });

  describe("DisplayManager", () => {
    let displayManager;
    let backend;

    beforeEach(() => {
      displayManager = new DisplayManager({
        isRenderingEnabled: true,
        floorHeight: 50,
      });

      backend = new JSSimulationBackend();
      backend.initialize({
        floorCount: 2,
        elevatorCount: 1,
        spawnRate: 0.5,
        endCondition: {
          evaluate: () => null,
        },
      });
    });

    it("should initialize displays from state", () => {
      const mockElement = document.createElement("div");
      const initialState = backend.getState();

      displayManager.initialize(initialState, mockElement);

      expect(displayManager.floorDisplays.size).toBe(2);
      expect(displayManager.elevatorDisplays.size).toBe(1);
    });

    it("should subscribe to backend events", () => {
      displayManager.subscribeToBackend(backend);

      const updateSpy = vi.spyOn(displayManager, "updateDisplays");
      backend.tick(0.1);

      expect(updateSpy).toHaveBeenCalled();
    });

    it("should not create displays when rendering disabled", () => {
      const noRenderManager = new DisplayManager({
        isRenderingEnabled: false,
      });

      const initialState = backend.getState();
      noRenderManager.initialize(initialState, document.createElement("div"));

      expect(noRenderManager.floorDisplays.size).toBe(0);
      expect(noRenderManager.elevatorDisplays.size).toBe(0);
    });
  });

  describe("WorldManager", () => {
    let worldManager;

    beforeEach(() => {
      // Pass NullDisplayManager class for headless testing
      worldManager = new WorldManager(NullDisplayManager);
      worldManager.initializeChallenge({
        floorCount: 4,
        elevatorCount: 2,
        spawnRate: 0.5,
        isRenderingEnabled: false, // Disable for testing
      });
    });

    it("should use SimulationBackend internally", () => {
      expect(worldManager.backend).toBeDefined();
      expect(worldManager.backend.constructor.name).toBe("JSSimulationBackend");
    });

    it("should use NullDisplayManager by default for headless operation", () => {
      expect(worldManager.displayManager).toBeDefined();
      expect(worldManager.displayManager.constructor.name).toBe(
        "NullDisplayManager",
      );
    });

    it("should manage game state through start/stop", async () => {
      const mockCode = { 
        tick: vi.fn(),
        start: vi.fn().mockResolvedValue(),
      };
      
      expect(worldManager.isPaused).toBe(true);
      
      // Starting should unpause and set up code
      await worldManager.start(mockCode);
      expect(worldManager.isPaused).toBe(false);
      expect(worldManager.codeObj).toBe(mockCode);
      expect(mockCode.start).toHaveBeenCalled();
    });
  });

  describe("State Snapshot Integrity", () => {
    it("should create complete elevator snapshots", () => {
      const simulation = new JSSimulationBackend();
      simulation.initialize({
        floorCount: 4,
        elevatorCount: 1,
        endCondition: {
          evaluate: () => null,
        },
      });

      const elevator = simulation.elevators[0];
      elevator.goToFloor(2);

      const snapshot = elevator.toJSON();

      expect(snapshot).toMatchObject({
        index: 0,
        position: expect.any(Number),
        currentFloor: expect.any(Number),
        destinationFloor: expect.any(Number),
        velocity: expect.any(Number),
        buttons: expect.any(Array),
        passengers: expect.any(Array),
        goingUpIndicator: expect.any(Boolean),
        goingDownIndicator: expect.any(Boolean),
        capacity: expect.any(Number),
        percentFull: expect.any(Number),
        moves: expect.any(Number),
      });
    });

    it("should create complete passenger snapshots", () => {
      const simulation = new JSSimulationBackend();
      simulation.initialize({
        floorCount: 4,
        elevatorCount: 1,
        spawnRate: 10, // High rate to ensure spawn
        endCondition: {
          evaluate: () => null,
        },
      });

      simulation.tick(0.1);

      if (simulation.passengers.length > 0) {
        const passenger = simulation.passengers[0];
        const snapshot = passenger.toJSON();

        expect(snapshot).toMatchObject({
          id: expect.any(String),
          weight: expect.any(Number),
          startingFloor: expect.any(Number),
          destinationFloor: expect.any(Number),
          currentFloor: expect.any(Number),
          state: expect.any(String),
        });
        expect(snapshot).toHaveProperty("elevatorIndex");
        expect(snapshot).toHaveProperty("slotInElevator");
      }
    });
  });
});
