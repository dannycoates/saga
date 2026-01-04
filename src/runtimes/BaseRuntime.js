/**
 * @typedef {'javascript' | 'python' | 'java' | 'zig'} LanguageId
 */

/**
 * @typedef {Object} ElevatorAPI
 * @property {number} currentFloor - Current floor number
 * @property {number | null} destinationFloor - Destination floor or null if idle
 * @property {number[]} pressedFloorButtons - Array of pressed floor button numbers
 * @property {number} percentFull - Load percentage (0-1)
 * @property {(floorNum: number) => void} goToFloor - Command elevator to go to floor
 */

/**
 * @typedef {Object} FloorAPI
 * @property {{up: boolean, down: boolean}} buttons - Call button states
 * @property {number} level - Floor number
 */

/**
 * Abstract base class for language runtimes.
 * Provides the common interface for loading and executing user code.
 *
 * @abstract
 */
export class BaseRuntime {
  /**
   * Creates a runtime instance.
   * @param {LanguageId} language - Language identifier
   */
  constructor(language) {
    /** @type {LanguageId} Language identifier */
    this.language = language;
    /** @type {boolean} Whether runtime is fully loaded and ready */
    this.isLoaded = false;
    /** @type {boolean} Whether runtime is currently loading */
    this.isLoading = false;
    /** @type {string | null} Currently loaded user code */
    this.loadedCode = null;
  }

  /**
   * Loads the runtime environment (e.g., Python interpreter, Java VM).
   * @abstract
   * @returns {Promise<void>}
   */
  async loadRuntime() {
    throw new Error("load() must be implemented by subclass");
  }

  /**
   * Called when simulation starts, after code is loaded.
   * Override to perform runtime-specific initialization.
   * @returns {Promise<void>}
   */
  async start() {
    // do nothing by default
  }

  /**
   * Loads and compiles user code for execution.
   * @abstract
   * @param {string} code - User code to load
   * @returns {Promise<void>}
   */
  async loadCode(code) {
    throw new Error("loadCode() must be implemented by subclass");
  }

  /**
   * Executes the user's tick function with current game state.
   * @abstract
   * @param {ElevatorAPI[]} elevators - Array of elevator API objects
   * @param {FloorAPI[]} floors - Array of floor API objects
   * @returns {Promise<void>}
   */
  async execute(elevators, floors) {
    throw new Error("execute() must be implemented by subclass");
  }

  /**
   * Gets the default code template for this language.
   * @abstract
   * @returns {string} Default template code
   */
  getDefaultTemplate() {
    throw new Error("getDefaultTemplate() must be implemented by subclass");
  }

  /**
   * Cleans up runtime resources.
   * Override in subclass if additional cleanup is needed.
   * @returns {void}
   */
  cleanup() {
    this.loadedCode = null;
    // Override in subclass if cleanup is needed
  }
}
