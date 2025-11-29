/**
 * Core simulation utilities.
 * General-purpose utilities (randomInt, throttle) are re-exported from common.js.
 */

// Re-export general utilities for backward compatibility within core layer
export { randomInt, throttle } from "../utils/common.js";

/**
 * Clamps a number to the specified range.
 * @param {number} num - Value to clamp
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} Clamped value
 */
export function limitNumber(num, min, max) {
  return Math.min(max, Math.max(num, min));
}
