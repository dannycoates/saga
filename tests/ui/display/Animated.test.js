import { describe, it, expect, beforeEach, vi } from "vitest";
import { Animated } from "../../../src/ui/display/Animated.js";

const timeForwarder = function (dt, stepSize, fn) {
  let accumulated = 0.0;
  while (accumulated < dt) {
    accumulated += stepSize;
    fn(stepSize);
  }
};

describe("Animated class", () => {
  let m;
  let handlers;

  beforeEach(() => {
    m = new Animated();
    handlers = {
      someHandler: vi.fn(),
      someOtherHandler: vi.fn(),
    };
  });

  it("disallows incorrect creation", () => {
    const faultyCreation = () => {
      // Call without 'new' by using Function.prototype.call
      Animated.call({});
    };
    expect(faultyCreation).toThrow();
  });

  it("updates display position when told to", () => {
    m.moveTo(1.0, 1.0);
    m.syncUIComponent();
    expect(m.worldX).toBe(1.0);
    expect(m.worldY).toBe(1.0);
  });

  it("does not update display position when moved", () => {
    m.moveTo(1.0, 1.0);
    expect(m.worldX).toBe(0.0);
    expect(m.worldY).toBe(0.0);
  });

  it("retains x pos when moveTo x is null", () => {
    m.moveTo(1.0, 1.0);
    m.moveTo(null, 2.0);
    expect(m.x).toBe(1.0);
  });

  it("retains y pos when moveTo y is null", () => {
    m.moveTo(1.0, 1.0);
    m.moveTo(2.0, null);
    expect(m.y).toBe(1.0);
  });

  it("gets new display position when parent is moved", () => {
    const mParent = new Animated();
    m.setParent(mParent);
    mParent.moveTo(2.0, 3.0);
    m.syncUIComponent();
    expect(m.x).toBe(0.0);
    expect(m.y).toBe(0.0);
    expect(m.worldX).toBe(2.0);
    expect(m.worldY).toBe(3.0);
  });

  it("moves to destination over time", () => {
    m.moveToOverTime(2.0, 3.0, 10.0, undefined, handlers.someHandler);
    timeForwarder(10.0, 0.1, (dt) => {
      m.tick(dt);
    });
    expect(m.x).toBe(2.0);
    expect(m.y).toBe(3.0);
    expect(handlers.someHandler).toHaveBeenCalled();
  });

  it("maintains world position when setting parent", () => {
    const parent = new Animated();
    parent.moveTo(5.0, 5.0);

    m.moveTo(10.0, 10.0);
    m.setParent(parent);

    // Object should maintain its world position
    const worldPos = [0, 0];
    m.getWorldPosition(worldPos);
    expect(worldPos[0]).toBe(10.0);
    expect(worldPos[1]).toBe(10.0);

    // But local position should be adjusted
    expect(m.x).toBe(5.0);
    expect(m.y).toBe(5.0);
  });

  it("cancels animation without invoking callback", () => {
    m.moveToOverTime(10.0, 10.0, 5.0, undefined, handlers.someHandler);
    expect(m.isBusy()).toBe(true);

    m.cancelAnimation(false);

    expect(m.isBusy()).toBe(false);
    expect(handlers.someHandler).not.toHaveBeenCalled();
  });

  it("cancels animation and invokes callback when requested", () => {
    m.moveToOverTime(10.0, 10.0, 5.0, undefined, handlers.someHandler);
    expect(m.isBusy()).toBe(true);

    m.cancelAnimation(true);

    expect(m.isBusy()).toBe(false);
    expect(handlers.someHandler).toHaveBeenCalledTimes(1);
  });

  it("does nothing when cancelling with no active animation", () => {
    expect(m.isBusy()).toBe(false);

    // Should not throw
    m.cancelAnimation(true);

    expect(m.isBusy()).toBe(false);
  });

  it("invokes previous callback when starting new animation", () => {
    m.moveToOverTime(10.0, 10.0, 5.0, undefined, handlers.someHandler);
    m.moveToOverTime(20.0, 20.0, 5.0, undefined, handlers.someOtherHandler);

    // First callback should have been invoked
    expect(handlers.someHandler).toHaveBeenCalledTimes(1);
    // Second callback not yet
    expect(handlers.someOtherHandler).not.toHaveBeenCalled();
  });
});
