import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorldManager } from "../../src/game/WorldManager.js";
import { AppDOM } from "../../src/ui/AppDOM.js";

describe("WorldManager", () => {
  let worldManager;
  let mockDom;

  beforeEach(() => {
    // Create a mock DOM object
    mockDom = {
      clearElements: vi.fn(),
      getElement: vi.fn().mockReturnValue(document.createElement("div")),
      isRuntimeLoading: vi.fn().mockReturnValue(false),
    };

    worldManager = new WorldManager(mockDom);

    // Create a world with the WorldManager
    worldManager.initializeChallenge({
      floorCount: 3,
      elevatorCount: 2,
      renderingEnabled: false, // Disable for testing
    });
  });

  it("should create world with correct configuration", () => {
    expect(worldManager.backend).toBeDefined();
    expect(worldManager.displayManager).toBeDefined();
  });

  it("should forward tick to backend", () => {
    const tickSpy = vi.spyOn(worldManager.backend, "tick");
    worldManager.tick(0.1);
    expect(tickSpy).toHaveBeenCalledWith(0.1);
  });

  it("should forward user code to backend", async () => {
    const callUserCodeSpy = vi.spyOn(worldManager.backend, "callUserCode");
    const mockCode = { tick: vi.fn() };
    const dt = 1;
    await worldManager.callUserCode(mockCode, dt);
    expect(callUserCodeSpy).toHaveBeenCalledWith(mockCode, dt);
  });
});
