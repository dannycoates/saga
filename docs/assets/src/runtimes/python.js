import { BaseRuntime } from './base.js';

class PythonRuntime extends BaseRuntime {
  constructor() {
    super();
    this.pyodide = null;
  }

  async load() {
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
      await this.initializePythonEnvironment();

      this.loaded = true;
    } catch (error) {
      this.loading = false;
      throw new Error(`Failed to load Python runtime: ${error.message}`);
    } finally {
      this.loading = false;
    }
  }

  async initializePythonEnvironment() {
    // Create Python wrapper classes for the game API
    const wrapperCode = `
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

# Global variable to store the update function
_update_function = None

def _wrap_elevators(js_elevators):
    return [ElevatorAPI(elevator) for elevator in js_elevators]

def _wrap_floors(js_floors):
    return [FloorAPI(floor) for floor in js_floors]

def _execute_update(js_elevators, js_floors):
    if _update_function is None:
        raise Exception("No update function defined")

    elevators = _wrap_elevators(js_elevators)
    floors = _wrap_floors(js_floors)

    return _update_function(elevators, floors)
`;

    await this.pyodide.runPythonAsync(wrapperCode);
  }

  async loadCode(code) {
    if (!this.loaded) {
      throw new Error("Python runtime not loaded");
    }

    this.validateCode(code);

    // Set the user's code in the Python environment
    await this.pyodide.runPythonAsync(code);

    // Check if update function exists
    const hasUpdate = await this.pyodide.runPythonAsync(`
'update' in globals()
`);

    if (!hasUpdate) {
      throw new Error("Code must define an update function");
    }

    // Store the update function
    await this.pyodide.runPythonAsync(`
_update_function = update
`);

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

    // Execute the update function with wrapped objects
    const result = await this.pyodide.runPythonAsync(`
_execute_update(js_elevators, js_floors)
`);

    return result;
  }

  validateCode(code) {
    if (!code || code.trim().length === 0) {
      throw new Error("Code cannot be empty");
    }

    if (!code.includes("def update")) {
      throw new Error("Code must define an update function");
    }
  }

  getDefaultTemplate() {
    return `def update(elevators, floors):
  elevator = elevators[0]
  if elevator.destination_floor is None:
    if elevator.current_floor == len(floors) - 1:
      elevator.go_to_floor(0)
    else:
      elevator.go_to_floor(elevator.current_floor + 1)`;
  }

  getLanguage() {
    return "python";
  }

  dispose() {
    if (this.pyodide) {
      try {
        // Clear the update function in Python
        this.pyodide.runPython("_update_function = None");
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

export { PythonRuntime };