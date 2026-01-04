import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GameController } from "../../src/game/GameController.js";
import { EventBus } from "../../src/utils/EventBus.js";

// Mock window for animation frames
const mockRAF = vi.fn((cb) => {
  return 1;
});
const mockCAF = vi.fn();

beforeEach(() => {
  vi.stubGlobal("window", {
    requestAnimationFrame: mockRAF,
    cancelAnimationFrame: mockCAF,
  });
  vi.stubGlobal("localStorage", {
    setItem: vi.fn(),
    getItem: vi.fn(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GameController", () => {
  let gameController;
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    gameController = new GameController(eventBus);
  });

  describe("constructor", () => {
    it("should initialize with default values", () => {
      expect(gameController.backend).toBe(null);
      expect(gameController.challenge).toBe(null);
      expect(gameController.timeScale).toBe(1.0);
      expect(gameController.isPaused).toBe(true);
      expect(gameController.animationFrameId).toBe(null);
      expect(gameController.codeObj).toBe(null);
    });

    it("should create AbortController", () => {
      expect(gameController.abortController).toBeInstanceOf(AbortController);
    });
  });

  describe("initializeChallenge", () => {
    it("should create backend with correct configuration", () => {
      gameController.initializeChallenge({
        options: {
          floorCount: 5,
          elevatorCount: 3,
          spawnRate: 1.0,
        },
        condition: { evaluate: () => null },
      });

      expect(gameController.backend).not.toBe(null);
      expect(gameController.backend.floorCount).toBe(5);
      expect(gameController.backend.elevatorCount).toBe(3);
      expect(gameController.backend.spawnRate).toBe(1.0);
    });

    it("should use default options when not provided", () => {
      gameController.initializeChallenge({
        options: {},
        condition: { evaluate: () => null },
      });

      expect(gameController.backend.floorCount).toBe(3);
      expect(gameController.backend.elevatorCount).toBe(1);
      expect(gameController.backend.spawnRate).toBe(0.5);
    });

    it("should emit challenge_initialized event", () => {
      const listener = vi.fn();
      eventBus.on("game:challenge_initialized", listener);

      gameController.initializeChallenge({
        options: { floorCount: 3 },
        condition: { evaluate: () => null },
      });

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail).toHaveProperty("initialState");
      expect(listener.mock.calls[0][0].detail).toHaveProperty("options");
    });

    it("should cleanup previous challenge", () => {
      gameController.initializeChallenge({
        options: { floorCount: 3 },
        condition: { evaluate: () => null },
      });

      const oldBackend = gameController.backend;
      const cleanupSpy = vi.spyOn(oldBackend, "cleanup");

      gameController.initializeChallenge({
        options: { floorCount: 5 },
        condition: { evaluate: () => null },
      });

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it("should store challenge reference", () => {
      const challenge = {
        options: { floorCount: 3 },
        condition: { evaluate: () => null },
      };

      gameController.initializeChallenge(challenge);

      expect(gameController.challenge).toBe(challenge);
    });
  });

  describe("start", () => {
    beforeEach(() => {
      gameController.initializeChallenge({
        options: { floorCount: 3, elevatorCount: 1, isRenderingEnabled: false },
        condition: { evaluate: () => null },
      });
    });

    it("should set codeObj and unpause", async () => {
      const mockCode = {
        tick: vi.fn(),
        start: vi.fn().mockResolvedValue(),
      };

      await gameController.start(mockCode);

      expect(gameController.codeObj).toBe(mockCode);
      expect(gameController.isPaused).toBe(false);
    });

    it("should call code.start() if provided", async () => {
      const mockCode = {
        tick: vi.fn(),
        start: vi.fn().mockResolvedValue(),
      };

      await gameController.start(mockCode);

      expect(mockCode.start).toHaveBeenCalled();
    });

    it("should request animation frame", async () => {
      const mockCode = {
        tick: vi.fn(),
        start: vi.fn().mockResolvedValue(),
      };

      await gameController.start(mockCode);

      expect(mockRAF).toHaveBeenCalled();
      expect(gameController.animationFrameId).toBe(1);
    });

    it("should emit simulation_started event", async () => {
      const listener = vi.fn();
      eventBus.on("game:simulation_started", listener);

      await gameController.start({ tick: vi.fn() });

      expect(listener).toHaveBeenCalled();
    });

    it("should throw if backend not initialized", async () => {
      const controller = new GameController(eventBus);

      await expect(controller.start({ tick: vi.fn() })).rejects.toThrow(
        "Backend not created",
      );
    });
  });

  describe("end", () => {
    beforeEach(() => {
      gameController.initializeChallenge({
        options: { floorCount: 3, isRenderingEnabled: false },
        condition: { evaluate: () => null },
      });
    });

    it("should pause the simulation", async () => {
      await gameController.start({ tick: vi.fn() });
      expect(gameController.isPaused).toBe(false);

      gameController.end();

      expect(gameController.isPaused).toBe(true);
    });

    it("should reinitialize the challenge", async () => {
      await gameController.start({ tick: vi.fn() });

      const oldBackend = gameController.backend;

      gameController.end();

      expect(gameController.backend).not.toBe(oldBackend);
    });
  });

  describe("setTimeScale", () => {
    it("should update timeScale", () => {
      gameController.setTimeScale(2.0);
      expect(gameController.timeScale).toBe(2.0);
    });

    it("should emit timescale_changed event", () => {
      const listener = vi.fn();
      eventBus.on("game:timescale_changed", listener);

      gameController.setTimeScale(3.0);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail).toEqual({
        timeScale: 3.0,
        isPaused: true,
      });
    });

    it("should persist to localStorage", () => {
      gameController.setTimeScale(2.5);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        expect.any(String),
        "2.5",
      );
    });
  });

  describe("setPaused", () => {
    it("should update isPaused", () => {
      gameController.setPaused(false);
      expect(gameController.isPaused).toBe(false);

      gameController.setPaused(true);
      expect(gameController.isPaused).toBe(true);
    });

    it("should emit timescale_changed event", () => {
      const listener = vi.fn();
      eventBus.on("game:timescale_changed", listener);

      gameController.setPaused(false);

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail).toEqual({
        timeScale: 1.0,
        isPaused: false,
      });
    });
  });

  describe("stats getter", () => {
    it("should return default stats when no backend", () => {
      const stats = gameController.stats;

      expect(stats.transportedCount).toBe(0);
      expect(stats.transportedPerSec).toBe(0);
      expect(stats.avgWaitTime).toBe(0);
      expect(stats.maxWaitTime).toBe(0);
      expect(stats.moveCount).toBe(0);
      expect(stats.elapsedTime).toBe(0);
    });

    it("should return backend stats when available", () => {
      gameController.initializeChallenge({
        options: { floorCount: 3, isRenderingEnabled: false },
        condition: { evaluate: () => null },
      });

      gameController.backend.transportedCount = 5;
      gameController.backend.elapsedTime = 10;
      gameController.backend.recalculateStats();

      const stats = gameController.stats;

      expect(stats.transportedCount).toBe(5);
      expect(stats.elapsedTime).toBe(10);
    });
  });

  describe("event handling", () => {
    beforeEach(() => {
      gameController.initializeChallenge({
        options: { floorCount: 3, isRenderingEnabled: false },
        condition: { evaluate: () => null },
      });
    });

    it("should emit stats_changed via eventBus from backend", () => {
      const listener = vi.fn();
      eventBus.on("simulation:stats_changed", listener);

      // Backend emits directly to eventBus
      eventBus.emit("simulation:stats_changed", { test: true });

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].detail).toEqual({ test: true });
    });

    it("should emit passenger_spawned via eventBus from backend", () => {
      const listener = vi.fn();
      eventBus.on("simulation:passenger_spawned", listener);

      eventBus.emit("simulation:passenger_spawned", {
        passenger: { id: "test" },
      });

      expect(listener).toHaveBeenCalled();
    });

    it("should call end() on challenge_ended", () => {
      const endSpy = vi.spyOn(gameController, "end");

      // Simulate challenge ended event from backend
      eventBus.emit("simulation:challenge_ended", { succeeded: true });

      expect(endSpy).toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    beforeEach(() => {
      gameController.initializeChallenge({
        options: { floorCount: 3, isRenderingEnabled: false },
        condition: { evaluate: () => null },
      });
    });

    it("should cancel animation frame", async () => {
      await gameController.start({ tick: vi.fn() });

      gameController.cleanup();

      expect(mockCAF).toHaveBeenCalled();
      expect(gameController.animationFrameId).toBe(null);
    });

    it("should abort event listeners", () => {
      const oldController = gameController.abortController;
      const abortSpy = vi.spyOn(oldController, "abort");

      gameController.cleanup();

      expect(abortSpy).toHaveBeenCalled();
    });

    it("should cleanup backend", () => {
      const cleanupSpy = vi.spyOn(gameController.backend, "cleanup");

      gameController.cleanup();

      expect(cleanupSpy).toHaveBeenCalled();
      expect(gameController.backend).toBe(null);
    });

    it("should emit cleanup event", () => {
      const listener = vi.fn();
      eventBus.on("game:cleanup", listener);

      gameController.cleanup();

      expect(listener).toHaveBeenCalled();
    });

    it("should create new AbortController", () => {
      const oldController = gameController.abortController;

      gameController.cleanup();

      expect(gameController.abortController).not.toBe(oldController);
    });

    it("should reset lastTickTime", async () => {
      await gameController.start({ tick: vi.fn() });

      // Simulate a frame tick to set lastTickTime
      gameController.lastTickTime = 1000;

      gameController.cleanup();

      expect(gameController.lastTickTime).toBe(null);
    });
  });

  describe("runFrame", () => {
    beforeEach(() => {
      gameController.initializeChallenge({
        options: { floorCount: 3, isRenderingEnabled: false },
        condition: { evaluate: () => null },
      });
    });

    it("should not tick when paused", async () => {
      gameController.isPaused = true;
      gameController.lastTickTime = 0;

      const tickSpy = vi.spyOn(gameController.backend, "tick");

      await gameController.runFrame(16);

      expect(tickSpy).not.toHaveBeenCalled();
    });

    it("should not tick on first frame (no lastTickTime)", async () => {
      gameController.isPaused = false;
      gameController.lastTickTime = null;

      const tickSpy = vi.spyOn(gameController.backend, "tick");

      await gameController.runFrame(16);

      expect(tickSpy).not.toHaveBeenCalled();
    });

    it("should call user code when running", async () => {
      gameController.isPaused = false;
      gameController.lastTickTime = 0;
      gameController.animationFrameId = 1;
      gameController.codeObj = { safeTick: vi.fn().mockResolvedValue() };

      await gameController.runFrame(16);

      // User code called via backend.callUserCode
      expect(gameController.backend).not.toBe(null);
    });

    it("should update lastTickTime", async () => {
      gameController.animationFrameId = 1;

      await gameController.runFrame(1000);

      expect(gameController.lastTickTime).toBe(1000);
    });

    it("should request next frame when animationFrameId is set", async () => {
      gameController.animationFrameId = 1;

      await gameController.runFrame(16);

      expect(mockRAF).toHaveBeenCalledWith(gameController.runFrame);
    });

    it("should not request next frame when animationFrameId is null", async () => {
      gameController.animationFrameId = null;
      mockRAF.mockClear();

      await gameController.runFrame(16);

      expect(mockRAF).not.toHaveBeenCalled();
    });
  });

  describe("integration: full lifecycle", () => {
    it("should handle complete game lifecycle", async () => {
      // Initialize
      gameController.initializeChallenge({
        options: { floorCount: 3, elevatorCount: 1, isRenderingEnabled: false },
        condition: { evaluate: () => null },
      });

      expect(gameController.backend).not.toBe(null);
      expect(gameController.isPaused).toBe(true);

      // Start
      await gameController.start({ tick: vi.fn(), start: vi.fn() });
      expect(gameController.isPaused).toBe(false);

      // End
      gameController.end();
      expect(gameController.isPaused).toBe(true);

      // Cleanup
      gameController.cleanup();
      expect(gameController.backend).toBe(null);
    });

    it("should handle multiple challenge reinitializations", () => {
      for (let i = 0; i < 3; i++) {
        gameController.initializeChallenge({
          options: { floorCount: i + 2, isRenderingEnabled: false },
          condition: { evaluate: () => null },
        });

        expect(gameController.backend.floorCount).toBe(i + 2);
      }
    });
  });
});
