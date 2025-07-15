import { BaseRuntime } from "./base.js";

export class WasmRuntime extends BaseRuntime {
  constructor() {
    super("wasm");
    this.wasmModule = null;
    this.wasmInstance = null;
    this.wasmFile = null;
    this.elevatorActions = new Map(); // Track elevator action callbacks
  }

  async loadRuntime() {
    // WASM runtime is always available in modern browsers
    if (!WebAssembly) {
      throw new Error("WebAssembly is not supported in this browser");
    }
    this.loaded = true;
  }

  async loadCode(wasmArrayBuffer) {
    if (!wasmArrayBuffer || !(wasmArrayBuffer instanceof ArrayBuffer)) {
      throw new Error("Invalid WASM file provided");
    }

    try {
      // Compile the WASM module
      this.wasmModule = await WebAssembly.compile(wasmArrayBuffer);
      
      // Create import object with elevator actions
      const importObject = {
        env: {
          gofloor: (elevatorId, floorNum) => {
            // Store the action to be executed during the game tick
            this.elevatorActions.set(elevatorId, floorNum);
          }
        }
      };

      // Instantiate the WASM module
      this.wasmInstance = await WebAssembly.instantiate(this.wasmModule, importObject);
      
      // Verify the expected exports exist
      if (!this.wasmInstance.exports.tick) {
        throw new Error("WASM module must export a 'tick' function");
      }

      this.wasmFile = wasmArrayBuffer;
      this.loadedCode = "[WASM Module Loaded]";
    } catch (error) {
      throw new Error(`Failed to load WASM module: ${error.message}`);
    }
  }

  async execute(elevators, floors) {
    if (!this.wasmInstance) {
      throw new Error("No WASM module loaded. Call loadCode() first.");
    }

    try {
      // Clear previous elevator actions
      this.elevatorActions.clear();

      // Get WASM memory
      const memory = this.wasmInstance.exports.memory;
      const memoryView = new DataView(memory.buffer);
      
      // Allocate memory for elevator data
      const elevatorStructSize = 24; // id(4) + current_floor(4) + destination_floor(4) + pressed_floors_ptr(4) + pressed_floors_len(4) + load(4)
      const floorStructSize = 12; // level(4) + up_button(4) + down_button(4)
      
      const elevatorsMemorySize = elevators.length * elevatorStructSize;
      const floorsMemorySize = floors.length * floorStructSize;
      
      // Find available memory region (simple allocation after heap_base)
      const heapBase = this.wasmInstance.exports.__heap_base?.value || 65536;
      let currentOffset = heapBase;
      
      const elevatorsPtr = currentOffset;
      currentOffset += elevatorsMemorySize;
      
      const floorsPtr = currentOffset;
      currentOffset += floorsMemorySize;
      
      // Allocate space for pressed floors arrays
      let pressedFloorsOffset = currentOffset;
      
      // Write elevator data to memory
      for (let i = 0; i < elevators.length; i++) {
        const elevator = elevators[i];
        const offset = elevatorsPtr + i * elevatorStructSize;
        
        // Write elevator struct
        memoryView.setUint32(offset, i, true); // id
        memoryView.setUint32(offset + 4, elevator.currentFloor || 0, true); // current_floor
        memoryView.setInt32(offset + 8, elevator.destinationFloor ?? -1, true); // destination_floor (-1 for None)
        
        // Write pressed floors array
        const pressedFloors = elevator.pressedFloorButtons || [];
        memoryView.setUint32(offset + 12, pressedFloorsOffset, true); // pressed_floors_ptr
        memoryView.setUint32(offset + 16, pressedFloors.length, true); // pressed_floors_len
        
        // Write pressed floors data
        for (let j = 0; j < pressedFloors.length; j++) {
          memoryView.setUint32(pressedFloorsOffset + j * 4, pressedFloors[j], true);
        }
        pressedFloorsOffset += pressedFloors.length * 4;
        
        // Write load as float32
        memoryView.setFloat32(offset + 20, elevator.percentFull || 0, true);
      }
      
      // Write floor data to memory
      for (let i = 0; i < floors.length; i++) {
        const floor = floors[i];
        const offset = floorsPtr + i * floorStructSize;
        
        memoryView.setUint32(offset, i, true); // level
        memoryView.setUint32(offset + 4, floor.buttons?.up ? 1 : 0, true); // up_button (bool as u32)
        memoryView.setUint32(offset + 8, floor.buttons?.down ? 1 : 0, true); // down_button (bool as u32)
      }

      // Call the WASM tick function with actual memory pointers
      this.wasmInstance.exports.tick(elevatorsPtr, elevators.length, floorsPtr, floors.length);

      // Execute any elevator actions that were registered during the tick
      for (const [elevatorId, floorNum] of this.elevatorActions) {
        if (elevators[elevatorId] && typeof elevators[elevatorId].goToFloor === 'function') {
          elevators[elevatorId].goToFloor(floorNum);
        }
      }

    } catch (error) {
      throw new Error(`WASM execution error: ${error.message}`);
    }
  }

  getDefaultTemplate() {
    return `/*
This is a WebAssembly runtime for Elevator Saga.

To use this runtime:
1. Implement the elevator-api.wit interface in your preferred language (Rust, C++, etc.)
2. Compile your code to a WASM component
3. Upload the .wasm file using the file selector

Your WASM component must export a 'tick' function that accepts:
- elevators: list of elevator states (id, current-floor, destination-floor, pressed-floors, load)
- floors: list of floor states (level, up-button, down-button)

You can call gofloor(elevator-id, floor-num) to control elevators.

See elevator-api.wit for the complete interface specification.

Example structure:
world elevator {
  import gofloor: func(elevator-id: u32, floor-num: u32);
  export tick: func(elevators: list<elevator>, floors: list<floor>);
  
  record elevator {
    id: u32,
    current-floor: u32,
    destination-floor: option<u32>,
    pressed-floors: list<u32>,
    load: f32,
  }

  record floor {
    level: u32,
    up-button: bool,
    down-button: bool,
  }
}
*/`;
  }

  dispose() {
    this.wasmModule = null;
    this.wasmInstance = null;
    this.wasmFile = null;
    this.elevatorActions.clear();
    this.loadedCode = null;
  }

  // Additional method to check if a WASM file is loaded
  hasWasmFile() {
    return this.wasmFile !== null;
  }

  // Method to get file info for UI display
  getFileInfo() {
    if (!this.wasmFile) return null;
    return {
      size: this.wasmFile.byteLength,
      loaded: !!this.wasmInstance
    };
  }
}