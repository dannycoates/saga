import { JSSimulationBackend } from "../src/core/JSSimulationBackend.js";

// Example 1: Run simulation without any display
async function runHeadlessSimulation() {
  const backend = new JSSimulationBackend();
  backend.initialize({
    floorCount: 4,
    elevatorCount: 2,
    spawnRate: 0.5,
  });

  // Simple elevator logic
  const elevatorLogic = {
    tick: async (elevators, floors) => {
      elevators.forEach((elevator, i) => {
        // Simple logic: go to floors with pressed buttons
        const pressedButtons = elevator.pressedFloorButtons;
        if (pressedButtons.length > 0 && elevator.destinationFloor === null) {
          elevator.goToFloor(pressedButtons[0]);
        }

        // Check floor buttons
        floors.forEach((floor) => {
          if (
            (floor.buttons.up || floor.buttons.down) &&
            elevator.currentFloor === floor.level &&
            elevator.destinationFloor === null
          ) {
            // Go to ground floor or top floor alternately
            elevator.goToFloor(i % 2 === 0 ? 0 : floors.length - 1);
          }
        });
      });
    },
  };

  // Run simulation for 60 seconds
  let time = 0;
  const dt = 1 / 60; // 60 FPS

  while (time < 60) {
    // Run elevator logic
    await backend.callUserCode(elevatorLogic, dt);

    // Tick the backend
    backend.tick(dt);
    time += dt;
  }

  const stats = backend.getStats();
  console.log("Simulation complete!");
  console.log(`Transported: ${stats.transportedCounter} passengers`);
  console.log(`Average wait time: ${stats.avgWaitTime.toFixed(2)} seconds`);
  console.log(`Max wait time: ${stats.maxWaitTime.toFixed(2)} seconds`);
}

// Run the examples
console.log("Running headless simulation...");
runHeadlessSimulation();
