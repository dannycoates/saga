import { BaseRuntime } from "./BaseRuntime.js";
import { untar } from "@andrewbranch/untar.js";
import {
  WASI,
  File,
  Directory,
  PreopenDirectory,
  OpenFile,
  ConsoleStdout,
  wasi as wasiDefs,
} from "@bjorn3/browser_wasi_shim";

/**
 * @typedef {import('./BaseRuntime.js').ElevatorAPI} ElevatorAPI
 * @typedef {import('./BaseRuntime.js').FloorAPI} FloorAPI
 */

const DEFAULT_TEMPLATE = `const game = @import("game.zig");

/// Floor API:
///   level() i32              - floor number
///   buttons() Buttons        - .up() and .down() return bool
///
/// Elevator API:
///   currentFloor() i32              - current floor number
///   destinationFloor() ?i32         - destination or null if idle
///   pressedFloorButtons() Iterator  - floors requested by passengers
///   percentFull() f32               - load percentage (0.0 to 1.0)
///   goToFloor(floor: i32) void      - command elevator to a floor
///
/// Global functions (via game.):
///   game.getElevators() Iterator  - iterate over all elevators
///   game.getFloors() Iterator     - iterate over all floors
///   game.getElevatorCount() i32   - number of elevators
///   game.getFloorCount() i32      - number of floors

var next_floor: i32 = 1;

/// Tick is called on every game loop iteration.
export fn tick() void {
    var elevators = game.getElevators();
    const floor_count = game.getFloorCount();

    if (elevators.next()) |elev| {
        if (elev.destinationFloor() == null) {
            if (next_floor >= floor_count) {
                next_floor = 0;
            }
            next_floor += 1;
            elev.goToFloor(next_floor);
        }
    }
}
`;

/**
 * Zig runtime that compiles Zig code to WASM at runtime.
 * Uses the Zig compiler compiled to WASM via WASI.
 *
 * @extends BaseRuntime
 */
export class ZigRuntime extends BaseRuntime {
  constructor() {
    super("zig");
    /** @type {WebAssembly.Module|null} Compiled Zig compiler module (reusable) */
    this.zigModule = null;
    /** @type {Directory|null} Zig standard library */
    this.zigStdlib = null;
    /** @type {string|null} Elevator API library source */
    this.elevatorLibSource = null;
    /** @type {WebAssembly.Instance|null} Compiled user code instance */
    this.userInstance = null;
    /** @type {ElevatorAPI[]} Current elevator references for execute() */
    this.elevators = [];
    /** @type {FloorAPI[]} Current floor references for execute() */
    this.floors = [];
  }

  /**
   * Loads the Zig compiler WASM and standard library.
   * @override
   * @returns {Promise<void>}
   */
  async loadRuntime() {
    if (this.isLoading || this.isLoaded) return;
    this.isLoading = true;

    try {
      // Load Zig compiler, stdlib, and elevator library in parallel
      const [moduleResult, tarballResponse, elevatorResponse] =
        await Promise.all([
          WebAssembly.compileStreaming(
            fetch(new URL(`${__BASE_URL__}zig/zig.wasm`, import.meta.url)),
          ),
          fetch(new URL(`${__BASE_URL__}zig/zig.tar.gz`, import.meta.url)),
          fetch(new URL(`${__BASE_URL__}zig/game.zig`, import.meta.url)),
        ]);

      this.zigModule = moduleResult;
      this.elevatorLibSource = await elevatorResponse.text();

      // Extract stdlib tarball
      let arrayBuffer = await tarballResponse.arrayBuffer();

      // Decompress if gzipped
      const magicNumber = new Uint8Array(arrayBuffer).slice(0, 2);
      if (magicNumber[0] === 0x1f && magicNumber[1] === 0x8b) {
        const ds = new DecompressionStream("gzip");
        const response = new Response(
          new Response(arrayBuffer).body.pipeThrough(ds),
        );
        arrayBuffer = await response.arrayBuffer();
      }

      // Extract tarball to directory structure
      const entries = untar(arrayBuffer);
      this.zigStdlib = this.#buildDirectoryTree(entries);

      this.isLoaded = true;
    } catch (error) {
      throw new Error(`Failed to load Zig runtime: ${error.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Builds a Directory tree from tarball entries.
   * @param {Array} entries - Tarball entries
   * @returns {Directory}
   */
  #buildDirectoryTree(entries) {
    /** @type {Map<string, any>} */
    const root = new Map();

    for (const entry of entries) {
      if (!entry.filename.startsWith("lib/")) continue;
      const path = entry.filename.slice("lib/".length);
      const segments = path.split("/");

      /** @type {Map<string, any>} */
      let current = root;
      for (const segment of segments.slice(0, -1)) {
        if (!current.has(segment)) {
          current.set(segment, new Map());
        }
        current = current.get(segment);
      }

      const filename = segments[segments.length - 1];
      if (filename) {
        current.set(filename, entry.fileData);
      }
    }

    return this.#convertToDirectory(root);
  }

  /**
   * Converts a nested Map structure to WASI Directory.
   * @param {Map} node
   * @returns {Directory}
   */
  #convertToDirectory(node) {
    return new Directory(
      [...node.entries()].map(([key, value]) => {
        if (value instanceof Uint8Array) {
          return [key, new File(value)];
        } else {
          return [key, this.#convertToDirectory(value)];
        }
      }),
    );
  }

  /**
   * Compiles user Zig code to WASM and instantiates it.
   * @override
   * @param {string} code - User's Zig code
   * @returns {Promise<void>}
   */
  async loadCode(code) {
    if (!this.isLoaded) {
      throw new Error("Zig runtime not loaded");
    }

    // Collect stderr output for error messages
    const stderrChunks = [];
    const decoder = new TextDecoder("utf-8", { fatal: false });

    const stderrOutput = new ConsoleStdout((buffer) => {
      const chunk = decoder.decode(buffer, { stream: true });
      console.log(chunk);
      stderrChunks.push(chunk);
    });
    stderrOutput.fd_pwrite = (data, offset) => {
      return { ret: wasiDefs.ERRNO_SPIPE, nwritten: 0 };
    };

    // Set up virtual filesystem with user code and elevator API library
    const sourceDir = new Map([
      ["main.zig", new File(new TextEncoder().encode(code))],
      ["game.zig", new File(new TextEncoder().encode(this.elevatorLibSource))],
    ]);

    const fds = [
      new OpenFile(new File([])), // stdin
      stderrOutput, // stdout
      stderrOutput, // stderr
      new PreopenDirectory(".", sourceDir),
      new PreopenDirectory("/lib", this.zigStdlib.contents),
      new PreopenDirectory("/cache", new Map()),
    ];

    const args = [
      "zig.wasm",
      "build-exe",
      "main.zig",
      "-fno-llvm",
      "-fno-lld",
      "-fno-ubsan-rt",
      "-fno-entry",
    ];

    const wasi = new WASI(args, [], fds, { debug: false });

    // Instantiate compiler from cached module
    const zigInstance = await WebAssembly.instantiate(this.zigModule, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });

    const exitCode = wasi.start(/** @type {any} */ (zigInstance));

    if (exitCode !== 0) {
      const errorMsg = stderrChunks.join("");
      throw new Error(`Zig compilation failed:\n${errorMsg}`);
    }

    // Extract compiled WASM from virtual filesystem
    const cwd = /** @type {PreopenDirectory} */ (wasi.fds[3]);
    const mainWasm = /** @type {File|undefined} */ (
      cwd.dir.contents.get("main.wasm")
    );

    if (!mainWasm) {
      throw new Error(
        "Compilation succeeded but no output file. Stderr: " +
          stderrChunks.join(""),
      );
    }

    // Instantiate the compiled user code with game API imports
    const wasmImports = this.#createImports({
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    const result = await WebAssembly.instantiate(mainWasm.data, wasmImports);
    const instance = /** @type {WebAssembly.Instance} */ (
      "instance" in result ? result.instance : result
    );

    // Bind WASI to user code's memory so stdout/stderr work correctly
    wasi.initialize(/** @type {any} */ (instance));

    if (typeof instance.exports.tick !== "function") {
      throw new Error("Code must export a tick function");
    }

    this.userInstance = instance;
    this.loadedCode = code;
  }

  /**
   * Creates the WASM imports object for the game API.
   * @param {object} other - Other globals to inject, like wasi
   * @returns {object}
   */
  #createImports(other = {}) {
    return {
      ...other,
      env: {
        js_goToFloor: (id, floor) => {
          if (this.elevators[id]) {
            this.elevators[id].goToFloor(floor);
          }
        },
        js_getCurrentFloor: (id) => {
          return this.elevators[id]?.currentFloor ?? 0;
        },
        js_getDestinationFloor: (id) => {
          const dest = this.elevators[id]?.destinationFloor;
          return dest === null || dest === undefined ? -1 : dest;
        },
        js_getPercentFull: (id) => {
          return this.elevators[id]?.percentFull ?? 0;
        },
        js_getPressedButtonCount: (id) => {
          return this.elevators[id]?.pressedFloorButtons?.length ?? 0;
        },
        js_getPressedButton: (id, idx) => {
          return this.elevators[id]?.pressedFloorButtons?.[idx] ?? -1;
        },
        js_getFloorButtonUp: (id) => {
          return this.floors[id]?.buttons?.up ? 1 : 0;
        },
        js_getFloorButtonDown: (id) => {
          return this.floors[id]?.buttons?.down ? 1 : 0;
        },
        js_getFloorLevel: (id) => {
          return this.floors[id]?.level ?? 0;
        },
        js_getElevatorCount: () => {
          return this.elevators.length;
        },
        js_getFloorCount: () => {
          return this.floors.length;
        },
      },
    };
  }

  /**
   * Executes the user's tick function.
   * @override
   * @param {ElevatorAPI[]} elevators
   * @param {FloorAPI[]} floors
   * @returns {Promise<void>}
   */
  async execute(elevators, floors) {
    if (!this.isLoaded) {
      throw new Error("Zig runtime not loaded");
    }
    if (!this.userInstance) {
      throw new Error("No code loaded. Call loadCode() first.");
    }

    // Store references so WASM imports can access them
    this.elevators = elevators;
    this.floors = floors;

    // Call the exported tick function
    const tick = /** @type {() => void} */ (this.userInstance.exports.tick);
    tick();
  }

  /**
   * Gets the default Zig code template.
   * @override
   * @returns {string}
   */
  getDefaultTemplate() {
    return DEFAULT_TEMPLATE;
  }

  /**
   * Cleans up runtime resources.
   * @override
   */
  cleanup() {
    this.userInstance = null;
    this.elevators = [];
    this.floors = [];
    this.loadedCode = null;
    // Keep zigStdlib and isLoaded - no need to reload on restart
  }
}
