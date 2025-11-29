# Elevator Saga Component Architecture

This document details the component relationships, class hierarchies, and data structures used in Elevator Saga.

---

## 1. Core Simulation Components

### Backend Hierarchy

```
EventTarget (Browser API)
     │
     └── SimulationBackend (Abstract)
              │
              │  Interface Methods:
              │  ├── initialize(config)
              │  ├── tick(dt)
              │  ├── getState()
              │  ├── callUserCode(codeObj, dt)
              │  ├── getStats()
              │  ├── hasEnded()
              │  └── cleanup()
              │
              └── JSSimulationBackend (Implementation)
                       │
                       │  State:
                       ├── floors: Floor[]
                       ├── elevators: Elevator[]
                       ├── passengers: Passenger[]
                       │
                       │  Statistics:
                       ├── transportedCount: number
                       ├── transportedPerSec: number
                       ├── moveCount: number
                       ├── elapsedTime: number
                       ├── maxWaitTime: number
                       └── avgWaitTime: number
```

### Entity Classes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Elevator                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Properties:                         │  Methods:                            │
│  ├── index: number                   │  ├── tick(dt): boolean              │
│  ├── position: number (0.0-N)        │  │     Returns true when doors open │
│  ├── destination: number | null      │  │                                  │
│  ├── velocity: number                │  ├── goToFloor(floor): void         │
│  ├── buttons: boolean[]              │  │     Sets destination, +moves     │
│  ├── passengers: Passenger[]         │  │                                  │
│  ├── capacity: number                │  ├── addPassenger(p): void          │
│  ├── goingUpIndicator: boolean       │  ├── removePassenger(p): void       │
│  ├── goingDownIndicator: boolean     │  │                                  │
│  ├── pause: number (door timer)      │  ├── toAPI(): object (for user code)│
│  └── moves: number                   │  └── toJSON(): object (for display) │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                Floor                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Properties:                         │  Methods:                            │
│  ├── level: number                   │  ├── pressButton(direction): void   │
│  └── buttons: {up: bool, down: bool} │  ├── clearButton(direction): void   │
│                                      │  └── toJSON(): object                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              Passenger                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Properties:                         │  Methods:                            │
│  ├── id: number                      │  ├── enterElevator(e, slot): void   │
│  ├── weight: number (55-100)         │  ├── exitElevator(): void           │
│  ├── startingFloor: number           │  ├── shouldExitAt(floor): boolean   │
│  ├── destinationFloor: number        │  └── toJSON(): object               │
│  ├── currentFloor: number            │                                      │
│  ├── state: "waiting"|"riding"|"exited"                                     │
│  ├── elevator: Elevator | null       │                                      │
│  ├── spawnTimestamp: number          │                                      │
│  └── transportedTimestamp: number    │                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Entity Relationships

```
                    JSSimulationBackend
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
      Floor[0..N]    Elevator[0..M]   Passenger[0..*]
           │               │               │
           │               │               │
           │    ┌──────────┴──────────┐    │
           │    │                     │    │
           │    ▼                     ▼    │
           │  buttons[]          passengers[]
           │  (floor requests)   (riding)  │
           │                               │
           └───────────────────────────────┘
                    (waiting passengers
                     reference floor)
```

---

## 2. Event System

### Event Types and Payloads

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Event: state_changed                                                        │
│  Frequency: Every tick (~60 Hz)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Payload:                                                                    │
│  {                                                                           │
│    floors: Floor[],           // All floor states                           │
│    elevators: Elevator[],     // All elevator states                        │
│    passengers: Passenger[],   // All passenger states                       │
│    stats: Statistics,         // Current game statistics                    │
│    isChallengeEnded: boolean, // Whether challenge has ended                │
│    dt: number                 // Delta time for this tick                   │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Event: stats_changed                                                        │
│  Frequency: Throttled to 30 FPS max                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Payload:                                                                    │
│  {                                                                           │
│    transportedCount: number,  // Total passengers delivered                 │
│    transportedPerSec: number, // Throughput                                 │
│    moveCount: number,         // Total elevator moves                       │
│    elapsedTime: number,       // Seconds since start                        │
│    maxWaitTime: number,       // Longest passenger wait                     │
│    avgWaitTime: number        // Average wait time                          │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Event: passenger_spawned                                                    │
│  Frequency: Based on spawnRate                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Payload: { passenger: Passenger }                                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Event: passengers_exited                                                    │
│  Frequency: When elevator arrives and passengers exit                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Payload: { passengers: Passenger[], elevator: Elevator }                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Event: passengers_boarded                                                   │
│  Frequency: When elevator arrives and passengers board                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Payload: { passengers: Passenger[], elevator: Elevator }                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Event: challenge_ended                                                      │
│  Frequency: Once per challenge (success or failure)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Payload: { succeeded: boolean }                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Event Flow Diagram

```
JSSimulationBackend                                   Subscribers
       │                                                   │
       │                                    ┌──────────────┼──────────────┐
       │                                    │              │              │
       │                                    ▼              ▼              ▼
       │                             DisplayManager   GameController    ElevatorApp
       │                                    │              │              │
       ├── state_changed ──────────────────►│              │              │
       │    (every tick)                    │              │              │
       │                          updateDisplays()         │              │
       │                                    │              │              │
       ├── stats_changed ──────────────────►├──────────────┤              │
       │    (throttled)                     │        forward to           │
       │                                    │        UI presenter         │
       │                                    │              │              │
       ├── passenger_spawned ──────────────►│              │              │
       │                          createPassengerDisplay() │              │
       │                                    │              │              │
       ├── passengers_exited ──────────────►│              │              │
       │                          animateExit()            │              │
       │                                    │              │              │
       └── challenge_ended ────────────────►├──────────────┤──────────────┤
                                            │         stop loop    show feedback
                                     show feedback         │              │
```

---

## 3. Runtime System

### Runtime Class Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RuntimeManager                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Properties:                                                                 │
│  ├── runtimes: Map<string, BaseRuntime>                                     │
│  ├── currentLanguage: "javascript" | "python" | "java"                      │
│  └── loadingPromises: Map<string, Promise>                                  │
│                                                                             │
│  Methods:                                                                    │
│  ├── loadCurrentRuntime(): Promise<void>                                    │
│  ├── selectLanguage(lang): Promise<void>                                    │
│  ├── loadCode(code): Promise<void>                                          │
│  └── execute(elevators, floors): Promise<void>                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ JavaScript  │ │   Python    │ │    Java     │
            │  Runtime    │ │   Runtime   │ │   Runtime   │
            └─────────────┘ └─────────────┘ └─────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           BaseRuntime (Abstract)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Properties:                         │  Abstract Methods:                   │
│  ├── isLoaded: boolean               │  ├── loadRuntime(): Promise<void>   │
│  └── isLoading: boolean              │  ├── loadCode(code): Promise<void>  │
│                                      │  ├── execute(e,f): Promise<void>    │
│                                      │  ├── getDefaultTemplate(): string   │
│                                      │  └── cleanup(): void                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Runtime Implementation Details

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        JavaScriptRuntime                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Loading: Always ready (isLoaded = true)                                     │
│                                                                             │
│  Code Loading:                                                              │
│    const module = await import(`data:text/javascript,${encoded}`)          │
│    this.tickFn = module.tick                                                │
│                                                                             │
│  Execution:                                                                 │
│    this.tickFn(wrappedElevators, wrappedFloors)                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          PythonRuntime                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Loading:                                                                    │
│    1. Load Pyodide from CDN (30s timeout)                                   │
│    2. Initialize Python environment (60s timeout)                           │
│    3. Inject wrapper classes (ElevatorAPI, FloorAPI)                        │
│                                                                             │
│  Wrapper Pattern:                                                           │
│    class ElevatorAPI:                                                       │
│        def __init__(self, js_elevator):                                     │
│            self._js = js_elevator                                           │
│        @property                                                            │
│        def current_floor(self):                                             │
│            return self._js.currentFloor                                     │
│        def go_to_floor(self, n):                                            │
│            self._js.goToFloor(n)                                            │
│                                                                             │
│  Execution:                                                                 │
│    pyodide.globals.set("_js_elevators", elevators)                         │
│    pyodide.runPython("_execute_tick(_js_elevators, _js_floors)")           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           JavaRuntime                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Loading:                                                                    │
│    1. Load CheerpJ from CDN                                                 │
│    2. Initialize Java VM                                                    │
│    3. Precompile base Elevator/Floor classes                                │
│                                                                             │
│  JNI Bridge Pattern:                                                        │
│    Java side:                                                               │
│      public static native void jsGoToFloor(int elevator, int floor);        │
│                                                                             │
│    JavaScript side:                                                         │
│      async function Java_Elevator_jsGoToFloor(lib, elevatorId, floor) {     │
│        const jsElevator = ELEVATORS[elevatorId];                            │
│        jsElevator.goToFloor(floor);                                         │
│      }                                                                       │
│                                                                             │
│  Execution:                                                                 │
│    1. Create Java Elevator[] and Floor[] arrays                             │
│    2. Copy current state into Java objects                                  │
│    3. Call controller.tick(javaElevators, javaFloors)                       │
│    4. JNI callbacks update JavaScript state                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Unified Player API

All runtimes expose identical API to user code:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Player Code API                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  // Elevator Object                                                         │
│  elevator.currentFloor         // number: Current floor (0 to N-1)          │
│  elevator.destinationFloor     // number | null: Target floor               │
│  elevator.pressedFloorButtons  // number[]: Floors requested by passengers  │
│  elevator.percentFull          // number: 0.0 to 1.0 capacity used          │
│  elevator.goToFloor(n)         // void: Command elevator to floor n         │
│                                                                             │
│  // Floor Object                                                            │
│  floor.level                   // number: Floor number (0 to N-1)           │
│  floor.buttons.up              // boolean: Up button pressed                │
│  floor.buttons.down            // boolean: Down button pressed              │
│                                                                             │
│  // Entry Point                                                             │
│  function tick(elevators, floors) {                                         │
│    // Called every game frame (~60 Hz)                                      │
│    // Analyze state, make decisions, call goToFloor()                       │
│  }                                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. UI Layer

### Display Object Hierarchy

```
EventTarget (Browser API)
       │
       └── Display (Base)
              │
              │  Properties:
              │  ├── element: HTMLElement
              │  └── disposed: boolean
              │
              │  Methods:
              │  ├── tick(dt): void
              │  ├── syncUIComponent(): void
              │  └── dispose(): void
              │
              ├── FloorDisplay
              │      │
              │      │  Properties:
              │      │  ├── level: number
              │      │  └── buttons: {up, down}
              │      │
              │      │  Events Emitted:
              │      │  └── buttonstate_change
              │      │
              │
              └── Animated (extends Display)
                     │
                     │  Properties:
                     │  ├── x, y: number (current position)
                     │  ├── parent: Animated | null
                     │  └── interpolations: Animation[]
                     │
                     │  Methods:
                     │  ├── moveToOverTime(x, y, time, interp, cb)
                     │  ├── getWorldX/Y(): number
                     │  └── tick(dt): void (updates interpolations)
                     │
                     ├── ElevatorDisplay
                     │      │
                     │      │  Properties:
                     │      │  ├── index: number
                     │      │  └── currentFloor: number
                     │      │
                     │      │  Methods:
                     │      │  ├── getDisplayYPos(position): number
                     │      │  └── getPassengerPosition(slot): {x, y}
                     │      │
                     │      │  Events Emitted:
                     │      │  ├── new_current_floor
                     │      │  ├── floor_buttons_changed
                     │      │  └── new_display_state
                     │      │
                     │
                     └── PassengerDisplay
                            │
                            │  Properties:
                            │  ├── id: number
                            │  ├── state: "new"|"waiting"|"riding"|"exited"
                            │  └── type: "child"|"female"|"male"
                            │
                            │  Methods:
                            │  ├── animateBoarding(elevator, slot)
                            │  └── animateExit()
```

### Web Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Web Components                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  <elevator-car>              Game Element Components                        │
│  ├── Observes: position, current-floor, direction                           │
│  ├── Listens: new_display_state, new_current_floor, floor_buttons_changed   │
│  └── Renders: Elevator box, floor indicator, direction arrows               │
│                                                                             │
│  <elevator-floor>                                                           │
│  ├── Observes: floor-number, y-position, up-active, down-active             │
│  ├── Listens: buttonstate_change                                            │
│  └── Renders: Floor label, up/down buttons with active states               │
│                                                                             │
│  <elevator-passenger>                                                        │
│  ├── Observes: x, y, type, state                                            │
│  └── Renders: Passenger figure (child/female/male variants)                 │
│                                                                             │
│  <elevator-stats>            UI Components                                  │
│  ├── Observes: transported, moves, elapsed, max-wait, avg-wait              │
│  └── Renders: Statistics table                                              │
│                                                                             │
│  <challenge-control>                                                         │
│  ├── Observes: challenge-index, is-running                                  │
│  └── Renders: Challenge selector, start/stop button, description            │
│                                                                             │
│  <code-status>                                                              │
│  ├── Observes: error-message                                                │
│  └── Renders: Error display panel                                           │
│                                                                             │
│  <game-feedback>                                                            │
│  ├── Observes: title, message, success                                      │
│  └── Renders: Challenge result overlay                                      │
│                                                                             │
│  <theme-switcher>                                                           │
│  ├── Listens: system theme changes                                          │
│  └── Renders: Theme toggle button                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### DisplayManager Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DisplayManager                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  State Maps:                                                                │
│  ├── floorDisplays: Map<number, FloorDisplay>                               │
│  ├── elevatorDisplays: Map<number, ElevatorDisplay>                         │
│  └── passengerDisplays: Map<number, PassengerDisplay>                       │
│                                                                             │
│  Configuration:                                                             │
│  ├── container: HTMLElement                                                 │
│  ├── isRenderingEnabled: boolean                                            │
│  └── abortController: AbortController                                       │
│                                                                             │
│  Lifecycle Methods:                                                         │
│  ├── initialize(initialState)    // Create displays from state             │
│  ├── subscribeToBackend(backend) // Attach event listeners                 │
│  ├── tick(dt)                    // Advance animations                     │
│  └── cleanup()                   // Remove displays, abort events          │
│                                                                             │
│  Update Methods:                                                            │
│  ├── updateDisplays(state, dt)   // Main update from state_changed         │
│  ├── updateFloor(floorData)      // Sync floor display                     │
│  ├── updateElevator(elevData)    // Sync elevator display                  │
│  └── updatePassenger(paxData)    // Sync passenger display                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Game Logic Components

### GameController Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            GameController                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Composed Systems:                                                          │
│  ├── backend: JSSimulationBackend                                           │
│  └── displayManager: DisplayManager                                         │
│                                                                             │
│  Game State:                                                                │
│  ├── isPaused: boolean                                                      │
│  ├── timeScale: number (speed multiplier)                                   │
│  ├── dtMax: number (max frame time)                                         │
│  ├── challenge: Challenge                                                   │
│  ├── codeObj: { tick: Function }                                            │
│  └── lastFrameTime: number                                                  │
│                                                                             │
│  Cleanup:                                                                   │
│  └── abortController: AbortController                                       │
│                                                                             │
│  Lifecycle:                                                                 │
│  ├── initializeChallenge(challenge)                                         │
│  ├── start(codeObj)                                                         │
│  ├── setPaused(paused)                                                      │
│  ├── setTimeScale(scale)                                                    │
│  ├── end()                                                                  │
│  └── cleanup()                                                              │
│                                                                             │
│  Game Loop:                                                                 │
│  └── runFrame(timestamp) ─┬─► Calculate dt                                  │
│                           ├─► callUserCode(codeObj, dt)                     │
│                           ├─► backend.tick(dt)                              │
│                           └─► requestAnimationFrame(runFrame)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Challenge Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Challenge Definition                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Configuration:                                                             │
│  ├── title: string                                                          │
│  ├── description: string                                                    │
│  ├── floorCount: number                                                     │
│  ├── elevatorCount: number                                                  │
│  ├── elevatorCapacities: number[]                                           │
│  ├── spawnRate: number (passengers/second)                                  │
│  └── speedFloorsPerSec: number                                              │
│                                                                             │
│  End Condition:                                                             │
│  └── condition: ConditionFunction                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        Condition Functions                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  requirePassengerCountWithinTime(count, timeLimit)                          │
│  └── Transport N passengers in T seconds                                    │
│                                                                             │
│  requirePassengerCountWithMaxWaitTime(count, maxWait)                        │
│  └── Transport N passengers, max wait time M seconds                        │
│                                                                             │
│  requirePassengerCountWithinTimeWithMaxWaitTime(count, time, maxWait)        │
│  └── Combined time and wait constraints                                     │
│                                                                             │
│  requirePassengerCountWithinMoves(count, moveLimit)                          │
│  └── Transport N passengers using max M elevator moves                      │
│                                                                             │
│  requireDemo()                                                              │
│  └── Never ends (perpetual demo mode)                                       │
│                                                                             │
│  Return Values:                                                             │
│  ├── null  → Challenge still running                                        │
│  ├── true  → Challenge succeeded                                            │
│  └── false → Challenge failed                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [Architecture Overview](./architecture-overview.md) - High-level system overview
- [Sequence Diagrams](./architecture-sequences.md) - Execution flow details
- [File Reference](./architecture-files.md) - Directory structure guide
