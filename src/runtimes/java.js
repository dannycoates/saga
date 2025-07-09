import { BaseRuntime } from "./base.js";

// Register native methods that Java can call
async function Java_Elevator_jsGoToFloor(lib, elevatorId, floor) {
  // Find the corresponding JavaScript elevator
  const jsElevator = window.elevators[elevatorId];
  if (jsElevator) {
    jsElevator.goToFloor(floor);
  }
}

export class JavaRuntime extends BaseRuntime {
  constructor() {
    super();
    this.cheerpjReady = false;
    this.compiledClass = null;
    this.lib = null;
    this.loadedCode = null;
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

      // Initialize CheerpJ with minimal configuration
      await window.cheerpjInit({
        status: "none",
        natives: {
          Java_Elevator_jsGoToFloor,
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

      // Store the compiled class name
      this.compiledClass = "ElevatorController";
      this.loadedCode = code;
      this.lib = await window.cheerpjRunLibrary("/files/");
      this.Elevator = await this.lib.Elevator;
      this.Floor = await this.lib.Floor;
      this.Buttons = await this.lib.Floor$Buttons;
      this.ElevatorController = await this.lib.ElevatorController;
      console.log("loaded classes");
    } catch (error) {
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

  async execute(elevators, floors) {
    if (!this.loaded) {
      throw new Error("Java runtime not loaded");
    }

    if (!this.compiledClass) {
      throw new Error("No code loaded. Call loadCode() first.");
    }
    window.elevators = elevators;

    // Create Java wrapper objects for elevators and floors
    const javaElevators = [];
    let index = 0;
    for (const elevator of elevators) {
      const javaElevator = await new this.Elevator();
      javaElevator.id = index++;
      javaElevator.currentFloor = elevator.currentFloor;
      javaElevator.destinationFloor = elevator.destinationFloor;
      javaElevator.pressedFloorButtons = elevator.pressedFloorButtons || [];
      javaElevator.percentFull = elevator.percentFull;

      // Store reference for callback
      // elevator._javaRef = javaElevator;
      javaElevators.push(javaElevator);
    }

    const javaFloors = [];
    for (const floor of floors) {
      const javaFloor = await new this.Floor();
      javaFloor.level = floor.level;

      const buttons = await new this.Buttons();
      buttons.up = floor.buttons.up;
      buttons.down = floor.buttons.down;
      javaFloor.buttons = buttons;
      javaFloors.push(javaFloor);
    }

    // Create the controller and call update
    const controller = await new this.ElevatorController();
    await controller.update(javaElevators, javaFloors);

    // Clean up references
    // elevators.forEach((e) => delete e._javaRef);
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
    this.compiledClass = null;
    this.loaded = false;
    this.loadedCode = null;
    this.lib = null;
    this.cheerpjReady = false;
  }
}
