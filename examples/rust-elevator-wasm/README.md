# Rust Elevator WASM Example

This is a complete example of implementing an elevator controller in Rust that compiles to WebAssembly for use with Elevator Saga.

## Overview

This example implements an intelligent elevator control algorithm that parses real game data from memory:

- **Real data parsing**: Reads actual elevator and floor states from WASM memory
- **Priority-based decisions**: Services pressed buttons first, then floor calls, then strategic positioning
- **Load awareness**: Considers elevator capacity when taking new passengers
- **Direction optimization**: Prefers calls in the current direction of travel
- **Strategic positioning**: Spreads elevators across floors when idle

## Algorithm Strategy

1. **Priority 1**: Service pressed floor buttons inside elevators (closest first)
2. **Priority 2**: Respond to floor call buttons with intelligent scoring:
   - Distance-based scoring (closer floors preferred)
   - Direction bonuses (same direction as current movement)
   - Load consideration (avoid overloaded elevators taking new calls)
3. **Priority 3**: Strategic positioning when idle:
   - Time-based cycling through floor zones
   - Elevator spacing to avoid clustering

## Building

### Prerequisites

You'll need:
- Rust (install from [rustup.rs](https://rustup.rs/))

```bash
# Add the WebAssembly target
rustup target add wasm32-unknown-unknown
```

### Build Steps

1. **Using the build script** (recommended):
   ```bash
   ./build.sh
   ```

2. **Manual build with cargo-component**:
   ```bash
   cargo component build --release
   cp target/wasm32-wasip2/release/rust_elevator_wasm.wasm elevator-controller.wasm
   ```

3. **Manual build with standard cargo** (fallback):
   ```bash
   cargo build --target wasm32-wasip2 --release
   wasm-tools component new target/wasm32-wasip2/release/rust_elevator_wasm.wasm \
     -o elevator-controller.wasm
   ```

4. **The resulting `elevator-controller.wasm` file can be uploaded to Elevator Saga**

## File Structure

```
rust-elevator-wasm/
├── Cargo.toml          # Rust project configuration
├── wit/
│   └── world.wit       # WIT interface definition
├── src/
│   └── lib.rs          # Main Rust implementation
└── README.md           # This file
```

## Code Explanation

### Core Components

- **`ElevatorController`**: Main struct containing the control logic
- **`Direction` enum**: Tracks elevator movement direction for coordination
- **State tracking**: Maintains next target floors and directions for each elevator

### Key Functions

- **`get_best_target_floor()`**: Analyzes real game state to find optimal destination
- **`get_strategic_position()`**: Positions idle elevators to minimize future wait times
- **Memory parsing**: Safely reads elevator and floor data from WASM linear memory

### WASM Interface Implementation

The code implements a core WASM interface:
- **`tick()`**: Called every game frame with real elevator/floor data in memory
- **`gofloor()`**: Command function to move elevators to target floors
- **Memory layout**: Parses C-style structs from JavaScript-allocated memory
- **Compact size**: Only 1.6KB WASM module with full data parsing

## Usage in Elevator Saga

1. Enter the Konami code (↑↑↓↓←→←→BA) to unlock WebAssembly runtime
2. Select "WebAssembly" from the language dropdown
3. Upload the compiled `elevator-controller.wasm` file
4. Click "Apply" to run your Rust elevator controller!

## Customization

You can modify the algorithm by:
- Adjusting the load threshold (currently 80% in load awareness logic)
- Changing the scoring weights in `get_best_target_floor()`
- Modifying the strategic positioning cycle in `get_strategic_position()`
- Adding more sophisticated multi-elevator coordination

## Performance Tips

- Parses real game state for accurate decision-making
- Uses priority-based decisions to minimize passenger wait times
- Considers elevator load and direction for efficient service
- Implements strategic positioning to reduce future wait times
- Maintains minimal state for maximum WASM efficiency