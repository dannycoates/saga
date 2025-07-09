import { BaseRuntime } from "./base.js";

export class JavaScriptRuntime extends BaseRuntime {
  constructor() {
    super();
    this.loaded = true; // JavaScript is always available
    this.loadedModule = null;
  }

  async load() {
    // No loading required for native JavaScript
    return;
  }

  async loadCode(code) {
    this.validateCode(code);

    // Import the user's code as an ES module
    this.loadedModule = await import(
      /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code.trim())}`
    );

    if (typeof this.loadedModule.update !== "function") {
      throw new Error("Code must export an update function");
    }

    this.loadedCode = code;
  }

  async execute(elevators, floors) {
    if (!this.loadedModule) {
      throw new Error("No code loaded. Call loadCode() first.");
    }

    // Call the user's update function
    return this.loadedModule.update(elevators, floors);
  }

  validateCode(code) {
    // Basic validation
    if (!code || code.trim().length === 0) {
      throw new Error("Code cannot be empty");
    }

    if (!code.includes("export") || !code.includes("update")) {
      throw new Error("Code must export an update function");
    }
  }

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
  *    @member destinationFloor {number | null}
  *    @member pressedFloorButtons {number[]}
  *    @member percentFull {0..1}
  *
  *   Actions:
  *    @func goToFloor(floorNum: number)
  */
let nextFloor = 1

/**
 * Update gets called on a regular, fast interval (a game loop)
 * @param {Elevator[]} elevators
 * @param {Floor[]} floors
 */
export function update(elevators, floors) {
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

  getLanguage() {
    return "javascript";
  }

  dispose() {
    this.loadedModule = null;
    this.loadedCode = null;
  }
}
