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

/// Floor API:
///   level() -> i32              - floor number
///   button_up() -> bool         - true if up button is pressed
///   button_down() -> bool       - true if down button is pressed
///
/// Elevator API:
///   current_floor() -> i32              - current floor number
///   destination_floor() -> Option<i32>  - destination or None if idle
///   pressed_floor_buttons() -> &[i32]   - floors requested by passengers
///   percent_full() -> f32               - load percentage (0.0 to 1.0)
///   go_to_floor(floor: i32)             - command elevator to a floor

fn main() {
    let mut next_floor: i32 = 1;

    /// The closure passed to game::run is called on every game loop iteration.
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
  "libaddr2line-c813fa737fba7507.rlib",
  "libadler2-4d1e732393fe9feb.rlib",
  "liballoc-74f9ff3b9704c392.rlib",
  "libcfg_if-906f0abc17845b35.rlib",
  "libcompiler_builtins-e8edd42ca59ec068.rlib",
  "libcore-4e8b70147e8b100c.rlib",
  "libgetopts-3c70b4bf53defdc0.rlib",
  "libgimli-2f49026e3fa98064.rlib",
  "libhashbrown-9abfe277ad628fc6.rlib",
  "liblibc-3ad03c8d918a6832.rlib",
  "libmemchr-25202c0ed5415521.rlib",
  "libminiz_oxide-1c9b8a876d71bc98.rlib",
  "libobject-ca8bba417b754fa5.rlib",
  "libpanic_abort-8d0224792eca0fab.rlib",
  "libpanic_unwind-1faa3b164b1e73ef.rlib",
  "libproc_macro-fd829fcb07bda7f5.rlib",
  "librustc_demangle-5f8b1afa6f0f8996.rlib",
  "librustc_literal_escaper-ded571d764da7704.rlib",
  "librustc_std_workspace_alloc-be086603b2b461fe.rlib",
  "librustc_std_workspace_core-169d2200981008eb.rlib",
  "librustc_std_workspace_std-094832b92978b007.rlib",
  "libstd_detect-b2edab89ee6bc166.rlib",
  "libstd-3faaf133143a732a.rlib",
  "libsysroot-4d3ed47d2f66798e.rlib",
  "libtest-bd0c2fd67195b5d9.rlib",
  "libunwind-ba931008951d5c36.rlib",
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
   * Waits for the worker to signal readiness after Miri exits.
   * Sends a "reset" message as a fallback in case Miri already exited
   * (and its "ready" message was already dispatched with no listener).
   * @returns {Promise<void>}
   */
  async #waitForReady() {
    const { promise, resolve } = /** @type {PromiseWithResolvers<void>} */ (
      Promise.withResolvers()
    );

    const onMessage = (/** @type {MessageEvent} */ e) => {
      if (e.data.type === "ready") {
        this.worker?.removeEventListener("message", onMessage);
        resolve();
      }
    };
    /** @type {Worker} */ (this.worker).addEventListener("message", onMessage);
    /** @type {Worker} */ (this.worker).postMessage({ type: "reset" });

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

    // If we have an existing worker from a previous run, reset it (reuse worker
    // to avoid re-fetching/recompiling miri.wasm and rlib files)
    if (this.loadedCode !== null) {
      Atomics.store(this.syncView, 0, SIGNAL_SHUTDOWN);
      Atomics.notify(this.syncView, 0);
      await this.#waitForReady();
      this.sab = new SharedArrayBuffer(65536);
      this.syncView = new Int32Array(this.sab, SYNC_OFFSET, 1);
      this.stateData = new Uint8Array(this.sab);
    }

    // Wrap game.rs as a module and prepend to user code
    const mainRsSource = `mod game {\n${this.gameRsSource}\n}\n\n${code}`;

    // Calculate line offset for error message adjustment
    const prefix = `mod game {\n${this.gameRsSource}\n}\n\n`;
    const lineOffset = prefix.split("\n").length - 1;

    const { promise, resolve, reject } =
      /** @type {PromiseWithResolvers<void>} */ (Promise.withResolvers());

    const onMessage = (/** @type {MessageEvent} */ e) => {
      if (e.data.type === "code_loaded") {
        this.worker?.removeEventListener("message", onMessage);
        resolve();
      } else if (e.data.type === "error") {
        this.worker?.removeEventListener("message", onMessage);
        // Adjust main.rs line numbers to match user's editor lines
        const adjustedMessage = e.data.message
          .replace(
            /main\.rs:(\d+)/g,
            (/** @type {string} */ _, /** @type {string} */ lineStr) => {
              const adjusted = parseInt(lineStr, 10) - lineOffset;
              return `main.rs:${Math.max(1, adjusted)}`;
            },
          )
          .replace(
            /^(\s*)(\d+)(\s*\|)/gm,
            (
              /** @type {string} */ _,
              /** @type {string} */ leading,
              /** @type {string} */ lineStr,
              /** @type {string} */ rest,
            ) => {
              const adjusted = parseInt(lineStr, 10) - lineOffset;
              const numStr = String(Math.max(1, adjusted));
              // Preserve alignment: pad to same total width as original
              const totalWidth = leading.length + lineStr.length;
              const padded = numStr.padStart(totalWidth);
              return `${padded}${rest}`;
            },
          );
        reject(new Error(adjustedMessage));
      }
    };
    /** @type {Worker} */ (this.worker).addEventListener("message", onMessage);

    /** @type {Worker} */ (this.worker).postMessage({
      type: "loadCode",
      mainRsSource,
      sab: this.sab,
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
