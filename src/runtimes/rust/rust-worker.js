import {
  WASI,
  File,
  Directory,
  PreopenDirectory,
  OpenFile,
  ConsoleStdout,
  Fd,
  wasi,
} from "@bjorn3/browser_wasi_shim";
import {
  SYNC_OFFSET,
  STATE_LENGTH_OFFSET,
  STATE_DATA_OFFSET,
  RESPONSE_DATA_OFFSET,
  SIGNAL_IDLE,
  SIGNAL_TICK_READY,
  SIGNAL_SHUTDOWN,
  SIGNAL_TICK_DONE,
  RESPONSE_LENGTH_OFFSET,
} from "./protocol.js";

/** @type {WebAssembly.Module|null} */
let miriModule = null;

/** @type {Array<[string, ArrayBuffer]>} */
let rlibData = [];

/** @type {Int32Array|null} */
let syncView = null;

/** @type {Uint8Array|null} */
let stateData = null;

/**
 * Blocking stdin that reads game state from SharedArrayBuffer.
 * Uses Atomics.wait() to block until the main thread signals data is ready.
 */
class BlockingStdin extends Fd {
  constructor() {
    super();
    /** @type {boolean} */
    this.firstRead = true;
  }

  fd_read(/** @type {number} */ size) {
    if (this.firstRead) {
      this.firstRead = false;
      postMessage({ type: "code_loaded" });
    }

    const sv = /** @type {Int32Array} */ (syncView);

    // Loop until we see TICK_READY or SHUTDOWN.
    // After BufferedStdout sets TICK_DONE (2), the worker loops back here
    // before the main thread resets to IDLE. We must wait through both
    // TICK_DONE and IDLE states until the next TICK_READY arrives.
    while (true) {
      const current = Atomics.load(sv, 0);
      if (current === SIGNAL_SHUTDOWN) {
        return { ret: wasi.ERRNO_SUCCESS, data: new Uint8Array(0) };
      }
      if (current === SIGNAL_TICK_READY) {
        break;
      }
      // Block until value changes from current (handles both IDLE and TICK_DONE)
      Atomics.wait(sv, 0, current);
    }

    // Read state_length from offset 4
    const view = new DataView(/** @type {Uint8Array} */ (stateData).buffer);
    const stateLength = view.getUint32(STATE_LENGTH_OFFSET, true);

    // Copy state_length bytes from STATE_DATA_OFFSET
    const data = new Uint8Array(stateLength);
    data.set(
      /** @type {Uint8Array} */ (stateData).subarray(
        STATE_DATA_OFFSET,
        STATE_DATA_OFFSET + stateLength,
      ),
    );

    // Return up to 'size' bytes
    const toReturn = data.subarray(0, Math.min(size, data.length));
    return { ret: wasi.ERRNO_SUCCESS, data: toReturn };
  }
}

/**
 * Buffered stdout that accumulates output and writes complete command
 * messages to the SharedArrayBuffer response area.
 */
class BufferedStdout extends Fd {
  constructor() {
    super();
    /** @type {Uint8Array} */
    this.buffer = new Uint8Array(0);
  }

  fd_write(/** @type {Uint8Array} */ data) {
    // Append data to internal buffer
    const newBuffer = new Uint8Array(this.buffer.length + data.length);
    newBuffer.set(this.buffer);
    newBuffer.set(data, this.buffer.length);
    this.buffer = newBuffer;

    // Check if buffer contains a complete message
    // First 4 bytes = command_count (u32 LE), total = 4 + command_count * 8
    if (this.buffer.length >= 4) {
      const commandCount = new DataView(
        this.buffer.buffer,
        this.buffer.byteOffset,
        this.buffer.byteLength,
      ).getUint32(0, true);
      const expectedLength = 4 + commandCount * 8;

      if (this.buffer.length >= expectedLength) {
        // Copy complete message to SAB response area
        /** @type {Uint8Array} */ (stateData).set(
          this.buffer.subarray(0, expectedLength),
          RESPONSE_DATA_OFFSET,
        );

        // Store response length
        const view = new DataView(/** @type {Uint8Array} */ (stateData).buffer);
        view.setUint32(RESPONSE_LENGTH_OFFSET, expectedLength, true);

        // Signal main thread that response is ready
        Atomics.store(
          /** @type {Int32Array} */ (syncView),
          0,
          SIGNAL_TICK_DONE,
        );
        Atomics.notify(/** @type {Int32Array} */ (syncView), 0);

        // Reset buffer (remove consumed bytes)
        this.buffer = this.buffer.subarray(expectedLength);
      }
    }

    return { ret: wasi.ERRNO_SUCCESS, nwritten: data.length };
  }
}

/**
 * Handle 'init' message: compile Miri module and fetch rlib files.
 * @param {MessageEvent} e
 */
async function handleInit(e) {
  const { miriUrl, rlibFiles, sab } = e.data;

  syncView = new Int32Array(sab);
  stateData = new Uint8Array(sab);

  // Fetch and compile miri.wasm and all rlib files in parallel
  const [compiledModule, ...rlibResults] = await Promise.all([
    WebAssembly.compileStreaming(fetch(miriUrl)),
    ...rlibFiles.map(async (/** @type {{name: string, url: string}} */ f) => {
      const resp = await fetch(f.url);
      return /** @type {[string, ArrayBuffer]} */ ([
        f.name,
        await resp.arrayBuffer(),
      ]);
    }),
  ]);

  miriModule = compiledModule;
  rlibData = rlibResults;

  postMessage({ type: "loaded" });
}

/**
 * Handle 'loadCode' message: set up WASI filesystem and run Miri.
 * @param {MessageEvent} e
 */
function handleLoadCode(e) {
  const { mainRsSource, sab } = e.data;

  // Update SAB references (new buffer for each run after the first)
  if (sab) {
    syncView = new Int32Array(sab);
    stateData = new Uint8Array(sab);
  }

  // Build rlib directory
  const libDir = new Directory(
    rlibData.map(([name, buffer]) => [name, new File(buffer)]),
  );

  // WASI virtual filesystem
  const rootDir = new PreopenDirectory(
    "/",
    new Map([["main.rs", new File(new TextEncoder().encode(mainRsSource))]]),
  );

  const sysrootDir = new PreopenDirectory(
    "/sysroot",
    new Map([
      [
        "lib",
        new Directory([
          [
            "rustlib",
            new Directory([
              ["x86_64-unknown-linux-gnu", new Directory([["lib", libDir]])],
            ]),
          ],
        ]),
      ],
    ]),
  );

  const tmpDir = new PreopenDirectory("/tmp", new Map());

  // Collect stderr output
  /** @type {string[]} */
  const stderrChunks = [];
  const decoder = new TextDecoder("utf-8", { fatal: false });

  const stdin = new BlockingStdin();

  const fds = [
    stdin, // fd 0: stdin
    new BufferedStdout(), // fd 1: stdout
    new ConsoleStdout((buffer) => {
      // fd 2: stderr
      const chunk = decoder.decode(buffer, { stream: true });
      stderrChunks.push(chunk);
    }),
    rootDir, // fd 3
    sysrootDir, // fd 4
    tmpDir, // fd 5
  ];

  const args = [
    "miri",
    "--sysroot",
    "/sysroot",
    "main.rs",
    "--target",
    "x86_64-unknown-linux-gnu",
    "-Zmiri-ignore-leaks",
    "-Zmiri-permissive-provenance",
    "-Zmiri-preemption-rate=0",
    "-Zmiri-disable-alignment-check",
    "-Zmiri-disable-data-race-detector",
    "-Zmiri-disable-stacked-borrows",
    "-Zmiri-disable-validation",
    "-Zmir-emit-retag=false",
    "-Zmiri-disable-isolation",
  ];

  const wasiInstance = new WASI(args, [], fds, { debug: false });

  let threadCount = 1;

  try {
    // Instantiate Miri synchronously (we're in a worker, compileStreaming already done)
    const instance = new WebAssembly.Instance(
      /** @type {WebAssembly.Module} */ (miriModule),
      {
        env: {
          memory: new WebAssembly.Memory({ initial: 256, shared: false }),
          // Stub for lld linker callback — Miri never invokes the linker
          RustRunLld: () => 1,
        },
        wasi: {
          "thread-spawn": (/** @type {unknown} */ startArg) => {
            const id = threadCount++;
            /** @type {any} */ (instance.exports).wasi_thread_start(
              id,
              startArg,
            );
            return id;
          },
        },
        wasi_snapshot_preview1: wasiInstance.wasiImport,
      },
    );

    const exitCode = wasiInstance.start(/** @type {any} */ (instance));
    if (exitCode !== 0) {
      const errorMsg = stderrChunks.join("");
      postMessage({
        type: "error",
        message: `Miri exited with code ${exitCode}\n${errorMsg}`,
      });
    } else if (stdin.firstRead) {
      postMessage({
        type: "error",
        message:
          "Code compiled but never called game::run(). " +
          "Your main() function must call game::run() with a tick closure.",
      });
    }
  } catch (err) {
    const errorMsg = stderrChunks.join("");
    postMessage({
      type: "error",
      message: `Miri error: ${err.message}\n${errorMsg}`,
    });
  }

  // Signal that the worker is ready for new code
  postMessage({ type: "ready" });
}

self.onmessage = (e) => {
  switch (e.data.type) {
    case "init":
      handleInit(e);
      break;
    case "loadCode":
      handleLoadCode(e);
      break;
    case "reset":
      // Fallback: if Miri already exited, handleLoadCode's "ready" was missed
      postMessage({ type: "ready" });
      break;
  }
};
