import { BaseRuntime } from "./base.js";

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

export class PythonRuntime extends BaseRuntime {
  constructor() {
    super("python");
    this.pyodide = null;
  }

  async loadRuntime() {
    if (this.loading || this.loaded) return;
    this.loading = true;
    try {
      // Load Pyodide script
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () =>
          reject(new Error("Failed to load Pyodide script"));
        document.head.appendChild(script);
      });

      // Now loadPyodide should be available globally
      if (typeof loadPyodide === "undefined") {
        throw new Error("loadPyodide is not defined after script load");
      }

      this.pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      });

      // Initialize the Python environment with our API wrapper
      await this.pyodide.runPythonAsync(BASE_PYTHON_CODE);

      this.loaded = true;
    } catch (error) {
      throw new Error(`Failed to load Python runtime: ${error.message}`);
    } finally {
      this.loading = false;
    }
  }

  async loadCode(code) {
    if (!this.loaded) {
      throw new Error("Python runtime not loaded");
    }

    // Set the user's code in the Python environment
    await this.pyodide.runPythonAsync(code);

    // Check if tick function exists
    const hasTick = await this.pyodide.runPythonAsync(`\n'tick' in globals()\n`);

    if (!hasTick) {
      throw new Error("Code must define a tick function");
    }

    // Store the tick function
    await this.pyodide.runPythonAsync(`\n_tick_function = tick\n`);

    this.loadedCode = code;
  }

  async execute(elevators, floors) {
    if (!this.loaded) {
      throw new Error("Python runtime not loaded");
    }

    if (!this.loadedCode) {
      throw new Error("No code loaded. Call loadCode() first.");
    }

    // Pass JavaScript objects to Python globals
    this.pyodide.globals.set("js_elevators", elevators);
    this.pyodide.globals.set("js_floors", floors);

    // Execute the tick function with wrapped objects
    await this.pyodide.runPythonAsync(`\n_execute_tick(js_elevators, js_floors)\n`);
  }

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

  dispose() {
    if (this.pyodide) {
      try {
        // Clear the tick function in Python
        this.pyodide.runPython("_tick_function = None");
      } catch (e) {
        // Ignore errors during cleanup
      }
      // Clear references
      this.pyodide = null;
      this.loaded = false;
      this.loadedCode = null;
    }
  }
}
