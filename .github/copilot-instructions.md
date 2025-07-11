# Elevator Saga AI Coding Instructions

## Project Architecture

Elevator Saga is a multi-language elevator programming game built with Vite. Players write code to control elevators efficiently across JavaScript, Python, and Java runtimes.

### Core System Design

**Multi-Runtime Architecture** (`src/runtimes/`):
- `BaseRuntime` - Abstract base class for language runtimes
- `RuntimeManager` - Handles language switching and code execution coordination
- Each runtime (`javascript.js`, `python.js`, `java.js`) implements: `loadRuntime()`, `loadCode()`, `execute()`, `getDefaultTemplate()`
- JavaScript uses ES modules with `data:text/javascript` imports
- Python uses Pyodide with wrapper classes that bridge JS objects
- Java uses CheerpJ with JNI callbacks (`Java_Elevator_jsGoToFloor`)

**Game Engine** (`src/core/`):
- `World.js` - Contains `WorldCreator` (builds floors/elevators) and `WorldController` (game loop, physics, user spawning)
- `Elevator.js` - State machine with movement queue, capacity tracking, button management
- `Floor.js` - User queues and button states
- `User.js` - Individual entities with spawn timestamps and destinations
- All entities extend `Movable.js` for position/animation handling

**Player Code Interface**:
All runtimes expose the same API contract:
```javascript
// Elevator properties: currentFloor, destinationFloor, pressedFloorButtons[], percentFull
// Elevator methods: goToFloor(floorNum)
// Floor properties: buttons.{up,down}, level
// Entry point: update(elevators, floors) or Update(elevators, floors)
```

### Development Workflows

**Commands**:
- `npm run dev` - Vite dev server with hot reload
- `npm run test:run` - Run Vitest suite once
- `npm run build` - Production build to `dist/`

**Testing Patterns**:
- Tests mirror `src/` structure in `tests/`
- Use Vitest with JSDOM for DOM-dependent components
- Focus on core game mechanics, not UI presentation
- Example: `tests/core/Elevator.test.js` tests state transitions and movement logic

### Critical Patterns

**Runtime Integration**:
- When adding language support, extend `BaseRuntime` and register in `RuntimeManager`
- Each runtime must handle async loading (CheerpJ, Pyodide) and provide error isolation
- Code compilation happens per-language: JS uses dynamic imports, Python/Java compile to bytecode

**Game State Management**:
- `WorldController.update()` is the main game loop - calls player code, updates physics, spawns users
- Player code errors are caught and dispatched as `usercode_error` events
- Stats recalculation is throttled and event-driven (`stats_changed`)

**Code Editor Integration**:
- CodeMirror 6 with language-specific compartments
- Auto-save with throttling (1000ms) to localStorage
- Each language maintains separate storage keys: `${storageKey}_${language}`

**Challenge System** (`src/game/challenges.js`):
- Challenges return `{ description, evaluate(world) }` objects
- `evaluate()` returns: `true` (success), `false` (failure), `null` (still running)
- Success criteria: user count, time limits, wait times, move efficiency

### Key Integration Points

**Multi-Language Bridging**:
- Python: Wrapper classes (`ElevatorAPI`, `FloorAPI`) bridge JS objects to Pythonic interfaces
- Java: JNI native methods call back to JavaScript (`Java_Elevator_jsGoToFloor`)
- All runtimes maintain global `ELEVATORS` array for callback resolution

**Event System**:
- `WorldController` extends `EventTarget` for game events
- UI listens for: `stats_changed`, `usercode_error`, `new_user`, `challenge_ended`
- Error handling isolates player code failures from game engine

**Build System**:
- Vite handles ES modules and dynamic imports
- `vite.config.js` includes selective bundling for vendor vs source separation
- External resources: CheerpJ, Pyodide loaded from CDN at runtime

### Development Guidelines

When modifying runtimes:
- Maintain API parity across all languages
- Handle async loading states properly
- Provide meaningful error messages for compilation failures
- Test cross-language feature compatibility

When extending the game engine:
- New features should work across all three runtimes
- Maintain backward compatibility with existing player code
- Update default templates for all languages consistently

When adding UI features:
- Use the existing presenter pattern (`src/ui/presenters.js`)
- Listen for game events rather than polling state
- Ensure accessibility and responsive design
