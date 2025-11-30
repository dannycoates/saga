import { describe, it, expect, beforeEach, vi } from "vitest";
import { ViewModelManager } from "../../src/ui/ViewModelManager.js";

// Mock DOM for tests
beforeEach(() => {
  // Mock document.querySelector
  vi.stubGlobal("document", {
    querySelector: vi.fn().mockReturnValue({ style: {} }),
  });
});

describe("ViewModelManager", () => {
  let manager;

  beforeEach(() => {
    manager = new ViewModelManager();
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      expect(manager.isRenderingEnabled).toBe(true);
      expect(manager.floorHeight).toBe(50);
      expect(manager.floorViewModels.size).toBe(0);
      expect(manager.elevatorViewModels.size).toBe(0);
      expect(manager.passengerViewModels.size).toBe(0);
    });

    it("should respect isRenderingEnabled option", () => {
      const disabled = new ViewModelManager({ isRenderingEnabled: false });
      expect(disabled.isRenderingEnabled).toBe(false);
    });

    it("should respect custom floorHeight", () => {
      const custom = new ViewModelManager({ floorHeight: 100 });
      expect(custom.floorHeight).toBe(100);
    });

    it("should create AbortController", () => {
      expect(manager.abortController).toBeInstanceOf(AbortController);
    });
  });

  describe("getters", () => {
    it("should provide floors alias", () => {
      expect(manager.floors).toBe(manager.floorViewModels);
    });

    it("should provide elevators alias", () => {
      expect(manager.elevators).toBe(manager.elevatorViewModels);
    });

    it("should provide passengers alias", () => {
      expect(manager.passengers).toBe(manager.passengerViewModels);
    });
  });

  describe("initialize", () => {
    const mockState = {
      floors: [
        { level: 0, buttons: { up: false, down: false } },
        { level: 1, buttons: { up: false, down: false } },
        { level: 2, buttons: { up: false, down: false } },
      ],
      elevators: [
        { index: 0, position: 0, capacity: 4, destination: 0, velocity: 0 },
        { index: 1, position: 0, capacity: 6, destination: 0, velocity: 0 },
      ],
      passengers: [],
      stats: {},
      isChallengeEnded: false,
    };

    it("should create floor view models", () => {
      manager.initialize(mockState);

      expect(manager.floorViewModels.size).toBe(3);
      expect(manager.floorViewModels.has(0)).toBe(true);
      expect(manager.floorViewModels.has(1)).toBe(true);
      expect(manager.floorViewModels.has(2)).toBe(true);
    });

    it("should create elevator view models", () => {
      manager.initialize(mockState);

      expect(manager.elevatorViewModels.size).toBe(2);
      expect(manager.elevatorViewModels.has(0)).toBe(true);
      expect(manager.elevatorViewModels.has(1)).toBe(true);
    });

    it("should not create view models when rendering disabled", () => {
      const disabled = new ViewModelManager({ isRenderingEnabled: false });
      disabled.initialize(mockState);

      expect(disabled.floorViewModels.size).toBe(0);
      expect(disabled.elevatorViewModels.size).toBe(0);
    });

    it("should clear existing view models on re-initialize", () => {
      manager.initialize(mockState);
      expect(manager.floorViewModels.size).toBe(3);

      // Re-initialize with fewer floors
      manager.initialize({
        ...mockState,
        floors: [{ level: 0, buttons: { up: false, down: false } }],
        elevators: [
          { index: 0, position: 0, capacity: 4, destination: 0, velocity: 0 },
        ],
      });

      expect(manager.floorViewModels.size).toBe(1);
      expect(manager.elevatorViewModels.size).toBe(1);
    });
  });

  describe("static create", () => {
    it("should create instance without backend", () => {
      const instance = ViewModelManager.create();
      expect(instance).toBeInstanceOf(ViewModelManager);
    });

    it("should initialize and subscribe when backend provided", () => {
      const mockBackend = {
        getState: vi.fn().mockReturnValue({
          floors: [{ level: 0, buttons: { up: false, down: false } }],
          elevators: [
            { index: 0, position: 0, capacity: 4, destination: 0, velocity: 0 },
          ],
          passengers: [],
          stats: {},
          isChallengeEnded: false,
        }),
        addEventListener: vi.fn(),
      };

      const instance = ViewModelManager.create({ backend: mockBackend });

      expect(mockBackend.getState).toHaveBeenCalled();
      expect(mockBackend.addEventListener).toHaveBeenCalled();
    });
  });

  describe("subscribeToBackend", () => {
    it("should subscribe to state_changed events", () => {
      const mockBackend = { addEventListener: vi.fn() };

      manager.subscribeToBackend(mockBackend);

      expect(mockBackend.addEventListener).toHaveBeenCalledWith(
        "state_changed",
        expect.any(Function),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("should subscribe to passenger_spawned events", () => {
      const mockBackend = { addEventListener: vi.fn() };

      manager.subscribeToBackend(mockBackend);

      expect(mockBackend.addEventListener).toHaveBeenCalledWith(
        "passenger_spawned",
        expect.any(Function),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("should subscribe to passengers_exited events", () => {
      const mockBackend = { addEventListener: vi.fn() };

      manager.subscribeToBackend(mockBackend);

      expect(mockBackend.addEventListener).toHaveBeenCalledWith(
        "passengers_exited",
        expect.any(Function),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  describe("updateViewModels", () => {
    const initialState = {
      floors: [
        { level: 0, buttons: { up: false, down: false } },
        { level: 1, buttons: { up: false, down: false } },
      ],
      elevators: [
        { index: 0, position: 0, capacity: 4, destination: 0, velocity: 0 },
      ],
      passengers: [],
      stats: {},
      isChallengeEnded: false,
    };

    beforeEach(() => {
      manager.initialize(initialState);
    });

    it("should update floor view models", () => {
      const updatedState = {
        ...initialState,
        floors: [
          { level: 0, buttons: { up: true, down: false } },
          { level: 1, buttons: { up: false, down: true } },
        ],
      };

      const floor0 = manager.floorViewModels.get(0);
      const updateSpy = vi.spyOn(floor0, "updateFromState");

      manager.updateViewModels(updatedState, 0.1);

      expect(updateSpy).toHaveBeenCalledWith(updatedState.floors[0]);
    });

    it("should update elevator view models", () => {
      const updatedState = {
        ...initialState,
        elevators: [
          { index: 0, position: 1.5, capacity: 4, destination: 2, velocity: 1 },
        ],
      };

      const elevator0 = manager.elevatorViewModels.get(0);
      const updateSpy = vi.spyOn(elevator0, "updateFromState");

      manager.updateViewModels(updatedState, 0.1);

      expect(updateSpy).toHaveBeenCalledWith(updatedState.elevators[0]);
    });

    it("should not update when rendering disabled", () => {
      const disabled = new ViewModelManager({ isRenderingEnabled: false });
      disabled.initialize(initialState);

      // Should not throw
      disabled.updateViewModels(initialState, 0.1);
    });

    it("should call tick on view models with dt", () => {
      const elevator0 = manager.elevatorViewModels.get(0);
      const tickSpy = vi.spyOn(elevator0, "tick");

      manager.updateViewModels(initialState, 0.5);

      expect(tickSpy).toHaveBeenCalledWith(0.5);
    });
  });

  describe("handlePassengerSpawned", () => {
    beforeEach(() => {
      manager.initialize({
        floors: [
          { level: 0, buttons: { up: false, down: false } },
          { level: 1, buttons: { up: false, down: false } },
        ],
        elevators: [
          { index: 0, position: 0, capacity: 4, destination: 0, velocity: 0 },
        ],
        passengers: [],
        stats: {},
        isChallengeEnded: false,
      });
    });

    it("should create passenger view model", () => {
      manager.handlePassengerSpawned({
        id: "test-passenger",
        currentFloor: 0,
        destinationFloor: 1,
        state: "waiting",
      });

      expect(manager.passengerViewModels.has("test-passenger")).toBe(true);
    });

    it("should not create when rendering disabled", () => {
      const disabled = new ViewModelManager({ isRenderingEnabled: false });

      disabled.handlePassengerSpawned({
        id: "test-passenger",
        currentFloor: 0,
        destinationFloor: 1,
        state: "waiting",
      });

      expect(disabled.passengerViewModels.size).toBe(0);
    });
  });

  describe("handlePassengersExited", () => {
    beforeEach(() => {
      manager.initialize({
        floors: [{ level: 0, buttons: { up: false, down: false } }],
        elevators: [
          { index: 0, position: 0, capacity: 4, destination: 0, velocity: 0 },
        ],
        passengers: [],
        stats: {},
        isChallengeEnded: false,
      });

      manager.handlePassengerSpawned({
        id: "test-passenger",
        currentFloor: 0,
        destinationFloor: 1,
        state: "waiting",
      });
    });

    it("should update passenger view model state", () => {
      const viewModel = manager.passengerViewModels.get("test-passenger");
      const updateSpy = vi.spyOn(viewModel, "updateFromState");

      manager.handlePassengersExited([
        {
          id: "test-passenger",
          currentFloor: 1,
          destinationFloor: 1,
          state: "exited",
        },
      ]);

      expect(updateSpy).toHaveBeenCalled();
    });

    it("should not throw for unknown passenger", () => {
      expect(() => {
        manager.handlePassengersExited([
          {
            id: "unknown-passenger",
            currentFloor: 1,
            destinationFloor: 1,
            state: "exited",
          },
        ]);
      }).not.toThrow();
    });
  });

  describe("cleanup", () => {
    beforeEach(() => {
      manager.initialize({
        floors: [{ level: 0, buttons: { up: false, down: false } }],
        elevators: [
          { index: 0, position: 0, capacity: 4, destination: 0, velocity: 0 },
        ],
        passengers: [],
        stats: {},
        isChallengeEnded: false,
      });
    });

    it("should abort event listeners", () => {
      const oldController = manager.abortController;
      const abortSpy = vi.spyOn(oldController, "abort");

      manager.cleanup();

      expect(abortSpy).toHaveBeenCalled();
    });

    it("should clear all view model maps", () => {
      manager.handlePassengerSpawned({
        id: "test",
        currentFloor: 0,
        destinationFloor: 1,
        state: "waiting",
      });

      manager.cleanup();

      expect(manager.floorViewModels.size).toBe(0);
      expect(manager.elevatorViewModels.size).toBe(0);
      expect(manager.passengerViewModels.size).toBe(0);
    });

    it("should create new AbortController after cleanup", () => {
      const oldController = manager.abortController;

      manager.cleanup();

      expect(manager.abortController).not.toBe(oldController);
      expect(manager.abortController).toBeInstanceOf(AbortController);
    });

    it("should cancel elevator animations", () => {
      const elevator = manager.elevatorViewModels.get(0);
      const cancelSpy = vi.spyOn(elevator, "cancelAnimation");

      manager.cleanup();

      expect(cancelSpy).toHaveBeenCalled();
    });
  });

  describe("cleanupExitedPassengers", () => {
    beforeEach(() => {
      manager.initialize({
        floors: [{ level: 0, buttons: { up: false, down: false } }],
        elevators: [
          { index: 0, position: 0, capacity: 4, destination: 0, velocity: 0 },
        ],
        passengers: [],
        stats: {},
        isChallengeEnded: false,
      });
    });

    it("should remove inactive passenger view models", () => {
      manager.handlePassengerSpawned({
        id: "test",
        currentFloor: 0,
        destinationFloor: 1,
        state: "waiting",
      });

      const viewModel = manager.passengerViewModels.get("test");

      // Mark as inactive
      viewModel.isActive = false;

      manager.cleanupExitedPassengers();

      expect(manager.passengerViewModels.has("test")).toBe(false);
    });

    it("should keep active passenger view models", () => {
      manager.handlePassengerSpawned({
        id: "test",
        currentFloor: 0,
        destinationFloor: 1,
        state: "waiting",
      });

      const viewModel = manager.passengerViewModels.get("test");
      expect(viewModel.isActive).toBe(true);

      manager.cleanupExitedPassengers();

      expect(manager.passengerViewModels.has("test")).toBe(true);
    });

    it("should emit removed event for cleaned up passengers", () => {
      manager.handlePassengerSpawned({
        id: "test",
        currentFloor: 0,
        destinationFloor: 1,
        state: "waiting",
      });

      const viewModel = manager.passengerViewModels.get("test");
      const removedListener = vi.fn();
      viewModel.addEventListener("removed", removedListener);

      viewModel.isActive = false;
      manager.cleanupExitedPassengers();

      expect(removedListener).toHaveBeenCalled();
    });
  });
});
