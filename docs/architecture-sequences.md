# Elevator Saga Sequence Diagrams

This document details the execution flows, state transitions, and event propagation in Elevator Saga.

---

## 1. Application Initialization Sequence

```
Browser loads index.html
         │
         ▼
    Load src/app.js
         │
         ▼
┌────────────────────────────────┐
│     new ElevatorApp()          │
│                                │
│  1. Create RuntimeManager      │
│     └── Initialize runtimes    │
│         ├── JavaScriptRuntime  │
│         ├── PythonRuntime      │
│         └── JavaRuntime        │
│                                │
│  2. Create CodeEditor          │
│     └── Initialize CodeMirror  │
│         ├── Load saved code    │
│         ├── Set language       │
│         └── Configure themes   │
│                                │
│  3. Create GameController        │
│     ├── Create Backend         │
│     └── Create ViewModelManager  │
│                                │
│  4. Create AppDOM              │
│     └── Cache DOM elements     │
│                                │
│  5. Create AppEventHandlers    │
│     └── Attach UI listeners    │
│                                │
│  6. Parse URL parameters       │
│     └── Load challenge/code    │
└────────────────────────────────┘
         │
         ▼
   Load initial challenge
         │
         ▼
   Display ready state
```

---

## 2. Challenge Load Sequence

```
User selects challenge OR URL parameter
         │
         ▼
ElevatorApp.loadChallenge(index)
         │
         ├──► Update URL with challenge index
         │
         ├──► Get challenge definition from challenges[index]
         │
         └──► GameController.initializeChallenge(challenge)
                    │
                    ├──► backend.initialize(config)
                    │         │
                    │         ├── Create floors[0..N-1]
                    │         ├── Create elevators[0..M-1]
                    │         ├── Reset passengers[]
                    │         ├── Reset statistics
                    │         └── Set endCondition
                    │
                    ├──► viewModelManager.initialize(backend.getState())
                    │         │
                    │         ├── Clear existing view models
                    │         ├── Create FloorViewModel for each floor
                    │         └── Create ElevatorViewModel for each elevator
                    │
                    └──► viewModelManager.subscribeToEvents()
                              │
                              └── Attach event listeners to eventBus:
                                  ├── simulation:state_changed
                                  ├── simulation:passenger_spawned
                                  └── simulation:passengers_exited
         │
         ▼
   presentChallenge(element, challenge)
         │
         └── Update UI with challenge description
```

---

## 3. Code Execution Startup Sequence

```
User clicks "Start" button
         │
         ▼
ElevatorApp.startChallenge()
         │
         ├──► Show runtime loading indicator
         │
         ├──► RuntimeManager.loadCurrentRuntime()
         │         │
         │         ├── [JavaScript] Always ready
         │         │
         │         ├── [Python] Load Pyodide from CDN
         │         │            └── Initialize environment
         │         │
         │         └── [Java] Load CheerpJ from CDN
         │                    └── Initialize JVM
         │
         ├──► RuntimeManager.loadCode(userCode)
         │         │
         │         ├── [JavaScript] import(`data:text/javascript,...`)
         │         │                └── Extract tick function
         │         │
         │         ├── [Python] pyodide.runPython(code)
         │         │            └── Define tick in globals
         │         │
         │         └── [Java] Compile with CheerpJ
         │                    └── Instantiate controller class
         │
         ├──► Hide runtime loading indicator
         │
         ├──► Create codeObj wrapper
         │         │
         │         └── { tick: async (e, f) => runtime.execute(e, f) }
         │
         └──► GameController.start(codeObj)
                    │
                    ├── Store codeObj reference
                    ├── Set isPaused = false
                    ├── Record lastFrameTime
                    └── requestAnimationFrame(runFrame)
                              │
                              └── [Game loop begins]
```

---

## 4. Game Loop Sequence (Per Frame)

```
requestAnimationFrame callback
         │
         ▼
runFrame(timestamp)
         │
         ├── Calculate dt = (timestamp - lastFrameTime) / 1000
         │
         ├── Apply timeScale: dt *= timeScale
         │
         └── if (!isPaused):
                    │
                    ├──► backend.callUserCode(codeObj, dt)
                    │         │
                    │         ├── Get current state snapshot
                    │         │
                    │         ├── Wrap elevators with API:
                    │         │     elevator.toAPI() returns:
                    │         │     ├── currentFloor
                    │         │     ├── destinationFloor
                    │         │     ├── pressedFloorButtons
                    │         │     ├── percentFull
                    │         │     └── goToFloor(n) [bound method]
                    │         │
                    │         ├── Wrap floors with state:
                    │         │     floor.toJSON() returns:
                    │         │     ├── level
                    │         │     └── buttons {up, down}
                    │         │
                    │         └── Execute: codeObj.safeTick(elevators, floors)
                    │                   │
                    │                   └── User code runs:
                    │                       ├── Analyze state
                    │                       ├── Make decisions
                    │                       └── elevator.goToFloor(n)
                    │                               │
                    │                               └── Sets elevator.destination
                    │                                   Increments elevator.moves
                    │
                    └── while (dt > 0):
                              │
                              ├── thisDt = min(dt, dtMax)
                              │
                              ├──► backend.tick(thisDt)
                              │         │
                              │         │  [See Backend Tick Sequence below]
                              │
                              └── dt -= thisDt
         │
         ├── lastFrameTime = timestamp
         │
         └── requestAnimationFrame(runFrame)
```

---

## 5. Backend Tick Sequence

```
backend.tick(dt)
         │
         ├──► elapsedTime += dt
         │
         ├──► Spawn passengers (based on spawnRate)
         │         │
         │         └── if (elapsedTime >= nextSpawnTime):
         │                   │
         │                   ├── spawnPassenger()
         │                   │     │
         │                   │     ├── Create Passenger:
         │                   │     │     ├── Random weight (55-100)
         │                   │     │     ├── Random origin floor
         │                   │     │     │   (weighted to floor 0)
         │                   │     │     └── Random destination
         │                   │     │
         │                   │     ├── passengers.push(passenger)
         │                   │     │
         │                   │     ├── Floor button press:
         │                   │     │     └── floor.pressButton(direction)
         │                   │     │
         │                   │     └── eventBus.emit simulation:passenger_spawned
         │                   │              │
         │                   │              └── { passenger }
         │                   │
         │                   └── Calculate nextSpawnTime
         │
         ├──► Update each elevator
         │         │
         │         └── for (elevator of elevators):
         │                   │
         │                   ├── doorsOpening = elevator.tick(dt)
         │                   │         │
         │                   │         ├── Calculate velocity
         │                   │         │     ├── Accelerate if moving
         │                   │         │     ├── Decelerate near target
         │                   │         │     └── Clamp to MAXSPEED
         │                   │         │
         │                   │         ├── Update position += velocity * dt
         │                   │         │
         │                   │         ├── Check arrival:
         │                   │         │     if (at destination):
         │                   │         │         ├── Snap to floor
         │                   │         │         ├── Set velocity = 0
         │                   │         │         ├── Start door pause
         │                   │         │         └── return true
         │                   │         │
         │                   │         └── return false
         │                   │
         │                   └── if (doorsOpening):
         │                             │
         │                             └── handleElevatorArrival(elevator)
         │                                       │
         │                                       │  [See Elevator Arrival below]
         │
         ├──► Remove exited passengers
         │         │
         │         └── passengers = passengers.filter(p => p.state !== "exited")
         │
         ├──► eventBus.emit simulation:state_changed
         │         │
         │         └── {
         │               floors: floors.map(f => f.toJSON()),
         │               elevators: elevators.map(e => e.toJSON()),
         │               passengers: passengers.map(p => p.toJSON()),
         │               stats: getStats(),
         │               isChallengeEnded,
         │               dt
         │             }
         │
         └──► Check end condition
                    │
                    ├── result = endCondition.evaluate(stats)
                    │
                    ├── if (result === null):
                    │     └── eventBus.emit simulation:stats_changed (throttled)
                    │
                    └── if (result === true || result === false):
                          │
                          ├── isChallengeEnded = true
                          ├── eventBus.emit simulation:stats_changed (final)
                          └── eventBus.emit simulation:challenge_ended
                                   │
                                   └── { succeeded: result }
```

---

## 6. Elevator Arrival Sequence

```
handleElevatorArrival(elevator)
         │
         ├──► Handle passengers exiting
         │         │
         │         ├── exitingPassengers = []
         │         │
         │         ├── for (passenger of elevator.passengers):
         │         │         │
         │         │         └── if (passenger.shouldExitAt(currentFloor)):
         │         │                   │
         │         │                   ├── elevator.removePassenger(passenger)
         │         │                   ├── passenger.exitElevator()
         │         │                   ├── passenger.state = "exited"
         │         │                   ├── passenger.transportedTimestamp = now
         │         │                   ├── Update statistics:
         │         │                   │     ├── transportedCount++
         │         │                   │     └── Update waitTimes
         │         │                   └── exitingPassengers.push(passenger)
         │         │
         │         └── if (exitingPassengers.length > 0):
         │                   │
         │                   └── eventBus.emit simulation:passengers_exited
         │                            │
         │                            └── { passengers: exitingPassengers,
         │                                  elevator }
         │
         ├──► Handle passengers boarding
         │         │
         │         ├── boardingPassengers = []
         │         │
         │         ├── waitingPassengers = passengers.filter(
         │         │     p => p.state === "waiting" &&
         │         │          p.currentFloor === currentFloor
         │         │   )
         │         │
         │         ├── for (passenger of waitingPassengers):
         │         │         │
         │         │         ├── Check elevator direction matches:
         │         │         │     goingUp && dest > current OR
         │         │         │     goingDown && dest < current
         │         │         │
         │         │         ├── Check elevator has capacity:
         │         │         │     passengers.length < capacity
         │         │         │
         │         │         └── if (canBoard):
         │         │                   │
         │         │                   ├── slot = findEmptySlot(elevator)
         │         │                   ├── passenger.enterElevator(elevator, slot)
         │         │                   ├── elevator.addPassenger(passenger)
         │         │                   ├── elevator.buttons[dest] = true
         │         │                   └── boardingPassengers.push(passenger)
         │         │
         │         └── if (boardingPassengers.length > 0):
         │                   │
         │                   └── eventBus.emit simulation:passengers_boarded
         │                            │
         │                            └── { passengers: boardingPassengers,
         │                                  elevator }
         │
         └──► Clear floor buttons if no more waiting
                    │
                    └── remainingUp/Down = passengers.filter(
                          p => p.state === "waiting" &&
                               p.currentFloor === currentFloor &&
                               p.direction === up/down
                        )
                        │
                        └── if (none remaining):
                              └── floor.clearButton(direction)
```

---

## 7. Passenger State Machine

```
                              ┌─────────────┐
                              │   SPAWN     │
                              └──────┬──────┘
                                     │
                                     │ spawnPassenger()
                                     │ floor.pressButton(direction)
                                     ▼
                              ┌─────────────┐
                     ┌───────►│   WAITING   │◄──────────┐
                     │        └──────┬──────┘           │
                     │               │                  │
                     │               │ Elevator arrives │
                     │               │ Direction matches│
                     │               │ Has capacity     │
                     │               ▼                  │
                     │        ┌─────────────┐           │
                     │        │  BOARDING   │           │
                     │        │ (animation) │           │
                     │        └──────┬──────┘           │
                     │               │                  │
                     │               │ enterElevator()  │
                     │               │ addPassenger()   │
                     │               ▼                  │
       Elevator at   │        ┌─────────────┐           │ Elevator at
       wrong floor   │        │   RIDING    │           │ wrong floor
                     │        └──────┬──────┘           │
                     │               │                  │
                     │               │ Elevator arrives │
                     │               │ at destination   │
                     │               ▼                  │
                     │        ┌─────────────┐           │
                     │        │  EXITING    │           │
                     │        │ (animation) │           │
                     │        └──────┬──────┘           │
                     │               │                  │
                     │               │ exitElevator()   │
                     │               │ removePassenger()│
                     │               ▼                  │
                     │        ┌─────────────┐           │
                     │        │   EXITED    │           │
                     │        └──────┬──────┘           │
                     │               │                  │
                     │               │ Remove from      │
                     │               │ passengers[]     │
                     │               ▼                  │
                     │        ┌─────────────┐           │
                     └────────│   REMOVED   │───────────┘
                              └─────────────┘
                                (filtered out)
```

---

## 8. View Model Update Sequence

```
eventBus receives simulation:state_changed
         │
         ▼
ViewModelManager event listener (subscribed via subscribeToEvents())
         │
         └──► updateViewModels(state, dt)
                    │
                    ├──► Update floors
                    │         │
                    │         └── for (floorData of state.floors):
                    │                   │
                    │                   ├── viewModel = floorViewModels.get(level)
                    │                   ├── viewModel.buttons = floorData.buttons
                    │                   └── viewModel.syncUIComponent()
                    │                             │
                    │                             └── <elevator-floor>
                    │                                 updates attributes
                    │
                    ├──► Update elevators
                    │         │
                    │         └── for (elevData of state.elevators):
                    │                   │
                    │                   ├── viewModel = elevatorViewModels.get(index)
                    │                   ├── Calculate Y position
                    │                   ├── viewModel.moveTo(x, y)
                    │                   ├── viewModel.currentFloor = floor
                    │                   ├── viewModel.buttons = elevData.buttons
                    │                   └── viewModel.syncUIComponent()
                    │                             │
                    │                             └── <elevator-car>
                    │                                 ├── Update position CSS
                    │                                 ├── Update floor indicator
                    │                                 └── Update button lights
                    │
                    ├──► Update passengers
                    │         │
                    │         └── for (paxData of state.passengers):
                    │                   │
                    │                   ├── viewModel = passengerViewModels.get(id)
                    │                   │
                    │                   ├── if (state === "waiting"):
                    │                   │     └── Position at floor
                    │                   │
                    │                   ├── if (state === "riding"):
                    │                   │     └── Position in elevator slot
                    │                   │
                    │                   └── viewModel.syncUIComponent()
                    │                             │
                    │                             └── <elevator-passenger>
                    │                                 └── Update position CSS
                    │
                    └──► Advance animations
                              │
                              └── viewModel.tick(dt)
                                        │
                                        └── Process interpolations
                                            (smooth movement)
```

---

## 9. Challenge End Sequence

```
endCondition.evaluate(stats) returns true/false
         │
         ▼
backend sets isChallengeEnded = true
         │
         ├──► eventBus.emit simulation:stats_changed (final stats)
         │
         └──► eventBus.emit simulation:challenge_ended
                    │
                    └── { succeeded: boolean }
         │
         ▼
GameController listener (subscribed to simulation:challenge_ended)
         │
         ├──► Stop game loop (don't request next frame)
         │
         └──► Call this.end()
                    │
                    ▼
AppEventHandlers listener (subscribed to simulation:challenge_ended)
                    │
                    ├── if (succeeded):
                    │     │
                    │     ├── presentFeedback("Challenge Complete!", ...)
                    │     │
                    │     └── Show "Next Challenge" button
                    │
                    └── if (!succeeded):
                          │
                          ├── presentFeedback("Challenge Failed", ...)
                          │
                          └── Show "Try Again" button
```

---

## 10. Language Switch Sequence

```
User selects new language
         │
         ▼
CodeEditor.setLanguage(language)
         │
         ├──► Save current code to localStorage
         │         │
         │         └── key: `elevatorCode_${oldLanguage}`
         │
         ├──► Update CodeMirror language extension
         │         │
         │         └── languageCompartment.reconfigure(newLangExtension)
         │
         ├──► Update linter (JavaScript only)
         │         │
         │         └── linterCompartment.reconfigure(
         │               language === 'javascript' ? eslintLinter : []
         │             )
         │
         ├──► Load code for new language
         │         │
         │         ├── Check localStorage for saved code
         │         │
         │         └── If none: load default template
         │                   │
         │                   └── RuntimeManager.defaultTemplates[language]
         │
         └──► RuntimeManager.selectLanguage(language)
                    │
                    ├── Set currentLanguage = language
                    │
                    └── Clear any loaded code
                          │
                          └── (Will reload on next start)
```

---

## 11. Error Handling Flow

```
Error occurs during execution
         │
         ├──► Runtime loading error
         │         │
         │         └── RuntimeManager catches
         │                   │
         │                   ├── Show error in code-status
         │                   └── Prevent game start
         │
         ├──► Code compilation error
         │         │
         │         └── Runtime.loadCode catches
         │                   │
         │                   ├── Parse error message
         │                   ├── presentCodeStatus(error)
         │                   └── Prevent game start
         │
         ├──► User code runtime error
         │         │
         │         └── backend.callUserCode catches
         │                   │
         │                   ├── Log error to console
         │                   ├── Continue simulation
         │                   │   (graceful degradation)
         │                   └── User code just doesn't run
         │
         └──► Simulation error
                    │
                    └── GameController.runFrame catches
                              │
                              ├── Log error to console
                              ├── Stop game loop
                              └── Show error feedback
```

---

## 12. Cleanup Sequence

```
Challenge ends OR User stops
         │
         ▼
GameController.cleanup()
         │
         ├──► abortController.abort()
         │         │
         │         └── All event listeners removed at once
         │
         ├──► viewModelManager.cleanup()
         │         │
         │         ├── Clear floorViewModels map
         │         ├── Clear elevatorViewModels map
         │         └── Clear passengerViewModels map
         │
         └──► backend.cleanup()
                    │
                    ├── Clear floors[]
                    ├── Clear elevators[]
                    └── Clear passengers[]
         │
         ▼
Ready for new challenge
```

---

## Related Documentation

- [Architecture Overview](./architecture-overview.md) - High-level system overview
- [Component Diagrams](./architecture-components.md) - Component relationships
- [File Reference](./architecture-files.md) - Directory structure guide
