// Utility functions
export function limitNumber(num, min, max) {
  return Math.min(max, Math.max(num, min));
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
