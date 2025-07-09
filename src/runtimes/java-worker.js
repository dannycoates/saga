// Java runtime worker for executing compiled Java code

let lib = null;
let ElevatorController = null;
let Elevator = null;
let Floor = null;
let Buttons = null;
let cheerpjLoaded = false;
let controller = null;

// Register native methods that Java can call
async function Java_Elevator_jsGoToFloor(lib, elevatorId, floor) {
  // Send message back to main thread
  self.postMessage({
    type: "goToFloor",
    elevatorId,
    floor,
  });
}

self.addEventListener("message", async (event) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case "init":
        // Load CheerpJ if not already loaded
        if (!cheerpjLoaded) {
          self.importScripts("https://cjrtnc.leaningtech.com/4.1/loader.js");
          cheerpjLoaded = true;
        }
        // Initialize CheerpJ in the worker
        await self.cheerpjInit({
          status: "none",
          natives: {
            Java_Elevator_jsGoToFloor,
          },
        });

        // Write class files to virtual filesystem
        const { classFiles } = data;
        for (const [fileName, blob] of Object.entries(classFiles)) {
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          self.cheerpOSAddStringFile(`/str/${fileName}`, uint8Array);
        }

        lib = await self.cheerpjRunLibrary("/str/");

        Elevator = await lib.Elevator;
        Floor = await lib.Floor;
        Buttons = await lib.Floor$Buttons;
        ElevatorController = await lib.ElevatorController;
        controller = await new ElevatorController();

        self.postMessage({ type: "initialized" });
        break;

      case "execute":
        if (!lib || !ElevatorController) {
          throw new Error("Worker not initialized");
        }

        const { elevators, floors } = data;

        const javaElevators = [];
        for (let i = 0; i < elevators.length; i++) {
          const elevator = elevators[i];
          const javaElevator = await new Elevator();
          javaElevator.id = i;
          javaElevator.currentFloor = elevator.currentFloor;
          javaElevator.destinationFloor = elevator.destinationFloor;
          javaElevator.pressedFloorButtons = elevator.pressedFloorButtons || [];
          javaElevator.percentFull = elevator.percentFull;
          javaElevators.push(javaElevator);
        }

        const javaFloors = [];
        for (const floor of floors) {
          const javaFloor = await new Floor();
          javaFloor.level = floor.level;

          const buttons = await new Buttons();
          buttons.up = floor.buttons.up;
          buttons.down = floor.buttons.down;
          javaFloor.buttons = buttons;
          javaFloors.push(javaFloor);
        }

        await controller.update(javaElevators, javaFloors);

        self.postMessage({ type: "executed" });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error.message,
    });
  }
});
