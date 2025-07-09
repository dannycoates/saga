// Utility functions
export function limitNumber(num, min, max) {
  return Math.min(max, Math.max(num, min));
}

export function epsilonEquals(a, b) {
  return Math.abs(a - b) < 0.00000001;
}

export function distanceNeededToAchieveSpeed(
  currentSpeed,
  targetSpeed,
  acceleration,
) {
  // v² = u² + 2a * d
  const requiredDistance =
    (Math.pow(targetSpeed, 2) - Math.pow(currentSpeed, 2)) / (2 * acceleration);
  return requiredDistance;
}

export function accelerationNeededToAchieveChangeDistance(
  currentSpeed,
  targetSpeed,
  distance,
) {
  // v² = u² + 2a * d
  const requiredAcceleration =
    0.5 * ((Math.pow(targetSpeed, 2) - Math.pow(currentSpeed, 2)) / distance);
  return requiredAcceleration;
}

export async function getCodeObjFromCode(code) {
  // Use vite-ignore comment to suppress warning about dynamic import
  const obj = await import(
    /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code.trim())}`
  );
  if (typeof obj.update !== "function") {
    throw "Code must contain an update function";
  }
  return obj;
}

// Random number utilities (replacing lodash)
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function range(start, end) {
  if (arguments.length === 1) {
    end = start;
    start = 0;
  }
  return Array.from({ length: end - start }, (_, i) => start + i);
}

// Throttle implementation (replacing lodash)
export function throttle(func, wait) {
  let timeout;
  let previous = 0;

  return function throttled() {
    const now = Date.now();
    const remaining = wait - (now - previous);
    const context = this;
    const args = arguments;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(context, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func.apply(context, args);
      }, remaining);
    }
  };
}
