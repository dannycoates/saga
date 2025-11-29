import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorldManager } from "../../src/game/WorldManager.js";
import { NullDisplayManager } from "../../src/ui/NullDisplayManager.js";

describe("WorldManager", () => {
  let worldManager;

  beforeEach(() => {
    // Pass NullDisplayManager class for headless testing
    worldManager = new WorldManager(NullDisplayManager);

    // Create a world with the WorldManager
    worldManager.initializeChallenge({
      options: {
        floorCount: 3,
        elevatorCount: 2,
        isRenderingEnabled: false, // Disable for testing
      },
      condition: {
        evaluate: () => null, // Never end during tests
      },
    });
  });

  it("should create world with correct configuration", () => {
    expect(worldManager.backend).toBeDefined();
    expect(worldManager.displayManager).toBeDefined();
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
