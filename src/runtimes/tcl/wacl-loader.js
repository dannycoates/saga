/**
 * ES Module wrapper for WACL (WebAssembly Tcl).
 * Converts AMD-style wacl.js to ES module by shimming RequireJS.
 */

/**
 * @typedef {Object} AMDDefine
 * @property {boolean} [amd]
 */

/**
 * @typedef {Object} AMDRequire
 * @property {(path: string) => string} toUrl
 */

/**
 * Window with AMD globals for RequireJS compatibility.
 * @typedef {Window & { require?: AMDRequire, define?: AMDDefine & Function }} AMDWindow
 */

/** @type {AMDWindow} */
const amdWindow = /** @type {any} */ (window);

/**
 * Base URL for Tcl assets (wacl.wasm, wacl-library.data).
 * Uses Vite's __BASE_URL__ for correct path resolution.
 */
const TCL_BASE_URL = `${__BASE_URL__}tcl/`;

/**
 * Loads the WACL Tcl interpreter.
 *
 * @returns {Promise<Object>} Promise resolving to the wacl interpreter object with:
 *   - Eval(tclCode): Execute Tcl code and return result string
 *   - jswrap(fn, returnType, argType): Wrap JS function for Tcl to call
 *   - str2ptr(string): Convert JS string to Tcl pointer
 *   - ptr2str(pointer): Convert Tcl pointer to JS string
 *   - stdout/stderr: Setters to redirect output
 */
export function loadWacl() {
  return new Promise((resolve, reject) => {
    // Store original globals to restore later
    const originalRequire = amdWindow.require;
    const originalDefine = amdWindow.define;

    // Mock RequireJS's require.toUrl for path resolution
    amdWindow.require = {
      toUrl: (path) => {
        // "tcl/" -> base URL for assets
        if (path === "tcl/") return TCL_BASE_URL;
        return TCL_BASE_URL + path.replace(/^tcl\//, "");
      },
    };

    // Shim AMD define() to capture the module
    const define = /** @type {AMDDefine & Function} */ (
      function (_name, factory) {
        // Mark as AMD-compatible (some modules check this)
        define.amd = true;

        try {
          // Execute the factory function - returns { onReady: fn }
          const waclModule = factory();

          // Use onReady to get the interpreter when it's initialized
          waclModule.onReady((/** @type {Object} */ interp) => {
            // Restore original globals
            amdWindow.require = originalRequire;
            amdWindow.define = originalDefine;

            resolve(interp);
          });
        } catch (e) {
          // Restore on error
          amdWindow.require = originalRequire;
          amdWindow.define = originalDefine;
          reject(e);
        }
      }
    );
    define.amd = true;
    amdWindow.define = define;

    // Load wacl.js as a script
    const script = document.createElement("script");
    script.src = TCL_BASE_URL + "wacl.js";
    script.onerror = () => {
      // Restore on error
      amdWindow.require = originalRequire;
      amdWindow.define = originalDefine;
      reject(new Error("Failed to load wacl.js"));
    };

    document.head.appendChild(script);
  });
}
