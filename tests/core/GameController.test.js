import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameController } from "../../src/game/GameController.js";
import { EventBus } from "../../src/utils/EventBus.js";

describe("GameController", () => {
  let gameController;
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    gameController = new GameController(eventBus);

    // Create a challenge with the GameController
    gameController.initializeChallenge({
      options: {
        floorCount: 3,
        elevatorCount: 2,
        isRenderingEnabled: false,
      },
      condition: {
        evaluate: () => null, // Never end during tests
      },
    });
  });

  it("should create world with correct configuration", () => {
    expect(gameController.backend).toBeDefined();
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
