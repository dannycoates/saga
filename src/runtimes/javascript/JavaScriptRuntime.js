import { BaseRuntime } from "../BaseRuntime.js";

/**
 * @typedef {import('../BaseRuntime.js').ElevatorAPI} ElevatorAPI
 * @typedef {import('../BaseRuntime.js').FloorAPI} FloorAPI
 */

/**
 * @typedef {Object} UserModule
 * @property {(elevators: ElevatorAPI[], floors: FloorAPI[]) => void} tick - User's tick function
 */

/**
 * JavaScript runtime for executing user code.
 * Uses ES modules via data URLs for code loading.
 *
 * @extends BaseRuntime
 */
export class JavaScriptRuntime extends BaseRuntime {
  /**
   * Creates a JavaScript runtime.
   * JavaScript is always available, so isLoaded starts as true.
   */
  constructor() {
    super("javascript");
    this.isLoaded = true; // JavaScript is always available
    /** @type {UserModule | null} Loaded user module */
    this.loadedModule = null;
  }

  /**
   * Loads the JavaScript runtime (no-op since JS is native).
   * @override
   * @returns {Promise<void>}
   */
  async loadRuntime() {
    // No loading required for native JavaScript
    return;
  }

  /**
   * Loads user code as an ES module.
   * @override
   * @param {string} code - JavaScript code to load
   * @returns {Promise<void>}
   * @throws {Error} If code doesn't export a tick function
   */
  async loadCode(code) {
    // Import the user's code as an ES module
    this.loadedModule = await import(
      /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code.trim())}`
    );

    if (!this.loadedModule || typeof this.loadedModule.tick !== "function") {
      throw new Error("Code must export a tick function");
    }

    this.loadedCode = code;
  }

  /**
   * Executes the user's tick function.
   * @override
   * @param {ElevatorAPI[]} elevators - Array of elevator API objects
   * @param {FloorAPI[]} floors - Array of floor API objects
   * @returns {Promise<void>}
   * @throws {Error} If no code has been loaded
   */
  async execute(elevators, floors) {
    if (!this.loadedModule) {
      throw new Error("No code loaded. Call loadCode() first.");
    }

    // Call the user's tick function
    return this.loadedModule.tick(elevators, floors);
  }

  /**
   * Gets the default JavaScript code template.
   * @override
   * @returns {string} Default template code
   */
  getDefaultTemplate() {
    return `/**
  * @class Floor
  *   Accessors:
  *    @member buttons {{up: boolean, down: boolean}}
  *    @member level {number}
  *
  * @class Elevator
  *   Accessors:
  *    @member currentFloor {number}
  *    @member destinationFloor {number | null} (null == idle)
  *    @member pressedFloorButtons {number[]}
  *    @member percentFull {0..1}
  *
  *   Actions:
  *    @func goToFloor(floorNum: number)
  */
let nextFloor = 1

/**
 * Tick gets called on a regular, fast interval (a game loop)
 * @param {Elevator[]} elevators
 * @param {Floor[]} floors
 */
export function tick(elevators, floors) {
    const elevator = elevators[0]

    if (elevator.destinationFloor === null) {
        if (nextFloor === floors.length) {
            nextFloor = 0
        }
        nextFloor = nextFloor + 1
        elevator.goToFloor(nextFloor)
    }
}`;
  }

  /**
   * Cleans up the runtime by clearing loaded module.
   * @override
   * @returns {void}
   */
  cleanup() {
    this.loadedModule = null;
    this.loadedCode = null;
  }
}
