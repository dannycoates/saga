import { BaseRuntime } from "./BaseRuntime.js";
import { loadExternalScript } from "../utils/AsyncUtils.js";

const ELEVATOR_SOURCE = `import java.util.*;
/**
 * Elevator class representing an elevator in the simulation
 */
public class Elevator {
    public int id;
    public int currentFloor;
    public Integer destinationFloor;
    public int[] pressedFloorButtons;
    public double percentFull;

    // Native method to call JavaScript
    public static native void jsGoToFloor(int elevator, int floor);

    /**
     * Command the elevator to go to a specific floor
     * @param floor The target floor number
     */
    public void goToFloor(int floor) {
        // This will be handled by JavaScript
        Elevator.jsGoToFloor(this.id, floor);
    }
}`;

const FLOOR_SOURCE = `/**
 * Floor class representing a floor in the building
 */
public class Floor {
    public int level;
    public Buttons buttons;

    /**
     * Inner class representing the up/down buttons on a floor
     */
    public static class Buttons {
        public boolean up;
        public boolean down;
    }
}`;

let ELEVATORS = [];

async function Java_Elevator_jsGoToFloor(lib, elevatorId, floor) {
  // Find the corresponding JavaScript elevator
  const jsElevator = ELEVATORS[elevatorId];
  if (jsElevator) {
    jsElevator.goToFloor(floor);
  }
}

export class JavaRuntime extends BaseRuntime {
  constructor() {
    super("java");
    this.loadedCode = null;
    this.iteration = 0;
    this.lib = null;
    this.Elevator = null;
    this.Floor = null;
    this.Buttons = null;
    this.ElevatorController = null;
    this.controller = null;
    this.logBuffer = [];
    this.originalConsoleLog = null;
  }

  captureConsoleLog() {
    if (this.originalConsoleLog) return; // Already capturing

    this.originalConsoleLog = console.log;
    const self = this;

    console.log = function (...args) {
      // Check if the log message originates from cheerpOS.js
      const stack = new Error().stack;
      if (stack && stack.includes("cheerpOS.js")) {
        self.logBuffer.push(args.join(" "));
      }

      // Call the original console.log
      self.originalConsoleLog.apply(console, args);
    };
  }

  restoreConsoleLog() {
    if (this.originalConsoleLog) {
      console.log = this.originalConsoleLog;
      this.originalConsoleLog = null;
    }
  }

  resetLogBuffer() {
    this.logBuffer = [];
  }

  getLogBufferString() {
    if (this.logBuffer.length === 0) return "";
    return "\n\nCheerpJ logs:\n" + this.logBuffer.join("\n");
  }

  async loadRuntime() {
    if (this.isLoading || this.isLoaded) return;

    this.isLoading = true;
    this.resetLogBuffer();
    this.captureConsoleLog();

    try {
      // Load CheerpJ script with enhanced timeout handling
      await loadExternalScript(
        "https://cjrtnc.leaningtech.com/4.2/loader.js",
        60000,
      );

      // Wait for cheerpjInit to be available
      if (typeof window.cheerpjInit === "undefined") {
        throw new Error("cheerpjInit is not defined after script load");
      }

      await window.cheerpjInit({
        status: "none",
        natives: {
          Java_Elevator_jsGoToFloor,
        },
        overrideDocumentBase: __BASE_URL__ ?? "/",
        preloadResources: {
          "/lt/8/jre/lib/cheerpj-awt.jar": [0, 131072],
          "/lt/8/jre/lib/rt.jar": [
            0, 131072, 10223616, 10878976, 11403264, 11665408, 11927552,
            12189696, 12320768, 12582912, 14942208, 15073280, 15204352,
            15335424, 15466496, 15597568, 17694720, 17956864, 18350080,
            18612224, 19005440, 19136512, 20840448, 21102592, 21233664,
            21757952, 22020096, 22806528, 23068672, 23592960, 23724032,
            26869760,
          ],
          "/lt/8/lib/ext/meta-index": [0, 131072],
          "/lt/8/lib/ext/localedata.jar": [0, 131072, 1048576, 1179648],
          "/lt/etc/users": [0, 131072],
          "/lt/8/jre/lib/jsse.jar": [0, 131072, 786432, 917504],
          "/lt/8/jre/lib/jce.jar": [0, 131072],
          "/lt/8/jre/lib/charsets.jar": [0, 131072, 1703936, 1835008],
          "/lt/8/jre/lib/resources.jar": [0, 131072, 917504, 1179648],
          "/lt/8/jre/lib/javaws.jar": [0, 131072, 1441792, 1703936],
          "/lt/etc/localtime": [],
          "/lt/8/lib/ext/sunec.jar": [0, 131072],
          "/lt/8/lib/ext/sunjce_provider.jar": [0, 262144],
          "/lt/8/lib/ext/zipfs.jar": [0, 131072],
          "/lt/8/lib/ext": [],
          "/lt/8/lib/ext/index.list": [],
          "/lt/8/jre/lib/meta-index": [0, 131072],
          "/lt/8/jre/lib": [],
          "/lt/8/lib/ct.sym": [],
        },
      });
      // Precompile base code
      const elevatorFile = "/str/Elevator.java";
      const floorFile = "/str/Floor.java";
      window.cheerpOSAddStringFile(elevatorFile, ELEVATOR_SOURCE);
      window.cheerpOSAddStringFile(floorFile, FLOOR_SOURCE);

      const classPath = `/app${__BASE_URL__}tools.jar:/files/`;
      const compileResult = await window.cheerpjRunMain(
        "com.sun.tools.javac.Main",
        classPath,
        elevatorFile,
        floorFile,
        "-d",
        "/files/",
        "-Xlint:none",
      );

      if (compileResult !== 0) {
        throw new Error("Java compilation failed");
      }
      this.lib = await window.cheerpjRunLibrary("/files/");
      this.Elevator = await this.lib.Elevator;
      this.Floor = await this.lib.Floor;
      this.Buttons = await this.lib.Floor$Buttons;

      this.isLoaded = true;
    } catch (error) {
      this.isLoading = false;
      throw new Error(
        `Failed to load Java runtime: ${error.message}${this.getLogBufferString()}`,
      );
    } finally {
      this.isLoading = false;
    }
  }

  async loadCode(code) {
    if (!this.isLoaded) {
      throw new Error("Java runtime not loaded");
    }
    if (this.loadedCode === code) {
      return;
    }

    this.resetLogBuffer();

    try {
      const iteration = this.iteration++;

      // Find all class definitions in the code
      const classRegex = /class\s+(\w+)/g;
      const classNames = [];
      let match;

      while ((match = classRegex.exec(code)) !== null) {
        const className = match[1];
        if (!classNames.includes(className)) {
          classNames.push(className);
        }
      }

      // Replace all instances of found class names with versioned names
      let processedCode = code;
      for (const className of classNames) {
        const versionedName = `${className}${iteration}`;
        // Use word boundaries to ensure we only replace complete class names
        const regex = new RegExp(`\\b${className}\\b`, "g");
        processedCode = processedCode.replace(regex, versionedName);
      }

      // Always use ElevatorController as the main class name
      const mainClassName = `ElevatorController${iteration}`;
      const controllerFile = `/str/${mainClassName}.java`;

      window.cheerpOSAddStringFile(controllerFile, processedCode);

      const classPath = `/app${__BASE_URL__}tools.jar:/files/`;

      const compileResult = await window.cheerpjRunMain(
        "com.sun.tools.javac.Main",
        classPath,
        controllerFile,
        "-d",
        "/files/",
        "-Xlint:none",
      );

      if (compileResult !== 0) {
        throw new Error("Java compilation failed");
      }

      this.ElevatorController = await this.lib[mainClassName];
      this.loadedCode = code;
    } catch (error) {
      this.loadedCode = null;
      console.error(error);
      throw new Error(
        `Failed to compile Java code: ${error.message ?? error}${this.getLogBufferString()}`,
      );
    }
  }

  async start() {
    this.controller = await new this.ElevatorController();
  }

  async execute(elevators, floors) {
    if (!this.isLoaded) {
      throw new Error("Java runtime not loaded");
    }
    ELEVATORS = elevators;
    try {
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
      await this.controller.tick(javaElevators, javaFloors);
    } catch (error) {
      console.error(error);
      throw new Error(
        `Java execution failed: ${error.message ?? error}${this.getLogBufferString()}`,
      );
    }
  }

  getDefaultTemplate() {
    return `import java.util.*;
/**
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
     * Tick gets called on a regular, fast interval (a game loop)
     * @param elevators Array of all elevators
     * @param floors Array of all floors
     */
    public void tick(Elevator[] elevators, Floor[] floors) {
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

  cleanup() {
    this.isLoaded = false;
    this.loadedCode = null;
    this.lib = null;
    this.Elevator = null;
    this.Floor = null;
    this.Buttons = null;
    this.ElevatorController = null;
    this.controller = null;
    this.restoreConsoleLog();
    this.resetLogBuffer();
  }
}
