import { BaseRuntime } from "../BaseRuntime.js";
import {
  SYNC_OFFSET,
  STATE_LENGTH_OFFSET,
  RESPONSE_LENGTH_OFFSET,
  STATE_DATA_OFFSET,
  RESPONSE_DATA_OFFSET,
  SIGNAL_IDLE,
  SIGNAL_TICK_READY,
  SIGNAL_SHUTDOWN,
  serializeState,
  deserializeCommands,
} from "./protocol.js";

/**
 * @typedef {import('../BaseRuntime.js').ElevatorAPI} ElevatorAPI
 * @typedef {import('../BaseRuntime.js').FloorAPI} FloorAPI
 */

const DEFAULT_TEMPLATE = `use game::*;

fn main() {
    let mut next_floor: i32 = 1;

    game::run(|elevators: &mut [Elevator], floors: &[Floor]| {
        let floor_count = floors.len() as i32;
        if let Some(elevator) = elevators.first_mut() {
            if elevator.destination_floor().is_none() {
                if next_floor >= floor_count {
                    next_floor = 0;
                }
                next_floor += 1;
                elevator.go_to_floor(next_floor);
            }
        }
    });
}
`;

/** List of .rlib files in public/rust/lib/ */
const RLIB_FILES = [
  "libaddr2line-b8754aeb03c02354.rlib",
  "libadler-05c3545f6cd12159.rlib",
  "liballoc-0dab879bc41cd6bd.rlib",
  "libcfg_if-c7fd2cef50341546.rlib",
  "libcompiler_builtins-a99947d020d809d6.rlib",
  "libcore-4b8e8a815d049db3.rlib",
  "libgetopts-bbb75529e85d129d.rlib",
  "libgimli-598847d27d7a3cbf.rlib",
  "libhashbrown-d2ff91fdf93cacb2.rlib",
  "liblibc-dc63949c664c3fce.rlib",
  "libmemchr-2d3a423be1a6cb96.rlib",
  "libminiz_oxide-b109506a0ccc4c6a.rlib",
  "libobject-7b48def7544c748b.rlib",
  "libpanic_abort-c93441899b93b849.rlib",
  "libpanic_unwind-11d9ba05b60bf694.rlib",
  "libproc_macro-1a7f7840bb9983dc.rlib",
  "librustc_demangle-59342a335246393d.rlib",
  "librustc_std_workspace_alloc-552b185085090ff6.rlib",
  "librustc_std_workspace_core-5d8a121daa7eeaa9.rlib",
  "librustc_std_workspace_std-97f43841ce452f7d.rlib",
  "libstd_detect-cca21eebc4281add.rlib",
  "libstd-bdedb7706a556da2.rlib",
  "libsysroot-f654e185be3ffebd.rlib",
  "libtest-f06fa3fbc201c558.rlib",
  "libunicode_width-19a0dcd589fa0877.rlib",
  "libunwind-747b693f90af9445.rlib",
];

/**
 * Rust runtime that runs user code via Miri in a Web Worker.
 * Communicates with the worker through a SharedArrayBuffer using
 * Atomics for synchronization.
 *
 * @extends BaseRuntime
 */
export class RustRuntime extends BaseRuntime {
  constructor() {
    super("rust");

    /** @type {SharedArrayBuffer} 64KB shared buffer for state/response exchange */
    this.sab = new SharedArrayBuffer(65536);

    /** @type {Int32Array} Sync signal view at offset 0 */
    this.syncView = new Int32Array(this.sab, SYNC_OFFSET, 1);

    /** @type {Uint8Array} Full buffer view for state/response data */
    this.stateData = new Uint8Array(this.sab);

    /** @type {Worker|null} Miri Web Worker */
    this.worker = null;

    /** @type {string|null} game.rs library source */
    this.gameRsSource = null;
  }

  /**
   * Loads the Rust runtime: fetches game.rs and spawns the Miri worker.
   * @override
   * @returns {Promise<void>}
   */
  async loadRuntime() {
    if (this.isLoading || this.isLoaded) return;
    this.isLoading = true;

    try {
      // Fetch game.rs source
      const gameRsResponse = await fetch(
        new URL(`${__BASE_URL__}rust/game.rs`, import.meta.url),
      );
      this.gameRsSource = await gameRsResponse.text();

      // Spawn worker and send init message
      await this.#initWorker();

      this.isLoaded = true;
    } catch (error) {
      throw new Error(`Failed to load Rust runtime: ${error.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Creates a new worker and sends the init message with Miri URL,
   * rlib file URLs, game.rs source, and the SharedArrayBuffer.
   * Resolves when the worker responds with 'loaded'.
   * @returns {Promise<void>}
   */
  async #initWorker() {
    this.worker = new Worker(new URL("./rust-worker.js", import.meta.url), {
      type: "module",
    });

    const baseUrl = new URL(`${__BASE_URL__}rust/`, import.meta.url).href;

    const miriUrl = `${baseUrl}miri.wasm`;
    const rlibFiles = RLIB_FILES.map((name) => ({
      name,
      url: `${baseUrl}lib/${name}`,
    }));

    const { promise, resolve, reject } =
      /** @type {PromiseWithResolvers<void>} */ (Promise.withResolvers());

    const onMessage = (/** @type {MessageEvent} */ e) => {
      if (e.data.type === "loaded") {
        this.worker?.removeEventListener("message", onMessage);
        resolve();
      } else if (e.data.type === "error") {
        this.worker?.removeEventListener("message", onMessage);
        reject(new Error(e.data.message));
      }
    };
    this.worker.addEventListener("message", onMessage);

    this.worker.postMessage({
      type: "init",
      miriUrl,
      rlibFiles,
      gameRsSource: this.gameRsSource,
      sab: this.sab,
    });

    await promise;
  }

  /**
   * Loads user Rust code by wrapping it with game.rs as a module
   * and sending it to the Miri worker.
   * @override
   * @param {string} code - User's Rust code
   * @returns {Promise<void>}
   */
  async loadCode(code) {
    if (!this.isLoaded) {
      throw new Error("Rust runtime not loaded");
    }

    // If we have an existing worker from a previous run, clean up and re-init
    if (this.loadedCode !== null) {
      this.cleanup();
      this.sab = new SharedArrayBuffer(65536);
      this.syncView = new Int32Array(this.sab, SYNC_OFFSET, 1);
      this.stateData = new Uint8Array(this.sab);
      await this.#initWorker();
    }

    // Wrap game.rs as a module and prepend to user code
    const mainRsSource = `mod game {\n${this.gameRsSource}\n}\n\n${code}`;

    const { promise, resolve, reject } =
      /** @type {PromiseWithResolvers<void>} */ (Promise.withResolvers());

    const onMessage = (/** @type {MessageEvent} */ e) => {
      if (e.data.type === "code_loaded") {
        this.worker?.removeEventListener("message", onMessage);
        resolve();
      } else if (e.data.type === "error") {
        this.worker?.removeEventListener("message", onMessage);
        reject(new Error(e.data.message));
      }
    };
    /** @type {Worker} */ (this.worker).addEventListener("message", onMessage);

    /** @type {Worker} */ (this.worker).postMessage({
      type: "loadCode",
      mainRsSource,
    });

    await promise;
    this.loadedCode = code;
  }

  /**
   * Executes a single tick by writing game state to the SharedArrayBuffer,
   * signaling the worker, waiting for its response, and applying commands.
   * @override
   * @param {ElevatorAPI[]} elevators
   * @param {FloorAPI[]} floors
   * @returns {Promise<void>}
   */
  async execute(elevators, floors) {
    if (!this.isLoaded) {
      throw new Error("Rust runtime not loaded");
    }
    if (!this.worker) {
      throw new Error("No code loaded. Call loadCode() first.");
    }

    // Serialize elevator/floor state into the shared buffer
    const stateLength = serializeState(elevators, floors, this.stateData);

    // Write state length
    const view = new DataView(this.sab);
    view.setUint32(STATE_LENGTH_OFFSET, stateLength, true);

    // Signal the worker that tick data is ready
    Atomics.store(this.syncView, 0, SIGNAL_TICK_READY);
    Atomics.notify(this.syncView, 0);

    // Wait asynchronously for the worker to signal completion
    const result = Atomics.waitAsync(this.syncView, 0, SIGNAL_TICK_READY);
    if (result.async) {
      await result.value;
    }

    // Read response length and deserialize commands
    const responseLength = view.getUint32(RESPONSE_LENGTH_OFFSET, true);
    const commands = deserializeCommands(this.stateData, responseLength);

    // Apply commands
    for (const cmd of commands) {
      if (elevators[cmd.elevatorId]) {
        elevators[cmd.elevatorId].goToFloor(cmd.floor);
      }
    }

    // Reset signal to idle
    Atomics.store(this.syncView, 0, SIGNAL_IDLE);
  }

  /**
   * Gets the default Rust code template.
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
    if (this.worker) {
      Atomics.store(this.syncView, 0, SIGNAL_SHUTDOWN);
      Atomics.notify(this.syncView, 0);
      this.worker.terminate();
      this.worker = null;
    }
    this.loadedCode = null;
  }
}
