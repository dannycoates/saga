import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createWorldController,
  createWorldCreator,
} from "../../src/core/World.js";

// Fake frame requester helper used for testing and fitness simulations
function createFrameRequester(timeStep) {
  let currentT = 0.0;
  let currentCb = null;

  const requester = {
    get currentT() {
      return currentT;
    },
    register(cb) {
      currentCb = cb;
    },
    async trigger() {
      currentT += timeStep;
      if (currentCb !== null) {
        await currentCb(currentT);
      }
    },
  };
  return requester;
}

describe("World controller", () => {
  let controller;
  let fakeWorld;
  let fakeCodeObj;
  let frameRequester;
  const DT_MAX = 1000.0 / 59;

  beforeEach(() => {
    controller = createWorldController(DT_MAX);

    fakeWorld = {
      tick: vi.fn(),
      init: vi.fn(),
      updateDisplayPositions: vi.fn(),
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      challengeEnded: false,
      elevators: [],
      floors: [],
    };

    fakeCodeObj = {
      tick: vi.fn().mockResolvedValue(),
    };

    frameRequester = createFrameRequester(10.0);
  });

  it("does not call tick on first animation frame", async () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    await frameRequester.trigger();
    expect(fakeCodeObj.tick).not.toHaveBeenCalled();
  });

  it("calls tick on subsequent frames", async () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    await frameRequester.trigger();
    await frameRequester.trigger();
    expect(fakeCodeObj.tick).toHaveBeenCalled();
  });

  it("does not call tick when paused", async () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    controller.setPaused(true);
    await frameRequester.trigger();
    await frameRequester.trigger();
    expect(fakeCodeObj.tick).not.toHaveBeenCalled();
  });

  it("initializes world on first tick when unpaused", async () => {
    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, false);
    controller.setPaused(false);
    await frameRequester.trigger();
    await frameRequester.trigger();
    expect(fakeCodeObj.tick).toHaveBeenCalled();
  });

  it("handles user code errors", async () => {
    const error = new Error("User code error");
    fakeCodeObj.tick.mockImplementation(() => {
      throw error;
    });

    const errorHandler = vi.fn();
    controller.addEventListener("usercode_error", (e) =>
      errorHandler(e.detail),
    );

    controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
    await frameRequester.trigger();
    await frameRequester.trigger();

    expect(errorHandler).toHaveBeenCalled();
    expect(errorHandler.mock.calls[0][0]).toBe(error);
    expect(controller.isPaused).toBe(true);
  });
});

describe("World creator", () => {
  let creator;

  beforeEach(() => {
    creator = createWorldCreator();
  });

  it("creates floors with correct properties", () => {
    const floors = creator.createFloors(4, 50);

    expect(floors.length).toBe(4);
    expect(floors[0].level).toBe(0);
    expect(floors[0].yPosition).toBe(150); // (4-1-0) * 50
    expect(floors[3].level).toBe(3);
    expect(floors[3].yPosition).toBe(0); // (4-1-3) * 50
  });

  it("creates elevators with correct properties", () => {
    const elevators = creator.createElevators(2, 5, 50, [4, 6]);

    expect(elevators.length).toBe(2);
    expect(elevators[0].maxUsers).toBe(4);
    expect(elevators[1].maxUsers).toBe(6);
    expect(elevators[0].floorCount).toBe(5);
    expect(elevators[0].floorHeight).toBe(50);
  });

  it("creates random users with correct properties", () => {
    const user = creator.createRandomUser();

    expect(user.weight).toBeGreaterThanOrEqual(55);
    expect(user.weight).toBeLessThanOrEqual(100);
    expect(["child", "female", "male"]).toContain(user.displayType);
  });

  it("creates world with default options", () => {
    const world = creator.createWorld({});

    expect(world.floorHeight).toBe(50);
    expect(world.floors.length).toBe(4);
    expect(world.elevators.length).toBe(2);
    expect(world.users).toEqual([]);
    expect(world.transportedCounter).toBe(0);
  });
});
