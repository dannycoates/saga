import { JVMRuntime } from "./jvm.js";

// const ELEVATOR_SOURCE = `import java.util.*;
// /**
//  * Elevator class representing an elevator in the simulation
//  */
// public class Elevator {
//     public int id;
//     public int currentFloor;
//     public Integer destinationFloor;
//     public int[] pressedFloorButtons;
//     public double percentFull;

//     public Elevator(int id, int currentFloor, Integer destinationFloor, int[] pressedFloorButtons, double percentFull) {
//       this.id = id;
//       this.currentFloor = currentFloor;
//       this.destinationFloor = destinationFloor;
//       this.pressedFloorButtons = pressedFloorButtons;
//       this.precentFull = percentFull;
//     }

//     // Native method to call JavaScript
//     public static native void jsGoToFloor(int elevator, int floor);

//     /**
//      * Command the elevator to go to a specific floor
//      * @param floor The target floor number
//      */
//     public void goToFloor(int floor) {
//         // This will be handled by JavaScript
//         Elevator.jsGoToFloor(this.id, floor);
//     }
// }`;

const ELEVATOR_SOURCE = `/**
 * Elevator class representing an elevator in the simulation
 */
class Elevator(
  var id: Int,
  var currentFloor: Int,
  var destinationFloor: Integer,
  var pressedFloorButtons: Array[Int],
  var percentFull: Double
){

  /**
   * Command the elevator to go to a specific floor
   * @param floor The target floor number
   */
  def goToFloor(floor: Int): Unit = {
    // This will be handled by JavaScript through JNI
    JSNative.jsGoToFloor(this.id, floor)
  }
}

//object Elevator {
//  // Native method to call JavaScript
//  @native def jsGoToFloor(elevator: Int, floor: Int): Unit
//}`;

const FLOOR_SOURCE = `/**
 * Floor class representing a floor in the building
 */
class Floor(
  var level: Int,
  var buttons: Floor.Buttons
)


object Floor {
  /**
   * Class representing the up/down buttons on a floor
   */
  class Buttons(
    var up: Boolean,
    var down: Boolean
  )
}`;

let ELEVATORS = [];

async function Java_Elevator_jsGoToFloor(lib, self, elevatorId, floor) {
  console.log(Array.from(arguments));
  // Find the corresponding JavaScript elevator
  // const jsElevator = ELEVATORS[elevatorId];
  // if (jsElevator) {
  //   jsElevator.goToFloor(floor);
  // }
}

export class ScalaRuntime extends JVMRuntime {
  constructor() {
    super("scala", { Java_Elevator_jsGoToFloor });
    this.ElevatorController = null;
  }

  async compileLanguageSpecific() {
    // Compile Elevator and Floor classes in Scala
    const elevatorFile = "/str/Elevator.scala";
    const floorFile = "/str/Floor.scala";
    window.cheerpOSAddStringFile(elevatorFile, ELEVATOR_SOURCE);
    window.cheerpOSAddStringFile(floorFile, FLOOR_SOURCE);

    const classPath = `/app/scala-compiler.jar:/app/scala-library.jar:/app/scala-reflect.jar:/files/`;
    const compileResult = await window.cheerpjRunMain(
      "scala.tools.nsc.Main",
      classPath,
      elevatorFile,
      floorFile,
      "-d",
      "/files/",
      "-classpath",
      classPath,
    );

    if (compileResult !== 0) {
      throw new Error("Scala base class compilation failed");
    }
  }

  async loadCompiledClasses() {
    this.Elevator = await this.lib.Elevator;
    this.Floor = await this.lib.Floor;
    this.Buttons = await this.lib.Floor$Buttons;
  }

  async loadCode(code) {
    if (!this.loaded) {
      throw new Error("Scala runtime not loaded");
    }
    if (this.loadedCode === code) {
      return;
    }

    this.resetLogBuffer();

    try {
      const iteration = this.iteration++;

      // Find all class/object definitions in the code
      const classRegex = /(class|object)\s+(\w+)/g;
      const classNames = [];
      let match;

      while ((match = classRegex.exec(code)) !== null) {
        const className = match[2];
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
      const sourceFile = `/str/${mainClassName}.scala`;

      window.cheerpOSAddStringFile(sourceFile, processedCode);

      // Compile Scala code using the example you provided
      const classPath = `/app/scala-compiler.jar:/app/scala-library.jar:/app/scala-reflect.jar:/files/`;
      const compileResult = await window.cheerpjRunMain(
        "scala.tools.nsc.Main",
        classPath,
        sourceFile,
        "-d",
        "/files/",
        "-classpath",
        classPath,
      );

      if (compileResult !== 0) {
        throw new Error("Scala compilation failed");
      }

      this.ElevatorController = await this.lib[mainClassName];
      this.loadedCode = code;
    } catch (error) {
      this.loadedCode = null;
      console.error(error);
      throw new Error(
        `Failed to compile Scala code: ${error.message ?? error}${this.getLogBufferString()}`,
      );
    }
  }

  async start() {
    this.controller = await new this.ElevatorController();
  }

  async execute(elevators, floors) {
    super.execute(elevators, floors);
    try {
      const scalaFloors = [];
      for (const floor of floors) {
        const buttons = await new this.Buttons(false, false);
        const scalaFloor = await new this.Floor(floor.level, buttons);
        scalaFloors.push(scalaFloor);
      }
      // Create Scala wrapper objects for elevators and floors
      const scalaElevators = [];
      let index = 0;
      for (const elevator of elevators) {
        const scalaElevator = await new this.Elevator(
          index++,
          elevator.currentFloor,
          elevator.destinationFloor,
          elevator.pressedFloorButtons ?? [],
          elevator.percentFull,
        );
        scalaElevators.push(scalaElevator);
      }

      await this.controller.tick(scalaElevators, scalaFloors);
    } catch (error) {
      throw new Error(
        `Scala execution failed: ${await error.toString()}${this.getLogBufferString()}`,
      );
    }
  }

  getDefaultTemplate() {
    return `import scala.collection.mutable.ArrayBuffer

/**
 * Floor class:
 *   Accessors:
 *     buttons.up - Boolean: true if up button is pressed
 *     buttons.down - Boolean: true if down button is pressed
 *     level - Int: floor number (0-indexed)
 *
 * Elevator class:
 *   Accessors:
 *     currentFloor - Int: current floor number
 *     destinationFloor - Integer: destination floor or null if idle
 *     pressedFloorButtons - Array[Int]: array of pressed floor buttons
 *     percentFull - Double: load percentage (0.0 to 1.0)
 *
 *   Methods:
 *     goToFloor(floorNum: Int) - command elevator to go to floor
 */
class ElevatorController {
  private var nextFloor = 1

  /**
   * Tick gets called on a regular, fast interval (a game loop)
   * @param elevators Array of all elevators
   * @param floors Array of all floors
   */
  def tick(elevators: Array[Elevator], floors: Array[Floor]): Unit = {
    val elevator = elevators(0)

    if (elevator.destinationFloor == null) {
      if (nextFloor >= floors.length) {
        nextFloor = 0
      }
      nextFloor = nextFloor + 1
      elevator.goToFloor(nextFloor)
    }
  }
}`;
  }

  dispose() {
    super.dispose();
    this.ElevatorController = null;
  }
}
