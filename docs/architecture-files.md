# Elevator Saga File Reference

This document provides a complete reference of the codebase structure with file descriptions.

---

## Directory Overview

```
saga/
├── docs/                    # Architecture documentation
├── public/                  # Static assets
├── src/                     # Source code
│   ├── config/              # Application configuration
│   ├── core/                # Simulation engine
│   ├── game/                # Game logic
│   ├── runtimes/            # Multi-language support
│   ├── ui/                  # User interface
│   │   ├── components/      # Web components
│   │   └── viewmodels/      # View model objects
│   └── utils/               # Utility functions
├── tests/                   # Test files
├── index.html               # Entry point
├── package.json             # Dependencies
└── vite.config.js           # Build configuration
```

---

## Root Files

| File | Purpose |
|------|---------|
| `index.html` | Main HTML entry point. Loads `src/app.js`, contains DOM structure for the game UI including world container, code editor, controls, and stats display. |
| `package.json` | NPM configuration with dependencies (CodeMirror, themes) and scripts (dev, build, test). |
| `vite.config.js` | Vite build configuration. Dev server on port 3000, chunk splitting, sourcemaps. |
| `CLAUDE.md` | AI assistant guidelines for understanding and working with the codebase. |
| `README.md` | Project documentation and setup instructions. |
| `LICENSE.txt` | MIT license. |

---

## Source Code (`src/`)

### Entry Point

| File | Purpose |
|------|---------|
| `app.js` | **ElevatorApp** class - Main application orchestrator. Composes RuntimeManager, CodeEditor, GameController, AppDOM, and AppEventHandlers. Manages application lifecycle, challenge loading, and user interactions. |
| `style.css` | Global styles for the application layout, game world, and UI elements. |

---

### Configuration (`src/config/`)

| File | Purpose |
|------|---------|
| `constants.js` | Application-wide constants including DOM selectors, frame rate settings, localStorage keys, and default values. |

---

### Core Simulation (`src/core/`)

The simulation engine that handles game physics and entity management.

| File | Purpose |
|------|---------|
| `SimulationBackend.js` | **Abstract base class** extending EventTarget. Defines interface for all backend implementations: `initialize()`, `tick()`, `getState()`, `callUserCode()`, `getStats()`, `hasEnded()`, `cleanup()`. |
| `JSSimulationBackend.js` | **Main simulation implementation**. Manages floors, elevators, passengers. Handles spawning, physics updates, boarding/exiting logic, statistics tracking. Emits events: `state_changed`, `stats_changed`, `passenger_spawned`, `passengers_exited`, `passengers_boarded`, `challenge_ended`. |
| `Elevator.js` | **Elevator entity class**. Properties: position, velocity, destination, passengers, buttons, indicators. Methods: `tick()` for physics, `goToFloor()`, `addPassenger()`, `removePassenger()`, `toAPI()` for player code, `toJSON()` for display. |
| `Floor.js` | **Floor entity class**. Properties: level, buttons (up/down). Methods: `pressButton()`, `clearButton()`, `toJSON()`. |
| `Passenger.js` | **Passenger entity class**. Properties: id, weight, origin, destination, currentFloor, state, elevator, timestamps. Methods: `enterElevator()`, `exitElevator()`, `shouldExitAt()`, `toJSON()`. |
| `utils.js` | Utility functions: `randomInt()`, `throttle()`. Used throughout the codebase. |

#### Backends Subdirectory (`src/core/backends/`)

| File | Purpose |
|------|---------|
| `WASMSimulationBackend.example.js` | Example skeleton for a future WebAssembly backend implementation. Shows how to extend SimulationBackend for alternative implementations. |

---

### Game Logic (`src/game/`)

Game flow, challenges, and world management.

| File | Purpose |
|------|---------|
| `GameController.js` | **Game orchestrator**. Composes JSSimulationBackend and ViewModelManager. Manages game loop via `requestAnimationFrame`. Handles: challenge initialization, start/pause/resume, time scaling, user code execution coordination. Uses AbortController for event cleanup. |
| `challenges.js` | **Challenge definitions**. Contains 16 progressive challenges with configurations (floors, elevators, spawn rates) and end conditions. Condition functions: `requirePassengerCountWithinTime()`, `requirePassengerCountWithMaxWaitTime()`, `requirePassengerCountWithinMoves()`, `requireDemo()`. |

---

### Multi-Language Runtimes (`src/runtimes/`)

Support for JavaScript, Python, and Java execution.

| File | Purpose |
|------|---------|
| `manager.js` | **RuntimeManager** class. Manages three runtime instances. Handles language switching, runtime loading, code compilation, and execution coordination. Provides `defaultTemplates` for each language. |
| `base.js` | **BaseRuntime** abstract class. Interface for all runtimes: `loadRuntime()`, `loadCode()`, `execute()`, `getDefaultTemplate()`, `cleanup()`. Properties: `isLoaded`, `isLoading`. |
| `javascript.js` | **JavaScript runtime**. Always ready (native support). Loads user code via ES modules with `data:text/javascript` URLs. Validates exported `tick` function. |
| `python.js` | **Python runtime**. Loads Pyodide from CDN. Injects wrapper classes (ElevatorAPI, FloorAPI) to bridge Python to JavaScript objects. Handles async execution with timeouts. |
| `java.js` | **Java runtime**. Loads CheerpJ from CDN. Precompiles base Elevator/Floor classes. Uses JNI callbacks (`Java_Elevator_jsGoToFloor`) to bridge Java to JavaScript. Manages class versioning to avoid conflicts. |

---

### User Interface (`src/ui/`)

Presentation layer and user interaction handling.

| File | Purpose |
|------|---------|
| `ViewModelManager.js` | **View model orchestrator**. Manages Maps of FloorViewModel, ElevatorViewModel, PassengerViewModel. Subscribes to backend events and updates view models. Can be disabled for headless operation. Uses AbortController for cleanup. |
| `CodeEditor.js` | **CodeMirror integration**. Multi-language editor with syntax highlighting (JavaScript, Python, Java). Features: ESLint linting (JS only), Gruvbox themes, auto-save to localStorage, keyboard shortcuts (Tab indent, Ctrl+S start). Uses Compartments for dynamic reconfiguration. |
| `AppDOM.js` | **DOM element cache**. Central reference to DOM elements. Methods for showing/hiding runtime loading indicator, clearing feedback. |
| `AppEventHandlers.js` | **Event coordination**. Attaches UI event listeners for buttons, language selector, theme changes. Delegates to ElevatorApp methods. |
| `presenters.js` | **Component factories**. Functions to create and bind Web Components: `presentStats()`, `presentChallenge()`, `presentFeedback()`, `presentCodeStatus()`, `presentWorld()`, `presentFloor()`, `presentElevator()`, `presentPassenger()`. |
| `PerformanceMonitor.js` | **Performance tracking**. Monitors frame rates and rendering performance. |
| `ResponsiveScaling.js` | **Layout management**. Handles responsive scaling and layout adjustments for different screen sizes. |
| `theme-manager.js` | **Theme handling**. Watches system theme preference (prefers-color-scheme). Provides `onThemeChange()` callback for subscribers. |

#### View Models (`src/ui/viewmodels/`)

Classes representing visual game elements as view models.

| File | Purpose |
|------|---------|
| `ViewModel.js` | **Base view model class**. Extends EventTarget. Methods: `tick()`, `syncUIComponent()`. |
| `AnimatedViewModel.js` | **Animation support**. Extends ViewModel. Handles smooth interpolated movement. Properties: `x`, `y`, `parent`. Methods: `moveToOverTime()`, `getWorldX/Y()`. Uses custom interpolation functions. |
| `ElevatorViewModel.js` | **Elevator view model**. Extends AnimatedViewModel. Converts simulation position to screen Y. Calculates passenger slot positions. Emits: `new_current_floor`, `floor_buttons_changed`, `new_display_state`. |
| `FloorViewModel.js` | **Floor view model**. Extends ViewModel. Tracks button state. Emits: `buttonstate_change`. |
| `PassengerViewModel.js` | **Passenger view model**. Extends AnimatedViewModel. State machine: new → waiting → riding → exited. Random types (child, female, male). Methods: `animateBoarding()`, `animateExit()`. |
| `NullViewModel.js` | **No-op view model**. Used for headless operation when rendering is disabled. |

#### Web Components (`src/ui/components/`)

Custom HTML elements with Shadow DOM.

| File | Purpose |
|------|---------|
| `elevator-car.js` | **Elevator component**. Observes position, floor, direction. Renders elevator box with floor indicator and direction arrows. Listens to display events. |
| `elevator-floor.js` | **Floor component**. Observes floor number, position, button states. Renders floor label with up/down buttons. Click handlers for button interaction. |
| `elevator-passenger.js` | **Passenger component**. Observes position, type, state. Renders passenger figure in child/female/male variants. |
| `elevator-stats.js` | **Statistics component**. Displays game metrics: transported count, moves, elapsed time, wait times. |
| `challenge-control.js` | **Challenge UI component**. Challenge selector dropdown, start/stop button, challenge description display. |
| `code-status.js` | **Error display component**. Shows compilation and runtime errors from user code. |
| `game-feedback.js` | **Result overlay component**. Displays challenge success/failure message with next/retry options. |
| `theme-switcher.js` | **Theme toggle component**. Button to switch between light and dark themes. |

---

### Utilities (`src/utils/`)

Helper functions and utilities.

| File | Purpose |
|------|---------|
| `AsyncUtils.js` | Promise utilities: `sleep()`, `waitFor()`, `timeout()`. Used for async operations and runtime loading. |
| `URLManager.js` | **URL state management**. Parses URL parameters for challenge index and code. Updates URL on challenge changes. Enables sharing game state via URL. |

---

## Tests (`tests/`)

Test files mirroring source structure.

| File | Purpose |
|------|---------|
| `setup.js` | Test setup and configuration for Vitest with JSDOM. |
| `architecture.test.js` | Tests for main architectural components integration. |
| `core/Elevator.test.js` | Elevator physics and behavior tests. |
| `core/Floor.test.js` | Floor button state tests. |
| `core/Passenger.test.js` | Passenger lifecycle tests. |
| `core/utils.test.js` | Utility function tests. |
| `core/World.test.js` | Simulation integration tests. |
| `ui/viewmodels/AnimatedViewModel.test.js` | Animation utility tests. |

---

## Public Assets (`public/`)

Static files served directly.

| File | Purpose |
|------|---------|
| `tools.jar` | Java tools for CheerpJ compilation (if needed locally). |

---

## Key File Relationships

```
index.html
    └── loads src/app.js
              │
              ├── imports src/game/GameController.js
              │     ├── imports src/core/JSSimulationBackend.js
              │     │     ├── imports src/core/Elevator.js
              │     │     ├── imports src/core/Floor.js
              │     │     └── imports src/core/Passenger.js
              │     │
              │     └── imports src/ui/ViewModelManager.js
              │           ├── imports src/ui/viewmodels/ElevatorViewModel.js
              │           ├── imports src/ui/viewmodels/FloorViewModel.js
              │           └── imports src/ui/viewmodels/PassengerViewModel.js
              │
              ├── imports src/runtimes/manager.js
              │     ├── imports src/runtimes/javascript.js
              │     ├── imports src/runtimes/python.js
              │     └── imports src/runtimes/java.js
              │
              ├── imports src/ui/CodeEditor.js
              │
              ├── imports src/ui/AppDOM.js
              │
              └── imports src/game/challenges.js
```

---

## File Counts by Directory

| Directory | File Count | Description |
|-----------|------------|-------------|
| `src/` | 2 | Entry point and styles |
| `src/config/` | 1 | Constants |
| `src/core/` | 6 | Simulation engine |
| `src/core/backends/` | 1 | Example backend |
| `src/game/` | 2 | Game logic |
| `src/runtimes/` | 4 | Language runtimes |
| `src/ui/` | 7 | UI management |
| `src/ui/components/` | 8 | Web components |
| `src/ui/viewmodels/` | 6 | View model objects |
| `src/utils/` | 2 | Utilities |
| `tests/` | 7 | Test files |
| **Total** | **45** | Source + tests |

---

## Related Documentation

- [Architecture Overview](./architecture-overview.md) - High-level system overview
- [Component Diagrams](./architecture-components.md) - Component relationships
- [Sequence Diagrams](./architecture-sequences.md) - Execution flow details
