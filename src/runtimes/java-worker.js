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
          preloadResources: {
            "/lt/8/jre/lib/rt.jar": [
              0, 131072, 10354688, 10747904, 15204352, 15335424, 15466496,
              15597568, 17694720, 17956864, 18350080, 18612224, 21364736,
              21495808, 21626880, 21757952, 22020096, 22282240, 22544384,
              22806528, 23199744, 23330816, 23724032, 26869760,
            ],
            "/lt/etc/users": [0, 131072],
            "/lt/etc/localtime": [],
            "/lt/8/jre/lib/cheerpj-awt.jar": [0, 131072],
            "/lt/8/lib/ext/meta-index": [0, 131072],
            "/lt/8/lib/ext": [],
            "/lt/8/lib/ext/index.list": [],
            "/lt/8/lib/ext/localedata.jar": [],
            "/lt/8/jre/lib/jsse.jar": [0, 131072, 786432, 917504],
            "/lt/8/jre/lib/jce.jar": [0, 131072],
            "/lt/8/jre/lib/charsets.jar": [0, 131072, 1703936, 1835008],
            "/lt/8/jre/lib/resources.jar": [0, 131072, 917504, 1179648],
            "/lt/8/jre/lib/javaws.jar": [0, 131072, 1441792, 1703936],
            "/lt/8/lib/ext/sunec.jar": [],
            "/lt/8/lib/ext/sunjce_provider.jar": [],
            "/lt/8/lib/ext/zipfs.jar": [],
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
