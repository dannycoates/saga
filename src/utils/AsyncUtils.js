/**
 * Modern Async Utilities - Enhanced patterns with AbortController, Promise.race, and timeout handling
 */

/**
 * Load external script with timeout and abort support
 * @param {string} src - Script source URL
 * @param {number} timeout - Timeout in milliseconds (default: 30s)
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<void>}
 */
export async function loadExternalScript(src, timeout = 30000, signal = null) {
  const controller = new AbortController();
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  const loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;

    const cleanup = () => {
      script.onload = null;
      script.onerror = null;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    script.onload = () => {
      cleanup();
      resolve();
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load script: ${src}`));
    };

    combinedSignal.addEventListener(
      "abort",
      () => {
        cleanup();
        reject(new Error(`Loading ${src} was aborted`));
      },
      { once: true },
    );

    document.head.appendChild(script);
  });

  const timeoutPromise = new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timeout loading ${src} after ${timeout}ms`));
    }, timeout);

    combinedSignal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
      },
      { once: true },
    );
  });

  return Promise.race([loadPromise, timeoutPromise]);
}

/**
 * Execute a function with timeout protection using AbortController
 * @param {Function} fn - Function to execute (can be async)
 * @param {number} timeout - Timeout in milliseconds
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<any>}
 */
export async function executeWithTimeout(fn, timeout, signal = null) {
  const controller = new AbortController();
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  const executionPromise = (async () => {
    if (combinedSignal.aborted) {
      throw new Error("Operation was aborted before execution");
    }
    return await fn(combinedSignal);
  })();

  const timeoutPromise = new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Operation timeout after ${timeout}ms`));
    }, timeout);

    combinedSignal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeoutId);
      },
      { once: true },
    );
  });

  return Promise.race([executionPromise, timeoutPromise]);
}
