import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorldController, World } from "../../src/core/World.js";
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
      callUserCode: vi.fn().mockImplementation(async (codeObj) => {
        await codeObj.tick();
      }),
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
    fakeWorld.callUserCode.mockImplementation(() => {
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
