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

The codebase uses a **streamlined, event-driven architecture** with a central EventBus for loose coupling:

```
                         EventBus
                            ↑
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
JSSimulationBackend   GameController    ViewModelManager → UI
   (Simulation)       (Game Control)      (View Models)
```

All components communicate through a shared `EventBus` instance injected via dependency injection.

### Key Components

**EventBus** (`src/utils/EventBus.js`)

- Central event bus extending `EventTarget` for application-wide events
- Provides `emit(name, detail)`, `on(name, handler, options)`, `off(name, handler)` methods
- Events use namespaced naming: `simulation:*`, `game:*`, `viewmodel:*`
- Injected via dependency injection to all major components

**JSSimulationBackend** (`src/core/JSSimulationBackend.js`)

- Primary simulation engine handling game physics and logic
- Receives `eventBus` in constructor for event emission
- Manages passengers, elevators, floors, and their interactions
- Handles user code execution and error propagation
- Emits `simulation:state_changed`, `simulation:stats_changed`, `simulation:passenger_spawned`, `simulation:challenge_ended` events

**GameController** (`src/game/GameController.js`)

- Main game orchestrator and controller
- Receives `eventBus` in constructor, passes it to `JSSimulationBackend`
- Manages game loops, user code execution, and challenge evaluation
- Uses **AbortController** for proper event listener cleanup
- Emits `game:challenge_initialized`, `game:simulation_started`, `game:timescale_changed`

**ViewModelManager** (`src/ui/ViewModelManager.js`)

- View model layer separated from simulation logic
- Manages view models: floors, elevators, passengers
- Subscribes to `simulation:*` events via eventBus for updates
- Emits `viewmodel:passenger_created` after creating passenger view models
- Can be completely disabled for headless operation

### Multi-Runtime System

**Runtime Architecture** (`src/runtimes/`)

- `BaseRuntime.js` - Abstract base class for language runtimes
- `RuntimeManager.js` - Handles language switching and code execution coordination
- Each runtime (`JavaScriptRuntime.js`, `PythonRuntime.js`, `JavaRuntime.js`) implements: `loadRuntime()`, `loadCode()`, `execute()`, `getDefaultTemplate()`
- JavaScript uses ES modules with `data:text/javascript` imports
- Python uses Pyodide with wrapper classes that bridge JS objects
- Java uses CheerpJ with JNI callbacks (`Java_Elevator_jsGoToFloor`)

### Player Code Interface

All runtimes expose the same API contract:

```js
// Elevator API
elevator.currentFloor; // Current floor number
elevator.destinationFloor; // Destination or null
elevator.pressedFloorButtons; // Array of pressed floor numbers
elevator.percentFull; // Load percentage (0-1)
elevator.goToFloor(floorNum); // Command to move

// Floor API
floor.buttons.up; // Boolean - up button pressed
floor.buttons.down; // Boolean - down button pressed
floor.level; // Floor number

// Entry point
function tick(elevators, floors) {
  /* player code */
}
```

### Key Directories

- `/src/core/` - Core simulation engine (JSSimulationBackend, entities)
- `/src/game/` - Game logic (GameController, challenges)
- `/src/ui/` - UI presentation layer (ViewModelManager, view models, web components)
- `/src/runtimes/` - Multi-language runtime implementations
- `/src/utils/` - Shared utilities (EventBus, AsyncUtils, common, URLManager)
- `/tests/` - Test files mirroring src structure

### Event-Driven Architecture

The system uses a centralized **EventBus** for loose coupling between components:

**Event Namespaces:**

- `simulation:*` - Core simulation events from JSSimulationBackend
- `game:*` - Game lifecycle events from GameController
- `viewmodel:*` - View model events from ViewModelManager
- `app:*` - Application-level events (e.g., user code errors)

**Key Events:**
| Event | Source | Description |
|-------|--------|-------------|
| `simulation:state_changed` | JSSimulationBackend | Emitted each tick with current state |
| `simulation:stats_changed` | JSSimulationBackend | Statistics update (throttled) |
| `simulation:passenger_spawned` | JSSimulationBackend | New passenger created |
| `simulation:challenge_ended` | JSSimulationBackend | Challenge win/lose condition met |
| `game:challenge_initialized` | GameController | New challenge loaded |
| `game:simulation_started` | GameController | Simulation started |
| `game:timescale_changed` | GameController | Time scale adjusted |
| `viewmodel:passenger_created` | ViewModelManager | Passenger view model ready for rendering |

**Pattern Benefits:**

- No event forwarding/re-emission between components
- All subscribers are equal - no ordering dependencies
- Components don't need references to each other, just the eventBus
- Clean separation via dependency injection

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

- `src/utils/EventBus.js` - Central event bus for application-wide communication
- `src/game/GameController.js` - Main game orchestrator with AbortController event management
- `src/core/JSSimulationBackend.js` - Primary simulation engine and backend
- `src/ui/ViewModelManager.js` - View model layer management
- `src/ui/AppEventHandlers.js` - UI event subscriptions and handlers
- `src/game/challenges.js` - Challenge definitions and evaluation
- `src/runtimes/RuntimeManager.js` - Multi-language runtime coordination
