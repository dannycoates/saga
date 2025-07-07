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

export class Observable extends EventTarget {
  constructor() {
    super();
    this._listeners = new Map();
  }

  on(events, fn) {
    const eventNames = events.split(' ').filter(e => e.length > 0);
    
    const wrappedFn = (event) => {
      const args = event.detail || [];
      if (eventNames.length > 1) {
        fn.call(this, event.type, ...args);
      } else {
        fn.call(this, ...args);
      }
    };
    
    eventNames.forEach(eventName => {
      if (!this._listeners.has(eventName)) {
        this._listeners.set(eventName, new Map());
      }
      this._listeners.get(eventName).set(fn, wrappedFn);
      this.addEventListener(eventName, wrappedFn);
    });
    
    return this;
  }

  off(events, fn) {
    if (events === "*") {
      this._listeners.forEach((fnMap, eventName) => {
        fnMap.forEach(wrappedFn => {
          this.removeEventListener(eventName, wrappedFn);
        });
      });
      this._listeners.clear();
    } else if (fn) {
      const eventNames = events.split(' ').filter(e => e.length > 0);
      eventNames.forEach(eventName => {
        const fnMap = this._listeners.get(eventName);
        if (fnMap && fnMap.has(fn)) {
          const wrappedFn = fnMap.get(fn);
          this.removeEventListener(eventName, wrappedFn);
          fnMap.delete(fn);
        }
      });
    } else {
      const eventNames = events.split(' ').filter(e => e.length > 0);
      eventNames.forEach(eventName => {
        const fnMap = this._listeners.get(eventName);
        if (fnMap) {
          fnMap.forEach(wrappedFn => {
            this.removeEventListener(eventName, wrappedFn);
          });
          this._listeners.delete(eventName);
        }
      });
    }
    return this;
  }

  one(name, fn) {
    const wrappedFn = (...args) => {
      fn.apply(this, args);
      this.off(name, fn);
    };
    return this.on(name, wrappedFn);
  }

  trigger(name, ...args) {
    const event = new CustomEvent(name, { detail: args });
    this.dispatchEvent(event);
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
