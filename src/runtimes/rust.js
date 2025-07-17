import { RemoteCompiledBase } from "./RemoteCompiledBase.js";
import { tick, setGoToFloor } from "./wasm/rust_controller.js";

let ELEVATORS = [];

setGoToFloor(function goToFloor(id, level) {
  const elevator = ELEVATORS[id];
  elevator.goToFloor(level);
});

export class RustRuntime extends RemoteCompiledBase {
  constructor() {
    super("rust");
  }

  async loadCode(code) {}

  async execute(elevators, floors) {
    ELEVATORS = elevators;
    const vators = elevators.map((e, i) => ({
      id: i,
      currentFloor: e.currentFloor,
      destinationFloor: e.destinationFloor,
      pressedFloors: e.pressedFloorButtons,
      load: e.percentFull,
    }));
    const oors = floors.map((f) => ({
      level: f.level,
      upButton: f.buttons.up,
      downButton: f.buttons.down,
    }));
    tick(vators, oors);
  }

  getDefaultTemplate() {
    return `#[allow(warnings)]
mod bindings;

use bindings::Guest;

use crate::bindings::go_to_floor;
use crate::bindings::Elevator;
use crate::bindings::Floor;

struct Component;

impl Guest for Component {
    fn tick(elevators: Vec<Elevator>, floors: Vec<Floor>) {
        // Basic elevator control algorithm
        for elevator in &elevators {
            // If elevator has no destination and there are pressed floors, go to the first one
            if elevator.destination_floor.is_none() && !elevator.pressed_floors.is_empty() {
                let target_floor = elevator.pressed_floors[0];
                go_to_floor(elevator.id, target_floor);
                continue;
            }

            // If elevator has no destination, look for floor button presses
            if elevator.destination_floor.is_none() {
                for floor in &floors {
                    if floor.up_button || floor.down_button {
                        go_to_floor(elevator.id, floor.level);
                        break;
                    }
                }
            }
        }
    }
}

bindings::export!(Component with_types_in bindings);
`;
  }

  dispose() {
    super.dispose();
    this.wasmModule = null;
  }
}
