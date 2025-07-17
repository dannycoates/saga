#[allow(warnings)]
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
                        continue;
                    }
                }
            }
        }
    }
}

bindings::export!(Component with_types_in bindings);
