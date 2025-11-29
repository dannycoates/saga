import { BaseRuntime } from "./BaseRuntime.js";
import { loadExternalScript, executeWithTimeout } from "../utils/AsyncUtils.js";

/**
 * @typedef {import('./BaseRuntime.js').ElevatorAPI} ElevatorAPI
 * @typedef {import('./BaseRuntime.js').FloorAPI} FloorAPI
 */

/**
 * Base Python code that provides wrapper classes for the elevator API.
 * Converts JavaScript objects to Python-friendly objects with snake_case naming.
 * @type {string}
 */
const BASE_PYTHON_CODE = `
import js

class ElevatorAPI:
    def __init__(self, js_elevator):
        self._js_elevator = js_elevator

    @property
    def current_floor(self):
        return self._js_elevator.currentFloor

    @property
    def destination_floor(self):
        return self._js_elevator.destinationFloor

    @property
    def pressed_floor_buttons(self):
        return list(self._js_elevator.pressedFloorButtons)

    @property
    def percent_full(self):
        return self._js_elevator.percentFull

    def go_to_floor(self, floor_num):
        self._js_elevator.goToFloor(floor_num)

class FloorAPI:
    def __init__(self, js_floor):
        self._js_floor = js_floor

    @property
    def buttons(self):
        class Buttons:
            def __init__(self, js_buttons):
                self._js_buttons = js_buttons

            @property
            def up(self):
                return self._js_buttons.up

            @property
            def down(self):
                return self._js_buttons.down

        return Buttons(self._js_floor.buttons)

    @property
    def level(self):
        return self._js_floor.level

# Global variable to store the tick function
_tick_function = None

def _wrap_elevators(js_elevators):
    return [ElevatorAPI(elevator) for elevator in js_elevators]

def _wrap_floors(js_floors):
    return [FloorAPI(floor) for floor in js_floors]

def _execute_tick(js_elevators, js_floors):
    if _tick_function is None:
        raise Exception("No tick function defined")

    elevators = _wrap_elevators(js_elevators)
    floors = _wrap_floors(js_floors)

    return _tick_function(elevators, floors)

`;

/**
 * Python runtime using Pyodide for in-browser Python execution.
 * Provides snake_case API wrappers for the elevator game.
 *
 * @extends BaseRuntime
 */
export class PythonRuntime extends BaseRuntime {
  /**
   * Creates a Python runtime instance.
   */
  constructor() {
    super("python");
    /** @type {any} Pyodide instance */
    this.pyodide = null;
  }

  /**
   * Loads the Pyodide runtime and initializes Python environment.
   * @override
   * @returns {Promise<void>}
   * @throws {Error} If Pyodide fails to load
   */
  async loadRuntime() {
    if (this.isLoading || this.isLoaded) return;
    this.isLoading = true;
    try {
      // Load Pyodide script
      // Use enhanced script loading with timeout
      await loadExternalScript(
        "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js",
        30000, // 30 second timeout
      );

      // Now loadPyodide should be available globally
      if (typeof loadPyodide === "undefined") {
        throw new Error("loadPyodide is not defined after script load");
      }

      // Load Pyodide with timeout protection
      this.pyodide = await executeWithTimeout(
        () =>
          loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/",
          }),
        60000, // 60 second timeout for Pyodide initialization
      );

      // Initialize the Python environment with our API wrapper
      await this.pyodide.runPythonAsync(BASE_PYTHON_CODE);

      this.isLoaded = true;
    } catch (error) {
      throw new Error(`Failed to load Python runtime: ${error.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Loads user Python code and stores the tick function.
   * @override
   * @param {string} code - Python code to load
   * @returns {Promise<void>}
   * @throws {Error} If runtime not loaded or code doesn't define tick function
   */
  async loadCode(code) {
    if (!this.isLoaded) {
      throw new Error("Python runtime not loaded");
    }

    // Set the user's code in the Python environment
    await this.pyodide.runPythonAsync(code);

    // Check if tick function exists
    const hasTick = await this.pyodide.runPythonAsync(
      `\n'tick' in globals()\n`,
    );

    if (!hasTick) {
      throw new Error("Code must define a tick function");
    }

    // Store the tick function
    await this.pyodide.runPythonAsync(`\n_tick_function = tick\n`);

    this.loadedCode = code;
  }

  /**
   * Executes the user's tick function with wrapped elevator and floor objects.
   * @override
   * @param {ElevatorAPI[]} elevators - Array of elevator API objects
   * @param {FloorAPI[]} floors - Array of floor API objects
   * @returns {Promise<void>}
   * @throws {Error} If runtime not loaded or no code loaded
   */
  async execute(elevators, floors) {
    if (!this.isLoaded) {
      throw new Error("Python runtime not loaded");
    }

    if (!this.loadedCode) {
      throw new Error("No code loaded. Call loadCode() first.");
    }

    // Pass JavaScript objects to Python globals
    this.pyodide.globals.set("js_elevators", elevators);
    this.pyodide.globals.set("js_floors", floors);

    // Execute the tick function with wrapped objects
    await this.pyodide.runPythonAsync(
      `\n_execute_tick(js_elevators, js_floors)\n`,
    );
  }

  /**
   * Gets the default Python code template.
   * @override
   * @returns {string} Default template code
   */
  getDefaultTemplate() {
    return `"""
Floor class:
  Attributes:
    buttons.up: bool - True if up button is pressed
    buttons.down: bool - True if down button is pressed
    level: int - Floor number (0-indexed)

Elevator class:
  Attributes:
    current_floor: int - Current floor number
    destination_floor: int | None - Destination floor or None if idle
    pressed_floor_buttons: list[int] - List of pressed floor buttons
    percent_full: float - Load percentage (0.0 to 1.0)

  Methods:
    go_to_floor(floor_num: int) - Command elevator to go to floor
"""
_next_floor = 1

def tick(elevators, floors):
    """
    Tick gets called on a regular, fast interval (a game loop)

    Args:
      elevators: list[Elevator] - List of all elevators
      floors: list[Floor] - List of all floors
    """
    global _next_floor
    elevator = elevators[0]
    if elevator.destination_floor is None:
        if elevator.current_floor == len(floors) - 1:
            _next_floor = 0
        _next_floor += 1
        elevator.go_to_floor(_next_floor)`;
  }

  /**
   * Cleans up the runtime by clearing Pyodide references.
   * @override
   * @returns {void}
   */
  cleanup() {
    if (this.pyodide) {
      try {
        // Clear the tick function in Python
        this.pyodide.runPython("_tick_function = None");
      } catch (e) {
        // Ignore errors during cleanup
      }
      // Clear references
      this.pyodide = null;
      this.isLoaded = false;
      this.loadedCode = null;
    }
  }
}
