import { Display } from "./Display.js";

const powInterpolate = function (value0, value1, x, a) {
  return (
    value0 +
    ((value1 - value0) * Math.pow(x, a)) / (Math.pow(x, a) + Math.pow(1 - x, a))
  );
};

const coolInterpolate = function (value0, value1, x) {
  return powInterpolate(value0, value1, x, 1.3);
};

const DEFAULT_INTERPOLATOR = coolInterpolate;
const NOOP = function (_) {};

const _tmpPosStorage = [0, 0];

export class Animated extends Display {
  constructor() {
    super();

    this.x = 0.0;
    this.y = 0.0;
    this.parent = null;
    this.worldX = 0.0;
    this.worldY = 0.0;
    this.currentTask = NOOP;
  }

  syncUIComponent(forceTrigger) {
    this.getWorldPosition(_tmpPosStorage);
    const oldX = this.worldX;
    const oldY = this.worldY;
    this.worldX = _tmpPosStorage[0];
    this.worldY = _tmpPosStorage[1];
    if (oldX !== this.worldX || oldY !== this.worldY || forceTrigger === true) {
      // UI components listen for this to update visual positions
      this.dispatchEvent(
        new CustomEvent("new_display_state", { detail: this }),
      );
    }
  }

  moveTo(newX, newY) {
    this.x = newX ?? this.x;
    this.y = newY ?? this.y;
  }

  isBusy() {
    return this.currentTask !== NOOP;
  }

  moveToOverTime(newX, newY, timeToSpend, interpolator, cb) {
    if (this.isBusy()) {
      this.cb?.();
    }
    newX ??= this.x;
    newY ??= this.y;
    interpolator ??= DEFAULT_INTERPOLATOR;

    const origX = this.x;
    const origY = this.y;
    let timeSpent = 0.0;
    this.cb = cb;
    this.currentTask = (dt) => {
      timeSpent += dt;
      if (timeSpent >= timeToSpend) {
        this.moveTo(newX, newY);
        this.currentTask = NOOP;
        if (this.cb) {
          this.cb();
        }
      } else {
        const factor = timeSpent / timeToSpend;
        this.moveTo(
          interpolator(origX, newX, factor),
          interpolator(origY, newY, factor),
        );
      }
    };
  }

  tick(dt = 0) {
    this.currentTask(dt);
  }

  getWorldPosition(storage) {
    let resultX = this.x;
    let resultY = this.y;
    let currentParent = this.parent;
    while (currentParent !== null) {
      resultX += currentParent.x;
      resultY += currentParent.y;
      currentParent = currentParent.parent;
    }
    storage[0] = resultX;
    storage[1] = resultY;
  }

  setParent(movableParent) {
    const objWorld = [0, 0];
    if (movableParent === null) {
      if (this.parent !== null) {
        this.getWorldPosition(objWorld);
        this.parent = null;
        this.moveTo(objWorld[0], objWorld[1]);
      }
    } else {
      // Parent is being set a non-null movable
      this.getWorldPosition(objWorld);
      const parentWorld = [0, 0];
      movableParent.getWorldPosition(parentWorld);
      this.parent = movableParent;
      this.moveTo(objWorld[0] - parentWorld[0], objWorld[1] - parentWorld[1]);
    }
  }
}
