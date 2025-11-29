/**
 * Shared utilities for cross-layer use.
 * These functions are general-purpose and don't belong to any specific layer.
 */

/**
 * Generates a random integer in the inclusive range [min, max].
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Creates a throttled version of a function that limits execution frequency.
 * The function will be called at most once per `wait` milliseconds.
 * @template {(...args: any[]) => any} T
 * @param {T} func - Function to throttle
 * @param {number} wait - Minimum time between calls in milliseconds
 * @returns {T} Throttled function
 */
export function throttle(func, wait) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timeout;
  /** @type {number} */
  let previous = 0;

  return /** @type {T} */ (function throttled() {
    const now = Date.now();
    const remaining = wait - (now - previous);
    const context = this;
    const args = arguments;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
      previous = now;
      func.apply(context, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = undefined;
        func.apply(context, args);
      }, remaining);
    }
  });
}
