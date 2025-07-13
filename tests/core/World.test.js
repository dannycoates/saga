import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorldController, WorldCreator } from "../../src/core/World.js";
import { FloorDisplay } from "../../src/ui/display/FloorDisplay.js";
import { ElevatorDisplay } from "../../src/ui/display/ElevatorDisplay.js";
import { PassengerDisplay } from "../../src/ui/display/PassengerDisplay.js";

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
    controller = new WorldController(DT_MAX);

    fakeWorld = {
      tick: vi.fn(),
      init: vi.fn(),
      updateDisplayPositions: vi.fn(),
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      challengeEnded: false,
      elevators: new Map(),
      floors: new Map(),
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
    creator = new WorldCreator();
  });

  it("creates floor models with displays", () => {
    const floors = creator.createFloors(4, FloorDisplay, 50);
    const floorModels = Array.from(floors.keys());
    const floorDisplays = Array.from(floors.values());

    expect(floors.size).toBe(4);
    expect(floorModels[0].level).toBe(0);
    expect(floorDisplays[0]).toBeDefined();
    expect(floorDisplays[0].yPosition).toBe(150); // (4-1-0) * 50
    expect(floorModels[3].level).toBe(3);
    expect(floorDisplays[3].yPosition).toBe(0); // (4-1-3) * 50
  });

  it("creates elevator models with displays", () => {
    const elevators = creator.createElevators(
      2,
      2.6,
      5,
      [4, 6],
      ElevatorDisplay,
    );
    const elevatorModels = Array.from(elevators.keys());
    const elevatorDisplays = Array.from(elevators.values());

    expect(elevators.size).toBe(2);
    expect(elevatorModels[0].capacity).toBe(4);
    expect(elevatorModels[1].capacity).toBe(6);
    expect(elevatorModels[0].MAXFLOOR).toBe(5);
    expect(elevatorDisplays[0]).toBeDefined();
  });

  it("creates random passenger models with displays", () => {
    const { passenger, display } = creator.createRandomPassenger(
      0,
      3,
      PassengerDisplay,
    );

    expect(passenger.weight).toBeGreaterThanOrEqual(55);
    expect(passenger.weight).toBeLessThanOrEqual(100);
    expect(display).toBeDefined();
    expect(["child", "female", "male"]).toContain(display.displayType);
  });

  it("creates world with default options", () => {
    const world = creator.createWorld({});

    expect(world.floorHeight).toBe(50);
    expect(world.floors.size).toBe(4);
    expect(world.elevators.size).toBe(2);
    expect(world.passengers.size).toBe(0);
    expect(world.transportedCounter).toBe(0);
  });
});
