import { ViewModel } from "./ViewModel.js";

/**
 * Interpolation function type for animations.
 * @callback InterpolatorFunction
 * @param {number} value0 - Start value
 * @param {number} value1 - End value
 * @param {number} x - Progress (0 to 1)
 * @returns {number} Interpolated value
 */

/**
 * Power-based interpolation with adjustable exponent.
 * @type {(value0: number, value1: number, x: number, a: number) => number}
 */
const POW_INTERPOLATE = function (value0, value1, x, a) {
  return (
    value0 +
    ((value1 - value0) * Math.pow(x, a)) / (Math.pow(x, a) + Math.pow(1 - x, a))
  );
};

/**
 * Smooth easing interpolation using power curve with exponent 1.3.
 * @type {InterpolatorFunction}
 */
const COOL_INTERPOLATE = function (value0, value1, x) {
  return POW_INTERPOLATE(value0, value1, x, 1.3);
};

/** @type {InterpolatorFunction} Default interpolator for animations */
const DEFAULT_INTERPOLATOR = COOL_INTERPOLATE;

/** @type {(dt: number) => void} No-operation function for idle state */
const NOOP = function (_) {};

/** @type {[number, number]} Temporary storage for world position calculations */
const TMP_POS_STORAGE = [0, 0];

/**
 * View model with position, parenting, and animation capabilities.
 * Supports smooth movement over time and hierarchical positioning.
 *
 * @extends ViewModel
 * @fires AnimatedViewModel#new_display_state - Emitted when position changes
 */
export class AnimatedViewModel extends ViewModel {
  constructor() {
    super();

    /** @type {number} Local X position */
    this.x = 0.0;
    /** @type {number} Local Y position */
    this.y = 0.0;
    /** @type {AnimatedViewModel | null} Parent object for hierarchical positioning */
    this.parent = null;
    /** @type {number} Computed world X position */
    this.worldX = 0.0;
    /** @type {number} Computed world Y position */
    this.worldY = 0.0;
    /** @type {(dt: number) => void} Current animation task */
    this.currentTask = NOOP;
    /** @type {(() => void) | undefined} Animation completion callback */
    this.cb = undefined;
  }

  /**
   * Synchronizes UI component with current world position.
   * Only dispatches event if position has changed or forced.
   * @override
   * @param {boolean} [forceTrigger] - Force event dispatch even if position unchanged
   * @returns {void}
   */
  syncUIComponent(forceTrigger) {
    this.getWorldPosition(TMP_POS_STORAGE);
    const oldX = this.worldX;
    const oldY = this.worldY;
    this.worldX = TMP_POS_STORAGE[0];
    this.worldY = TMP_POS_STORAGE[1];
    if (oldX !== this.worldX || oldY !== this.worldY || forceTrigger === true) {
      // UI components listen for this to update visual positions
      this.dispatchEvent(
        new CustomEvent("new_display_state", { detail: this }),
      );
    }
  }

  /**
   * Immediately sets local position.
   * @param {number | null | undefined} newX - New X position (null/undefined keeps current)
   * @param {number | null | undefined} newY - New Y position (null/undefined keeps current)
   * @returns {void}
   */
  moveTo(newX, newY) {
    this.x = newX ?? this.x;
    this.y = newY ?? this.y;
  }

  /**
   * Checks if an animation is currently running.
   * @returns {boolean} True if animating
   */
  isBusy() {
    return this.currentTask !== NOOP;
  }

  /**
   * Cancels any running animation and optionally invokes the callback.
   * @param {boolean} [invokeCallback=false] - Whether to invoke the completion callback
   * @returns {void}
   */
  cancelAnimation(invokeCallback = false) {
    if (this.isBusy()) {
      this.currentTask = NOOP;
      if (invokeCallback && this.cb) {
        this.cb();
      }
      this.cb = undefined;
    }
  }

  /**
   * Animates movement to a target position over time.
   * Cancels any existing animation and calls its callback.
   * @param {number | null | undefined} newX - Target X (null/undefined keeps current)
   * @param {number | null | undefined} newY - Target Y (null/undefined keeps current)
   * @param {number} timeToSpend - Duration in seconds
   * @param {InterpolatorFunction} [interpolator] - Easing function
   * @param {() => void} [cb] - Completion callback
   * @returns {void}
   */
  moveToOverTime(newX, newY, timeToSpend, interpolator, cb) {
    this.cancelAnimation(true);
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

  /**
   * Advances animation by time delta.
   * @override
   * @param {number} [dt=0] - Time delta in seconds
   * @returns {void}
   */
  tick(dt = 0) {
    this.currentTask(dt);
  }

  /**
   * Computes world position by traversing parent chain.
   * @param {[number, number]} storage - Array to store [x, y] result
   * @returns {void}
   */
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

  /**
   * Sets or clears the parent object for hierarchical positioning.
   * Automatically adjusts local position to maintain world position.
   * @param {AnimatedViewModel | null} movableParent - New parent or null to clear
   * @returns {void}
   */
  setParent(movableParent) {
    /** @type {[number, number]} */
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
      /** @type {[number, number]} */
      const parentWorld = [0, 0];
      movableParent.getWorldPosition(parentWorld);
      this.parent = movableParent;
      this.moveTo(objWorld[0] - parentWorld[0], objWorld[1] - parentWorld[1]);
    }
  }
}
