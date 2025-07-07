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

// Fake frame requester helper used for testing and fitness simulations
export function createFrameRequester(timeStep) {
  let currentT = 0.0;
  let currentCb = null;

  const requester = {
    get currentT() {
      return currentT;
    },
    register(cb) {
      currentCb = cb;
    },
    trigger() {
      currentT += timeStep;
      if (currentCb !== null) {
        currentCb(currentT);
      }
    },
  };
  return requester;
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

export class Observable {
  constructor() {
    this.callbacks = {};
  }

  on(events, fn) {
    let count = 0;
    for (let i = 0, len = events.length; i < len; ++i) {
      let name = "";
      const i2 = events.indexOf(" ", i);
      if (i2 < 0) {
        if (i < events.length) {
          name = events.slice(i);
          count++;
        }
        i = len;
      } else if (i2 - i > 1) {
        name = events.slice(i, i2);
        count++;
        i = i2;
      }
      if (name.length > 0) {
        (this.callbacks[name] = this.callbacks[name] || []).push(fn);
      }
    }
    fn.typed = count > 1;
    return this;
  }

  off(events, fn) {
    if (events === "*") {
      this.callbacks = {};
    } else if (fn) {
      const fns = this.callbacks[events];
      if (fns) {
        const index = fns.indexOf(fn);
        if (index !== -1) {
          fns.splice(index, 1);
        }
      }
    } else {
      for (let i = 0, len = events.length; i < len; ++i) {
        let name = "";
        const i2 = events.indexOf(" ", i);
        if (i2 < 0) {
          if (i < events.length) {
            name = events.slice(i);
          }
          i = len;
        } else if (i2 - i > 1) {
          name = events.slice(i, i2);
          i = i2;
        }
        if (name.length > 0) {
          this.callbacks[name] = undefined;
        }
      }
    }
    return this;
  }

  one(name, fn) {
    fn.one = true;
    return this.on(name, fn);
  }

  trigger(name, arg1, arg2, arg3, arg4) {
    const fns = this.callbacks[name];
    if (!fns) {
      return this;
    }

    // Create a copy to avoid issues with modifications during iteration
    const fnsCopy = fns.slice();
    for (let i = 0; i < fnsCopy.length; i++) {
      const fn = fnsCopy[i];
      // Check if function still exists in original array (it might have been removed)
      if (fns.indexOf(fn) === -1) {
        continue;
      }

      if (fn.typed) {
        fn.call(this, name, arg1, arg2, arg3, arg4);
      } else {
        fn.call(this, arg1, arg2, arg3, arg4);
      }
      if (fn.one) {
        const index = fns.indexOf(fn);
        if (index !== -1) {
          fns.splice(index, 1);
        }
        fn.one = false;
      }
    }
    return this;
  }
}

// Random number utilities (replacing lodash)
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Array utilities (replacing lodash)
export function range(start, end) {
  if (arguments.length === 1) {
    end = start;
    start = 0;
  }
  const result = [];
  for (let i = start; i < end; i++) {
    result.push(i);
  }
  return result;
}

export function sum(array) {
  return array.reduce((acc, val) => acc + val, 0);
}

export function sortBy(array, iteratee) {
  return [...array].sort((a, b) => {
    const aVal = typeof iteratee === "function" ? iteratee(a) : a[iteratee];
    const bVal = typeof iteratee === "function" ? iteratee(b) : b[iteratee];
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });
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
