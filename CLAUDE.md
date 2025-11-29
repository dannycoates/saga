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

The codebase uses a **streamlined, event-driven architecture** with clear separation of concerns:

```
JSSimulationBackend → GameController → ViewModelManager → UI
   (Simulation)       (Game Control)    (View Models)
```

### Key Components

**JSSimulationBackend** (`src/core/JSSimulationBackend.js`)
- Primary simulation engine handling game physics and logic
- Event-driven with direct state management
- Manages passengers, elevators, floors, and their interactions
- Handles user code execution and error propagation
- Emits `state_changed`, `stats_changed`, `passenger_spawned` events

**GameController** (`src/game/GameController.js`)
- Main game orchestrator and controller
- Composes `JSSimulationBackend` and `ViewModelManager`
- Manages game loops, user code execution, and challenge evaluation
- Uses **AbortController** for proper event listener cleanup
- Provides game state properties (`transportedCounter`, `moveCount`, etc.)

**ViewModelManager** (`src/ui/ViewModelManager.js`)
- View model layer separated from simulation logic
- Manages view models: floors, elevators, passengers
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
- `JSSimulationBackend` emits core events (`state_changed`, `stats_changed`, `passenger_spawned`)
- `ViewModelManager` subscribes to backend events for view model updates
- `GameController` uses **AbortController** for proper event cleanup
- `GameController` handles game loop and user code errors

### Critical Patterns

**Backend Abstraction**: The `SimulationBackend` interface enables pluggable implementations (JavaScript, WASM, Web Workers) without changing application code.

**Event Cleanup**: All event listeners use `AbortController` for proper cleanup, preventing memory leaks and start/stop bugs.

**Direct State Management**: `JSSimulationBackend` manages simulation state directly, providing consistent state updates and rendering.

**Multi-Language Bridging**: Each runtime maintains API parity through wrapper classes (Python) or JNI callbacks (Java).

## Testing Approach

The project uses Vitest with JSDOM for testing. Test files are in `/tests/` and follow the naming pattern `*.test.js`. Tests focus on:
- Core game mechanics and entity behaviors
- Architecture components (JSSimulationBackend, ViewModelManager, GameController)
- Multi-runtime compatibility
- Event-driven system behavior

## Development Tips

- Use Playwright for browser testing and console logs for debugging in the browser

## Important Files

- `src/game/GameController.js` - Main game orchestrator with AbortController event management
- `src/core/JSSimulationBackend.js` - Primary simulation engine and backend
- `src/ui/ViewModelManager.js` - View model layer management
- `src/game/challenges.js` - Challenge definitions and evaluation
- `src/runtimes/RuntimeManager.js` - Multi-language runtime coordination
