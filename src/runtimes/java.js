import { BaseRuntime } from "./base.js";

export class JavaRuntime extends BaseRuntime {
  constructor() {
    super("java");
    this.cheerpjReady = false;
    this.compiledClasses = null;
    this.loadedCode = null;
    this.worker = null;
    this.workerReady = false;
    this.elevators = null;
  }

  async loadRuntime() {
    if (this.loading || this.loaded) return;

    this.loading = true;

    try {
      // Load CheerpJ script
      const script = document.createElement("script");
      script.src = "https://cjrtnc.leaningtech.com/4.2/loader.js";

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = () =>
          reject(new Error("Failed to load CheerpJ script"));
        document.head.appendChild(script);
      });

      // Wait for cheerpjInit to be available
      if (typeof window.cheerpjInit === "undefined") {
        throw new Error("cheerpjInit is not defined after script load");
      }

      // Initialize CheerpJ with minimal configuration (no natives in main thread)
      await window.cheerpjInit({
        status: "none",
        overrideDocumentBase: __BASE_URL__ ?? "/",
        preloadResources: {
          "/lt/8/jre/lib/meta-index": [0, 131072],
          "/lt/8/jre/lib/rt.jar": [
            0, 131072, 10223616, 10878976, 11403264, 11665408, 11927552,
            12189696, 12320768, 12582912, 14942208, 15073280, 15204352,
            15335424, 15466496, 15597568, 17694720, 17825792, 18350080,
            18612224, 19005440, 19136512, 20840448, 21102592, 21233664,
            21757952, 22020096, 22806528, 23068672, 23592960, 23724032,
            26869760,
          ],
          "/lt/8/lib/ext/zipfs.jar": [0, 131072],
          "/lt/8/lib/ext/sunjce_provider.jar": [0, 262144],
          "/lt/8/lib/ext/sunec.jar": [0, 131072],
          "/lt/8/jre/lib/javaws.jar": [0, 131072, 1441792, 1703936],
          "/lt/8/jre/lib/resources.jar": [0, 131072, 917504, 1179648],
          "/lt/8/jre/lib/charsets.jar": [0, 131072, 1703936, 1835008],
          "/lt/8/jre/lib/jce.jar": [0, 131072],
          "/lt/8/jre/lib/jsse.jar": [0, 131072, 786432, 917504],
          "/lt/etc/users": [0, 131072],
          "/lt/etc/localtime": [],
          "/lt/8/lib/ext/localedata.jar": [0, 131072, 1048576, 1179648],
          "/lt/8/lib/ext/meta-index": [0, 131072],
          "/lt/8/jre/lib/cheerpj-awt.jar": [0, 131072],
          "/lt/8/lib/ext": [],
          "/lt/8/lib/ext/index.list": [],
          "/lt/8/jre/lib": [],
          "/lt/8/lib/ct.sym": [],
        },
      });
      this.cheerpjReady = true;

      this.loaded = true;
    } catch (error) {
      this.loading = false;
      throw new Error(`Failed to load Java runtime: ${error.message}`);
    } finally {
      this.loading = false;
    }
  }

  async loadCode(code) {
    if (!this.loaded) {
      throw new Error("Java runtime not loaded");
    }
    if (this.loadedCode === code) {
      return;
    }

    try {
      // Create the full Java source with imports and wrapper
      const fullJavaCode = this.createFullJavaSource(code);

      // Write the Java source to the virtual filesystem using cheerpOSAddStringFile
      const sourceFile = "/str/ElevatorController.java";
      window.cheerpOSAddStringFile(sourceFile, fullJavaCode);

      // In a real implementation:
      const classPath = `/app${__BASE_URL__}tools.jar:/files/`;
      const compileResult = await window.cheerpjRunMain(
        "com.sun.tools.javac.Main",
        classPath,
        sourceFile,
        "-d",
        "/files/",
        "-Xlint:none",
      );

      if (compileResult !== 0) {
        throw new Error("Java compilation failed");
      }

      // Get the compiled class files as blobs
      const classFiles = {};
      classFiles["Elevator.class"] = await window.cjFileBlob(
        "/files/Elevator.class",
      );
      classFiles["Floor.class"] = await window.cjFileBlob("/files/Floor.class");
      classFiles["Floor$Buttons.class"] = await window.cjFileBlob(
        "/files/Floor$Buttons.class",
      );
      classFiles["ElevatorController.class"] = await window.cjFileBlob(
        "/files/ElevatorController.class",
      );

      this.compiledClasses = classFiles;
      this.loadedCode = code;

      // Initialize worker with the compiled classes
      await this.initializeWorker();
    } catch (error) {
      console.error(error);
      throw new Error(`Failed to compile Java code: ${error.message}`);
    }
  }

  createFullJavaSource(userCode) {
    // Create a complete Java source file with the necessary imports and wrapper
    return `
import java.util.*;

// Elevator class wrapper
class Elevator {
    public int id;
    public int currentFloor;
    public Integer destinationFloor;
    public int[] pressedFloorButtons;
    public double percentFull;

    // Native method to call JavaScript
    public static native void jsGoToFloor(int elevator, int floor);

    public void goToFloor(int floor) {
        // This will be handled by JavaScript
        Elevator.jsGoToFloor(this.id, floor);
    }
}

// Floor class wrapper
class Floor {
    public int level;
    public Buttons buttons;

    public static class Buttons {
        public boolean up;
        public boolean down;
    }
}

// Main controller class
${userCode}`;
  }

  async initializeWorker() {
    // Dispose of existing worker if any
    if (this.worker) {
      this.worker.terminate();
    }

    // Create new worker (classic worker, not module)
    this.worker = new Worker(new URL("./java-worker.js", import.meta.url));
    this.workerReady = false;

    // Set up message handling
    this.worker.addEventListener("message", (event) => {
      const { type, elevatorId, floor, error } = event.data;
      switch (type) {
        case "initialized":
          this.workerReady = true;
          if (this.workerInitResolve) {
            this.workerInitResolve();
          }
          break;

        case "goToFloor":
          // Handle elevator commands from Java
          if (this.elevators && this.elevators[elevatorId]) {
            this.elevators[elevatorId].goToFloor(floor);
          }
          break;

        case "executed":
          if (this.executeResolve) {
            this.executeResolve();
          }
          break;

        case "error":
          console.error("Worker error:", error);
          if (this.executeReject) {
            this.executeReject(new Error(error));
          }
          break;
      }
    });

    // Initialize worker with compiled jar
    const initPromise = new Promise((resolve, reject) => {
      this.workerInitResolve = resolve;
      this.workerInitReject = reject;
    });

    this.worker.postMessage({
      type: "init",
      data: { classFiles: this.compiledClasses },
    });

    await initPromise;
    this.workerInitResolve = null;
    this.workerInitReject = null;
  }

  async execute(elevators, floors) {
    if (!this.loaded) {
      throw new Error("Java runtime not loaded");
    }

    if (!this.compiledClasses || !this.workerReady) {
      throw new Error("No code loaded. Call loadCode() first.");
    }

    // Store elevators reference for command handling
    this.elevators = elevators;

    // Create simplified objects to send to worker
    const elevatorsData = elevators.map((elevator, index) => ({
      id: index,
      currentFloor: elevator.currentFloor,
      destinationFloor: elevator.destinationFloor,
      pressedFloorButtons: elevator.pressedFloorButtons || [],
      percentFull: elevator.percentFull,
    }));

    const floorsData = floors.map((floor) => ({
      level: floor.level,
      buttons: {
        up: floor.buttons.up,
        down: floor.buttons.down,
      },
    }));

    // Execute in worker
    const executePromise = new Promise((resolve, reject) => {
      this.executeResolve = resolve;
      this.executeReject = reject;
    });

    this.worker.postMessage({
      type: "execute",
      data: { elevators: elevatorsData, floors: floorsData },
    });

    await executePromise;
    this.executeResolve = null;
    this.executeReject = null;
  }

  getDefaultTemplate() {
    return `/**
 * Floor class:
 *   Accessors:
 *     buttons.up - boolean: true if up button is pressed
 *     buttons.down - boolean: true if down button is pressed
 *     level - int: floor number (0-indexed)
 *
 * Elevator class:
 *   Accessors:
 *     currentFloor - int: current floor number
 *     destinationFloor - Integer: destination floor or null if idle
 *     pressedFloorButtons - int[]: array of pressed floor buttons
 *     percentFull - double: load percentage (0.0 to 1.0)
 *
 *   Methods:
 *     goToFloor(int floorNum) - command elevator to go to floor
 */
class ElevatorController {
    private int nextFloor = 1;

    /**
     * Update gets called on a regular, fast interval (a game loop)
     * @param elevators Array of all elevators
     * @param floors Array of all floors
     */
    public void update(Elevator[] elevators, Floor[] floors) {
        Elevator elevator = elevators[0];

        if (elevator.destinationFloor == null) {
            if (nextFloor >= floors.length) {
                nextFloor = 0;
            }
            nextFloor = nextFloor + 1;
            elevator.goToFloor(nextFloor);
        }
    }
}`;
  }

  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.compiledClasses = null;
    this.loaded = false;
    this.loadedCode = null;
    this.workerReady = false;
    this.cheerpjReady = false;
    this.elevators = null;
  }
}
