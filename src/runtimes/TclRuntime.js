import { BaseRuntime } from "./BaseRuntime.js";
import { loadWacl } from "./wacl-loader.js";

/**
 * @typedef {import('./BaseRuntime.js').ElevatorAPI} ElevatorAPI
 * @typedef {import('./BaseRuntime.js').FloorAPI} FloorAPI
 */

/**
 * Base Tcl code that provides wrapper procedures for the elevator API.
 * @type {string}
 */
const BASE_TCL_CODE = `
# Elevator Saga Tcl API
# Wrapper procedures that call the JavaScript bridge commands

# Get number of elevators
proc elevator_count {} {
    _js_elevator_count
}

# Get number of floors
proc floor_count {} {
    _js_floor_count
}

# Elevator procedures
proc elevator_current_floor {id} {
    _js_elevator_current_floor $id
}

proc elevator_destination_floor {id} {
    set dest [_js_elevator_destination_floor $id]
    if {$dest == -1} {
        return ""
    }
    return $dest
}

proc elevator_pressed_buttons {id} {
    set count [_js_elevator_pressed_count $id]
    set buttons {}
    for {set i 0} {$i < $count} {incr i} {
        lappend buttons [_js_elevator_pressed_button "$id $i"]
    }
    return $buttons
}

proc elevator_percent_full {id} {
    _js_elevator_percent_full $id
}

proc elevator_go_to_floor {id floor} {
    _js_elevator_go_to_floor "$id $floor"
}

# Floor procedures
proc floor_level {id} {
    _js_floor_level $id
}

proc floor_button_up {id} {
    _js_floor_button_up $id
}

proc floor_button_down {id} {
    _js_floor_button_down $id
}

# Iterator helpers for cleaner syntax
proc foreach_elevator {varName body} {
    upvar 1 $varName var
    set count [elevator_count]
    for {set var 0} {$var < $count} {incr var} {
        uplevel 1 $body
    }
}

proc foreach_floor {varName body} {
    upvar 1 $varName var
    set count [floor_count]
    for {set var 0} {$var < $count} {incr var} {
        uplevel 1 $body
    }
}
`;

/**
 * Tcl runtime using WACL (WebAssembly Tcl) for in-browser Tcl execution.
 *
 * @extends BaseRuntime
 */
export class TclRuntime extends BaseRuntime {
  /**
   * Creates a Tcl runtime instance.
   */
  constructor() {
    super("tcl");
    /** @type {any} WACL interpreter instance */
    this.interp = null;
    /** @type {ElevatorAPI[]} Current elevator references */
    this.elevators = [];
    /** @type {FloorAPI[]} Current floor references */
    this.floors = [];
  }

  /**
   * Loads the WACL runtime and initializes Tcl environment.
   * @override
   * @returns {Promise<void>}
   * @throws {Error} If WACL fails to load
   */
  async loadRuntime() {
    if (this.isLoading || this.isLoaded) return;
    this.isLoading = true;

    try {
      // Load WACL interpreter
      this.interp = await loadWacl();

      // Register JavaScript bridge commands
      this.#registerBridgeCommands();

      // Initialize base Tcl API
      this.interp.Eval(BASE_TCL_CODE);

      this.isLoaded = true;
    } catch (error) {
      throw new Error(`Failed to load Tcl runtime: ${error.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Registers JavaScript functions as Tcl commands via WACL's jswrap.
   * These low-level commands are wrapped by the BASE_TCL_CODE procedures.
   */
  #registerBridgeCommands() {
    const interp = this.interp;
    const self = this;

    // Helper to create a Tcl proc that calls a jswrapped JS function.
    // Note: WACL jscall only supports single arguments, so multi-arg functions
    // use string packing (e.g., "id floor") and parse in JavaScript.
    const registerCommand = (name, fn, returnType, argType) => {
      const jswrapResult = interp.jswrap(fn, returnType, argType || "").trim();

      if (!argType) {
        // No arguments - extract fnPtr and build proc manually
        const fnPtr = jswrapResult.split(/\s+/)[1];
        interp.Eval(
          `proc ${name} {} {::wacl::jscall ${fnPtr} ${returnType} void}`,
        );
      } else {
        // Single argument - jswrapResult already has the full command
        interp.Eval(`proc ${name} {arg0} {${jswrapResult} $arg0}`);
      }
    };

    // Elevator count (no args, returns int)
    registerCommand(
      "_js_elevator_count",
      () => self.elevators.length,
      "int",
      "",
    );

    // Floor count (no args, returns int)
    registerCommand("_js_floor_count", () => self.floors.length, "int", "");

    // Elevator current floor (1 arg: id, returns int)
    registerCommand(
      "_js_elevator_current_floor",
      (id) => self.elevators[id]?.currentFloor ?? 0,
      "int",
      "int",
    );

    // Elevator destination floor (1 arg: id, returns int, -1 if null)
    registerCommand(
      "_js_elevator_destination_floor",
      (id) => self.elevators[id]?.destinationFloor ?? -1,
      "int",
      "int",
    );

    // Elevator pressed button count (1 arg: id, returns int)
    registerCommand(
      "_js_elevator_pressed_count",
      (id) => self.elevators[id]?.pressedFloorButtons?.length ?? 0,
      "int",
      "int",
    );

    // Elevator pressed button at index (2 args as string: "id idx", returns int)
    // WACL jscall only supports single args, so we pass as string and parse
    registerCommand(
      "_js_elevator_pressed_button",
      (argsStr) => {
        const args = interp.ptr2str(argsStr).split(" ");
        const id = parseInt(args[0], 10);
        const idx = parseInt(args[1], 10);
        return self.elevators[id]?.pressedFloorButtons?.[idx] ?? -1;
      },
      "int",
      "string",
    );

    // Elevator percent full (1 arg: id, returns double for decimal values)
    registerCommand(
      "_js_elevator_percent_full",
      (id) => self.elevators[id]?.percentFull ?? 0,
      "double",
      "int",
    );

    // Elevator go to floor (2 args as string: "id floor", returns int)
    // WACL jscall only supports single args, so we pass as string and parse
    registerCommand(
      "_js_elevator_go_to_floor",
      (argsStr) => {
        const args = interp.ptr2str(argsStr).split(" ");
        const id = parseInt(args[0], 10);
        const floor = parseInt(args[1], 10);
        self.elevators[id]?.goToFloor(floor);
        return 0;
      },
      "int",
      "string",
    );

    // Floor level (1 arg: id, returns int)
    registerCommand(
      "_js_floor_level",
      (id) => self.floors[id]?.level ?? 0,
      "int",
      "int",
    );

    // Floor button up (1 arg: id, returns int 0/1)
    registerCommand(
      "_js_floor_button_up",
      (id) => (self.floors[id]?.buttons?.up ? 1 : 0),
      "int",
      "int",
    );

    // Floor button down (1 arg: id, returns int 0/1)
    registerCommand(
      "_js_floor_button_down",
      (id) => (self.floors[id]?.buttons?.down ? 1 : 0),
      "int",
      "int",
    );
  }

  /**
   * Loads user Tcl code and verifies tick proc exists.
   * @override
   * @param {string} code - Tcl code to load
   * @returns {Promise<void>}
   * @throws {Error} If runtime not loaded or code doesn't define tick proc
   */
  async loadCode(code) {
    if (!this.isLoaded) {
      throw new Error("Tcl runtime not loaded");
    }

    try {
      // Execute user code
      this.interp.Eval(code);

      // Verify tick proc exists
      const procs = this.interp.Eval("info procs tick");
      if (procs !== "tick") {
        throw new Error("Code must define a tick procedure");
      }
    } catch (e) {
      throw new Error(`Tcl error: ${e.errorInfo || e.message || e}`);
    }

    this.loadedCode = code;
  }

  /**
   * Executes the user's tick procedure.
   * @override
   * @param {ElevatorAPI[]} elevators - Array of elevator API objects
   * @param {FloorAPI[]} floors - Array of floor API objects
   * @returns {Promise<void>}
   * @throws {Error} If runtime not loaded or no code loaded
   */
  async execute(elevators, floors) {
    if (!this.isLoaded) {
      throw new Error("Tcl runtime not loaded");
    }

    if (!this.loadedCode) {
      throw new Error("No code loaded. Call loadCode() first.");
    }

    // Store references for bridge commands to access
    this.elevators = elevators;
    this.floors = floors;

    // Call user's tick proc
    try {
      this.interp.Eval("tick");
    } catch (e) {
      throw new Error(`Tcl execution error: ${e.errorInfo || e.message || e}`);
    }
  }

  /**
   * Gets the default Tcl code template.
   * @override
   * @returns {string} Default template code
   */
  getDefaultTemplate() {
    return `# Elevator Saga - Tcl
#
# Floor API:
#   floor_level $id              - floor number
#   floor_button_up $id          - 1 if up button pressed, 0 otherwise
#   floor_button_down $id        - 1 if down button pressed, 0 otherwise
#
# Elevator API:
#   elevator_current_floor $id        - current floor number
#   elevator_destination_floor $id    - destination or "" if idle
#   elevator_pressed_buttons $id      - list of pressed floor buttons
#   elevator_percent_full $id         - load percentage (0.0 to 1.0)
#   elevator_go_to_floor $id $floor   - command elevator to floor
#
# Helpers:
#   elevator_count                    - number of elevators
#   floor_count                       - number of floors
#   foreach_elevator varName body     - iterate over elevators
#   foreach_floor varName body        - iterate over floors

set next_floor 1

# tick is called on every game loop iteration
proc tick {} {
    global next_floor

    set elev 0  ;# First elevator
    set floor_cnt [floor_count]

    if {[elevator_destination_floor $elev] eq ""} {
        if {$next_floor >= $floor_cnt} {
            set next_floor 0
        }
        incr next_floor
        elevator_go_to_floor $elev $next_floor
    }
}`;
  }

  /**
   * Cleans up runtime resources.
   * @override
   * @returns {void}
   */
  cleanup() {
    this.elevators = [];
    this.floors = [];
    this.loadedCode = null;
    // Keep interpreter loaded for restart efficiency
  }
}
