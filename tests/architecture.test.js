import { describe, it, expect, beforeEach, vi } from "vitest";
import { JSSimulationBackend } from "../src/core/JSSimulationBackend.js";
import { ViewModelManager } from "../src/ui/ViewModelManager.js";
import { GameController } from "../src/game/GameController.js";

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

  describe("ViewModelManager", () => {
    let viewModelManager;
    let backend;

    beforeEach(() => {
      viewModelManager = new ViewModelManager({
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

    it("should initialize view models from state", () => {
      const mockElement = document.createElement("div");
      const initialState = backend.getState();

      viewModelManager.initialize(initialState, mockElement);

      expect(viewModelManager.floorViewModels.size).toBe(2);
      expect(viewModelManager.elevatorViewModels.size).toBe(1);
    });

    it("should subscribe to backend events", () => {
      viewModelManager.subscribeToBackend(backend);

      const updateSpy = vi.spyOn(viewModelManager, "updateViewModels");
      backend.tick(0.1);

      expect(updateSpy).toHaveBeenCalled();
    });

    it("should not create view models when rendering disabled", () => {
      const noRenderManager = new ViewModelManager({
        isRenderingEnabled: false,
      });

      const initialState = backend.getState();
      noRenderManager.initialize(initialState, document.createElement("div"));

      expect(noRenderManager.floorViewModels.size).toBe(0);
      expect(noRenderManager.elevatorViewModels.size).toBe(0);
    });
  });

  describe("GameController", () => {
    let gameController;

    beforeEach(() => {
      gameController = new GameController();
      gameController.initializeChallenge({
        options: {
          floorCount: 4,
          elevatorCount: 2,
          spawnRate: 0.5,
          isRenderingEnabled: false,
        },
        condition: { evaluate: () => null },
      });
    });

    it("should use SimulationBackend internally", () => {
      expect(gameController.backend).toBeDefined();
      expect(gameController.backend.constructor.name).toBe("JSSimulationBackend");
    });

    it("should emit challenge_initialized with backend reference", () => {
      const handler = vi.fn();
      const newGameController = new GameController();
      newGameController.addEventListener("challenge_initialized", handler);

      newGameController.initializeChallenge({
        options: { floorCount: 2 },
        condition: { evaluate: () => null },
      });

      expect(handler).toHaveBeenCalled();
      const detail = handler.mock.calls[0][0].detail;
      expect(detail.backend).toBeDefined();
      expect(detail.options).toBeDefined();
      expect(detail.options.floorHeight).toBeDefined();
    });

    it("should manage game state through start/stop", async () => {
      const mockCode = {
        tick: vi.fn(),
        start: vi.fn().mockResolvedValue(),
      };

      expect(gameController.isPaused).toBe(true);

      // Starting should unpause and set up code
      await gameController.start(mockCode);
      expect(gameController.isPaused).toBe(false);
      expect(gameController.codeObj).toBe(mockCode);
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
