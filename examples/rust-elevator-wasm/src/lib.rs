// WASM module with proper memory parsing for Elevator Saga

extern "C" {
    // Import function that the JS runtime will provide
    fn gofloor(elevator_id: u32, floor_num: u32);
}

// Data structures matching the JavaScript memory layout
#[repr(C)]
pub struct Elevator {
    pub id: u32,
    pub current_floor: u32,
    pub destination_floor: i32, // -1 for None, floor number for Some
    pub pressed_floors_ptr: *const u32,
    pub pressed_floors_len: u32,
    pub load: f32,
}

#[repr(C)]
pub struct Floor {
    pub level: u32,
    pub up_button: u32, // bool as u32 (0 or 1)
    pub down_button: u32, // bool as u32 (0 or 1)
}

#[derive(Clone, Copy, PartialEq)]
enum Direction {
    Up,
    Down,
}

// Global controller instance (simplified for core WASM)
static mut CONTROLLER: Option<SimpleElevatorController> = None;

/// Get or initialize the global controller
fn get_controller() -> &'static mut SimpleElevatorController {
    unsafe {
        if CONTROLLER.is_none() {
            CONTROLLER = Some(SimpleElevatorController::new());
        }
        CONTROLLER.as_mut().unwrap()
    }
}

/// Main entry point exported to JavaScript
/// This function will be called by the game engine
#[no_mangle]
pub extern "C" fn tick(
    elevators_ptr: u32,
    elevators_len: u32,
    floors_ptr: u32,
    floors_len: u32,
) {
    let controller = get_controller();
    
    // Parse elevator data from memory
    let elevators = unsafe {
        core::slice::from_raw_parts(elevators_ptr as *const Elevator, elevators_len as usize)
    };
    
    // Parse floor data from memory
    let floors = unsafe {
        core::slice::from_raw_parts(floors_ptr as *const Floor, floors_len as usize)
    };
    
    // Run the intelligent elevator algorithm
    for (elevator_id, elevator) in elevators.iter().enumerate() {
        let target_floor = controller.get_best_target_floor(elevator, floors);
        
        // Only send command if we have a different target
        if target_floor != elevator.current_floor {
            unsafe {
                gofloor(elevator_id as u32, target_floor);
            }
        }
    }
    
    controller.tick_count += 1;
}

/// Intelligent elevator controller using real game data
pub struct SimpleElevatorController {
    /// Tick counter for timing
    tick_count: u32,
}

impl SimpleElevatorController {
    fn new() -> Self {
        Self {
            tick_count: 0,
        }
    }

    fn get_best_target_floor(&self, elevator: &Elevator, floors: &[Floor]) -> u32 {
        let current_floor = elevator.current_floor;
        let num_floors = floors.len() as u32;
        
        // Priority 1: Service pressed floor buttons in the elevator
        let pressed_floors = unsafe {
            if !elevator.pressed_floors_ptr.is_null() && elevator.pressed_floors_len > 0 {
                core::slice::from_raw_parts(elevator.pressed_floors_ptr, elevator.pressed_floors_len as usize)
            } else {
                &[]
            }
        };
        
        if !pressed_floors.is_empty() {
            // Find the closest pressed floor
            let mut best_floor = pressed_floors[0];
            let mut best_distance = distance(current_floor, best_floor);
            
            for &floor in pressed_floors.iter().skip(1) {
                let dist = distance(current_floor, floor);
                if dist < best_distance {
                    best_distance = dist;
                    best_floor = floor;
                }
            }
            return best_floor;
        }
        
        // Priority 2: Service floor call buttons
        let mut best_floor = current_floor;
        let mut best_score = f32::NEG_INFINITY;
        
        for (floor_idx, floor) in floors.iter().enumerate() {
            let floor_num = floor_idx as u32;
            let has_call = floor.up_button != 0 || floor.down_button != 0;
            
            if has_call {
                let dist = distance(current_floor, floor_num);
                
                // Score based on distance (closer is better) and load considerations
                let mut score = 1.0 / (dist as f32 + 1.0);
                
                // Prefer calls in the direction we're already moving
                if let Some(dest) = get_destination(elevator) {
                    let moving_up = dest > current_floor;
                    if (moving_up && floor.up_button != 0) || (!moving_up && floor.down_button != 0) {
                        score *= 2.0; // Bonus for same direction
                    }
                }
                
                // Avoid overloaded elevators taking new passengers
                if elevator.load > 0.8 {
                    score *= 0.3;
                }
                
                if score > best_score {
                    best_score = score;
                    best_floor = floor_num;
                }
            }
        }
        
        // Priority 3: If no calls, implement intelligent positioning
        if best_score == f32::NEG_INFINITY {
            // Position based on load patterns and elevator spacing
            best_floor = self.get_strategic_position(elevator, num_floors);
        }
        
        best_floor
    }
    
    fn get_strategic_position(&self, elevator: &Elevator, num_floors: u32) -> u32 {
        let current_floor = elevator.current_floor;
        
        // If elevator is empty, position strategically
        if elevator.load < 0.1 {
            // Time-based positioning to spread elevators
            let cycle_time = 100;
            let phase = (self.tick_count + elevator.id * 25) % cycle_time;
            
            if phase < cycle_time / 3 {
                // Go to bottom third
                (num_floors / 3).max(1)
            } else if phase < 2 * cycle_time / 3 {
                // Go to middle
                num_floors / 2
            } else {
                // Go to top third
                ((2 * num_floors) / 3).min(num_floors - 1)
            }
        } else {
            // If carrying passengers but no destination, stay put
            current_floor
        }
    }
}

// Helper functions
fn distance(a: u32, b: u32) -> u32 {
    if a > b { a - b } else { b - a }
}

fn get_destination(elevator: &Elevator) -> Option<u32> {
    if elevator.destination_floor >= 0 {
        Some(elevator.destination_floor as u32)
    } else {
        None
    }
}