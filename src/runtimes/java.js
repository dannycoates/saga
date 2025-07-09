import { BaseRuntime } from "./base.js";

export class JavaRuntime extends BaseRuntime {
  constructor() {
    super();
    this.cheerpjReady = false;
    this.compiledClasses = null;
    this.loadedCode = null;
    this.worker = null;
    this.workerReady = false;
    this.elevators = null;
  }

  async load() {
    if (this.loading || this.loaded) return;

    this.loading = true;

    try {
      // Load CheerpJ script
      const script = document.createElement("script");
      script.src = "https://cjrtnc.leaningtech.com/4.1/loader.js";

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

    this.validateCode(code);

    try {
      // Create the full Java source with imports and wrapper
      const fullJavaCode = this.createFullJavaSource(code);

      // Write the Java source to the virtual filesystem using cheerpOSAddStringFile
      const sourceFile = "/str/ElevatorController.java";
      window.cheerpOSAddStringFile(sourceFile, fullJavaCode);

      // In a real implementation:
      const classPath = "/app/tools.jar:/files/";
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

  validateCode(code) {
    if (!code || code.trim().length === 0) {
      throw new Error("Code cannot be empty");
    }

    // Check for the required class and update method
    if (!code.includes("class") || !code.includes("ElevatorController")) {
      throw new Error("Code must define a ElevatorController class");
    }

    if (!code.includes("void update")) {
      throw new Error("ElevatorController must have an update method");
    }
  }

  getDefaultTemplate() {
    return `public class ElevatorController {
    private int nextFloor = 1;

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

  getLanguage() {
    return "java";
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
