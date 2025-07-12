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

export class Movable extends EventTarget {
  constructor() {
    super();

    this.x = 0.0;
    this.y = 0.0;
    this.parent = null;
    this.worldX = 0.0;
    this.worldY = 0.0;
    this.currentTask = NOOP;
    this.dispatchEvent(new CustomEvent("new_state", { detail: this }));
  }

  updateDisplayPosition(forceTrigger) {
    this.getWorldPosition(_tmpPosStorage);
    const oldX = this.worldX;
    const oldY = this.worldY;
    this.worldX = _tmpPosStorage[0];
    this.worldY = _tmpPosStorage[1];
    if (oldX !== this.worldX || oldY !== this.worldY || forceTrigger === true) {
      this.dispatchEvent(
        new CustomEvent("new_display_state", { detail: this }),
      );
    }
  }

  moveTo(newX, newY) {
    this.x = newX ?? this.x;
    this.y = newY ?? this.y;
    this.dispatchEvent(new CustomEvent("new_state", { detail: this }));
  }

  isBusy() {
    return this.currentTask !== NOOP;
  }

  makeSureNotBusy() {
    if (this.isBusy()) {
      throw new Error("Object is busy - you should use callback");
    }
  }

  wait(millis, cb) {
    this.makeSureNotBusy();
    let timeSpent = 0.0;
    this.currentTask = (dt) => {
      timeSpent += dt;
      if (timeSpent > millis) {
        this.currentTask = NOOP;
        if (cb) {
          cb();
        }
      }
    };
  }

  moveToOverTime(newX, newY, timeToSpend, interpolator, cb) {
    this.makeSureNotBusy();
    newX ??= this.x;
    newY ??= this.y;
    interpolator ??= DEFAULT_INTERPOLATOR;

    const origX = this.x;
    const origY = this.y;
    let timeSpent = 0.0;
    this.currentTask = (dt) => {
      timeSpent = Math.min(timeToSpend, timeSpent + dt);
      if (timeSpent === timeToSpend) {
        this.moveTo(newX, newY);
        this.currentTask = NOOP;
        if (cb) {
          cb();
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

  tick(dt) {
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
