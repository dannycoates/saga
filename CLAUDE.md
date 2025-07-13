# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Elevator Saga is a multi-language elevator programming game where users write JavaScript, Python, or Java code to control elevators efficiently. The game is built with Vite, uses CodeMirror for the code editor, and features a modern event-driven architecture with backend abstraction.

## Commands

### Development
- `npm run dev` - Start development server on port 3000 with hot reloading
- `npm run build` - Build for production (outputs to `dist/`)
- `npm run preview` - Preview production build
- Assume the dev server (npm run dev) is already running

### Testing
- `npm run test:run` - Run tests once
- `npm run test` - Run tests in watch mode

## Modern Architecture

### Core Architecture Pattern

The codebase uses a **layered, event-driven architecture** with clear separation of concerns:

```
SimulationCore → JSSimulationBackend → World → DisplayManager → UI
     (Logic)       (Abstraction)     (Compat)    (Presentation)
```

### Key Components

**SimulationCore** (`src/core/SimulationCore.js`)
- Pure simulation engine handling game physics and logic
- Event-driven with immutable state snapshots
- Manages passengers, elevators, floors, and their interactions
- Emits `state_changed`, `stats_changed`, `passenger_spawned` events

**JSSimulationBackend** (`src/core/JSSimulationBackend.js`)
- Implements the `SimulationBackend` interface as an adapter layer
- Wraps `SimulationCore` and forwards its events
- Handles user code execution and error propagation
- Enables pluggable backends (JavaScript, WASM, Web Workers)

**World** (`src/core/World.js`)
- Compatibility layer maintaining legacy API while using modern architecture
- Composes `JSSimulationBackend` and `DisplayManager`
- Uses **AbortController** for proper event listener cleanup
- Provides backward compatibility properties (`transportedCounter`, `moveCount`, etc.)

**DisplayManager** (`src/ui/DisplayManager.js`)
- Pure presentation layer separated from simulation logic
- Manages display objects: floors, elevators, passengers
- Event-driven updates via subscription to backend events
- Can be completely disabled for headless operation

### Multi-Runtime System

**Runtime Architecture** (`src/runtimes/`)
- `BaseRuntime` - Abstract base class for language runtimes
- `RuntimeManager` - Handles language switching and code execution coordination
- Each runtime (`javascript.js`, `python.js`, `java.js`) implements: `loadRuntime()`, `loadCode()`, `execute()`, `getDefaultTemplate()`
- JavaScript uses ES modules with `data:text/javascript` imports
- Python uses Pyodide with wrapper classes that bridge JS objects
- Java uses CheerpJ with JNI callbacks (`Java_Elevator_jsGoToFloor`)

### Player Code Interface

All runtimes expose the same API contract:
```js
// Elevator API
elevator.currentFloor        // Current floor number
elevator.destinationFloor    // Destination or null
elevator.pressedFloorButtons // Array of pressed floor numbers
elevator.percentFull         // Load percentage (0-1)
elevator.goToFloor(floorNum) // Command to move

// Floor API
floor.buttons.up   // Boolean - up button pressed
floor.buttons.down // Boolean - down button pressed
floor.level        // Floor number

// Entry point
function tick(elevators, floors) { /* player code */ }
```

### Key Directories
- `/src/core/` - Core simulation engine (SimulationCore, World, entities)
- `/src/game/` - Game logic, challenges, and world management
- `/src/ui/` - UI presentation layer and display management
- `/src/runtimes/` - Multi-language runtime implementations
- `/tests/` - Test files mirroring src structure

### Event-Driven Architecture

The system uses **EventTarget** extensively for loose coupling:
- `SimulationCore` emits core events (`state_changed`, `stats_changed`, `passenger_spawned`)
- `JSSimulationBackend` forwards these events
- `DisplayManager` subscribes to backend events for UI updates
- `World` uses **AbortController** for proper event cleanup
- `worldManager` handles game loop and user code errors

### Critical Patterns

**Backend Abstraction**: The `SimulationBackend` interface enables pluggable implementations (JavaScript, WASM, Web Workers) without changing application code.

**Event Cleanup**: All event listeners use `AbortController` for proper cleanup, preventing memory leaks and start/stop bugs.

**Immutable State**: `SimulationCore` provides immutable state snapshots, preventing direct mutation and enabling consistent rendering.

**Multi-Language Bridging**: Each runtime maintains API parity through wrapper classes (Python) or JNI callbacks (Java).

## Testing Approach

The project uses Vitest with JSDOM for testing. Test files are in `/tests/` and follow the naming pattern `*.test.js`. Tests focus on:
- Core game mechanics and entity behaviors
- Architecture components (SimulationCore, DisplayManager, World)
- Multi-runtime compatibility
- Event-driven system behavior

## Development Tips

- Use Playwright for browser testing and console logs for debugging in the browser

## Important Files

- `src/core/World.js` - Main World class with AbortController event management
- `src/core/SimulationCore.js` - Core simulation engine
- `src/core/JSSimulationBackend.js` - Backend abstraction layer
- `src/ui/DisplayManager.js` - Presentation layer management
- `src/game/challenges.js` - Challenge definitions and evaluation
- `src/runtimes/RuntimeManager.js` - Multi-language runtime coordination
