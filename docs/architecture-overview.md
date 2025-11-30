# Elevator Saga Architecture Overview

This document provides a high-level overview of the Elevator Saga codebase architecture.

## What is Elevator Saga?

Elevator Saga is a multi-language elevator programming game where users write JavaScript, Python, or Java code to control elevators efficiently. Players implement a `tick()` function that runs every game frame, making decisions about where elevators should go based on passenger requests.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ElevatorApp                                     │
│                        (Application Orchestrator)                            │
│                                                                             │
│  Composes all systems, manages lifecycle, handles user interactions         │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────────┐
│   Runtime System  │     │    Game Logic     │     │       UI Layer        │
│                   │     │                   │     │                       │
│  ┌─────────────┐  │     │  ┌─────────────┐  │     │  ┌─────────────────┐  │
│  │RuntimeManager│ │     │  │GameController │  │     │  │ ViewModelManager  │  │
│  └─────────────┘  │     │  └─────────────┘  │     │  └─────────────────┘  │
│         │         │     │         │         │     │          │            │
│  ┌──────┴──────┐  │     │  ┌──────┴──────┐  │     │  ┌───────┴────────┐   │
│  │  Runtimes   │  │     │  │ Challenges  │  │     │  │ Web Components │   │
│  │ JS/Py/Java  │  │     │  │ Evaluation  │  │     │  │ View Models   │   │
│  └─────────────┘  │     │  └─────────────┘  │     │  └────────────────┘   │
└───────────────────┘     └─────────┬─────────┘     └───────────────────────┘
                                    │
                                    ▼
                          ┌───────────────────┐
                          │  Core Simulation  │
                          │                   │
                          │ ┌───────────────┐ │
                          │ │JSSimulation   │ │
                          │ │Backend        │ │
                          │ └───────────────┘ │
                          │        │          │
                          │ ┌──────┴────────┐ │
                          │ │   Entities    │ │
                          │ │Elevator/Floor │ │
                          │ │  /Passenger   │ │
                          │ └───────────────┘ │
                          └───────────────────┘
```

---

## Layer Responsibilities

### 1. ElevatorApp (Orchestrator)
**File**: `src/app.js`

The top-level application class that:
- Initializes and composes all subsystems
- Manages application lifecycle (start, stop, reset)
- Handles user interactions (challenge selection, code execution)
- Coordinates between runtime, game, and UI layers

### 2. Runtime System
**Directory**: `src/runtimes/`

Handles multi-language code execution:
- **RuntimeManager**: Coordinates language switching and code loading
- **JavaScript Runtime**: Native ES module execution
- **Python Runtime**: Pyodide-based Python interpreter
- **Java Runtime**: CheerpJ-based Java compiler

All runtimes expose an identical API to user code, enabling language-agnostic game logic.

### 3. Game Logic Layer
**Directory**: `src/game/`

Manages game flow and rules:
- **GameController**: Game loop controller, coordinates backend and display
- **Challenges**: 16 progressive challenges with evaluation criteria

### 4. UI Layer
**Directory**: `src/ui/`

Pure presentation layer:
- **ViewModelManager**: Manages view model objects for visual representation
- **View Models**: ElevatorViewModel, FloorViewModel, PassengerViewModel
- **Web Components**: Custom elements for elevator, floor, passenger, stats
- **CodeEditor**: CodeMirror-based multi-language editor

### 5. Core Simulation
**Directory**: `src/core/`

Physics and game state engine:
- **JSSimulationBackend**: Main simulation implementation
- **Entities**: Elevator, Floor, Passenger classes
- Event-driven state management

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      Build & Development                     │
├─────────────────────────────────────────────────────────────┤
│  Vite          │ Build tool, dev server, hot reloading      │
│  Vitest        │ Unit testing framework                     │
│  JSDOM         │ DOM simulation for tests                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        Code Editor                           │
├─────────────────────────────────────────────────────────────┤
│  CodeMirror 6  │ Modern extensible code editor              │
│  lang-*        │ JavaScript, Python, Java syntax support    │
│  Gruvbox       │ Light and dark themes                      │
│  ESLint        │ JavaScript linting in browser              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Language Runtimes                         │
├─────────────────────────────────────────────────────────────┤
│  Native JS     │ ES modules via data: URLs                  │
│  Pyodide       │ Python compiled to WebAssembly             │
│  CheerpJ       │ Java-to-JavaScript compiler                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      UI Framework                            │
├─────────────────────────────────────────────────────────────┤
│  Web Components│ Custom elements with Shadow DOM            │
│  EventBus      │ Centralized event hub (extends EventTarget)│
│  CSS Variables │ Dynamic theming and styling                │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Design Principles

### 1. Event-Driven Architecture with EventBus
Components communicate through a centralized **EventBus** rather than direct method calls:
- All events flow through a single EventBus instance
- Events use namespaced naming: `simulation:*`, `game:*`, `viewmodel:*`
- Loose coupling - components only need the eventBus reference
- No event forwarding or re-emission needed
- EventBus injected via dependency injection

```
JSSimulationBackend ──► EventBus ◄── ViewModelManager
GameController ────────►   ↑   ◄──── AppEventHandlers
                           │
                     Web Components
```

### 2. Composition Over Inheritance
Major systems are composed together rather than inherited:
- GameController coordinates Backend and ViewModelManager
- ElevatorApp composes all subsystems
- Easy to swap implementations

### 3. Backend Abstraction
The `SimulationBackend` interface enables pluggable implementations:
- Current: JSSimulationBackend (JavaScript)
- Future: WASM backend, Web Worker backend
- No changes needed to GameController or UI

### 4. Resource Cleanup with AbortController
All event listeners use AbortController for proper cleanup:
- Prevents memory leaks between challenges
- Single `abort()` removes all listeners
- Pattern used throughout codebase

### 5. Separation of Simulation and Presentation
- Core simulation has no knowledge of rendering
- ViewModelManager can be completely disabled (headless mode)
- Enables fast automated testing

---

## Data Flow Overview

```
User Code                  Simulation                    EventBus                    Display
    │                          │                            │                            │
    │  tick(elevators,floors)  │                            │                            │
    ├─────────────────────────►│                            │                            │
    │                          │                            │                            │
    │  elevator.goToFloor(n)   │                            │                            │
    ├─────────────────────────►│                            │                            │
    │                          │                            │                            │
    │                          │  backend.tick(dt)          │                            │
    │                          ├────────────────────────────┤                            │
    │                          │                            │                            │
    │                          │  simulation:state_changed  │                            │
    │                          ├───────────────────────────►├───────────────────────────►│
    │                          │                            │                            │
    │                          │                            │               updateDisplays()
    │                          │                            │                            │
```

---

## Entry Points

| Entry Point | Purpose |
|-------------|---------|
| `index.html` | Main HTML page, loads app.js |
| `src/app.js` | Application initialization |
| `src/game/GameController.js` | Game loop entry |
| `src/runtimes/manager.js` | Code execution entry |

---

## Related Documentation

- [Component Diagrams](./architecture-components.md) - Detailed component relationships
- [Sequence Diagrams](./architecture-sequences.md) - Execution flow details
- [File Reference](./architecture-files.md) - Directory structure guide
