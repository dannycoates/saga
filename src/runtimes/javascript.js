import { BaseRuntime } from "./base.js";

export class JavaScriptRuntime extends BaseRuntime {
  constructor() {
    super("javascript");
    this.loaded = true; // JavaScript is always available
    this.loadedModule = null;
  }

  async loadRuntime() {
    // No loading required for native JavaScript
    return;
  }

  async loadCode(code) {
    // Import the user's code as an ES module
    this.loadedModule = await import(
      /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code.trim())}`
    );

    if (typeof this.loadedModule.tick !== "function") {
      throw new Error("Code must export a tick function");
    }

    this.loadedCode = code;
  }

  async execute(elevators, floors) {
    if (!this.loadedModule) {
      throw new Error("No code loaded. Call loadCode() first.");
    }

    // Call the user's tick function
    return this.loadedModule.tick(elevators, floors);
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

  dispose() {
    this.loadedModule = null;
    this.loadedCode = null;
  }
}
