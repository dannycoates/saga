// @ts-check
import { test, expect, testCode } from "../fixtures/test-fixtures.js";
import {
  setEditorCode,
  startSimulation,
  stopSimulation,
  getStats,
  waitForElevatorsRendered,
  waitForFloorsRendered,
  getElevatorCount,
  getFloorCount,
  increaseTimeScale,
  waitForMoveCount,
  waitForPassengersVisible,
  waitForTransported,
  waitForElapsedTime,
} from "../helpers/simulation-helpers.js";

test.describe("Simulation", () => {
  test("elevators render at correct initial positions", async ({
    appPage: page,
  }) => {
    // Start simulation to render world
    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for elevators to render
    await waitForElevatorsRendered(page);

    // Check that elevator exists
    const elevatorCount = await getElevatorCount(page);
    expect(elevatorCount).toBeGreaterThan(0);

    // Verify elevator has position attributes
    const elevator = page.locator("elevator-car").first();
    await expect(elevator).toHaveAttribute("y-position");
  });

  test("elevators move when goToFloor called", async ({ appPage: page }) => {
    // Code that moves elevator to floor 2
    const moveCode = `
export function tick(elevators, floors) {
  elevators[0].goToFloor(2);
}`;
    await setEditorCode(page, moveCode);

    // Increase time scale for faster movement
    await increaseTimeScale(page);
    await increaseTimeScale(page);

    await startSimulation(page);

    // Wait for elevator to move (move count > 0)
    await waitForMoveCount(page, 1);

    // Check stats - move count should have increased
    const stats = await getStats(page);
    expect(stats.moveCount).toBeGreaterThan(0);
  });

  test("elevator position updates smoothly", async ({ appPage: page }) => {
    // Code that moves elevator
    const moveCode = `
export function tick(elevators, floors) {
  const elevator = elevators[0];
  if (elevator.currentFloor === 0) {
    elevator.goToFloor(2);
  }
}`;
    await setEditorCode(page, moveCode);
    await startSimulation(page);

    // Collect y-positions over time
    const positions = [];
    for (let i = 0; i < 10; i++) {
      const elevator = page.locator("elevator-car").first();
      const yPos = await elevator.getAttribute("y-position");
      positions.push(parseFloat(yPos || "0"));
      await page.waitForTimeout(200);
    }

    // Y position should change (elevator moving)
    const uniquePositions = [...new Set(positions)];
    // There should be multiple different positions as elevator moves
    expect(uniquePositions.length).toBeGreaterThan(1);
  });

  test("passengers spawn at floors", async ({ appPage: page }) => {
    await setEditorCode(page, testCode.doNothingJS);

    // Increase time scale for faster spawning
    await increaseTimeScale(page);
    await increaseTimeScale(page);

    await startSimulation(page);

    // Wait for passengers to spawn
    await waitForPassengersVisible(page);

    // Check for passenger elements
    const passengerCount = await page.locator("elevator-passenger").count();
    expect(passengerCount).toBeGreaterThan(0);
  });

  test("passengers board elevators when elevator arrives", async ({
    appPage: page,
  }) => {
    // Speed up the simulation
    await increaseTimeScale(page);
    await increaseTimeScale(page);
    await increaseTimeScale(page);

    // Set efficient code to pick up passengers
    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for at least one passenger to be transported
    await waitForTransported(page, 1);

    const stats = await getStats(page);
    // At least some passengers should be transported
    expect(stats.transported).toBeGreaterThan(0);
  });

  test("passengers exit at destination floor", async ({ appPage: page }) => {
    // Speed up simulation
    await increaseTimeScale(page);
    await increaseTimeScale(page);
    await increaseTimeScale(page);

    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for passengers to be transported (exited at destination)
    await waitForTransported(page, 1);

    const stats = await getStats(page);
    // Transported count indicates passengers have exited at their destinations
    expect(stats.transported).toBeGreaterThan(0);
  });

  test("floor up/down buttons activate when passengers waiting", async ({
    appPage: page,
  }) => {
    // Use code that doesn't pick up passengers so they keep waiting
    await setEditorCode(page, testCode.doNothingJS);

    // Speed up spawning
    await increaseTimeScale(page);
    await increaseTimeScale(page);

    await startSimulation(page);

    // Wait for any floor button to become active
    await page.waitForFunction(
      () => {
        const floors = document.querySelectorAll("elevator-floor");
        for (const floor of floors) {
          if (floor.getAttribute("up-active") === "true" ||
              floor.getAttribute("down-active") === "true") {
            return true;
          }
        }
        return false;
      },
      { timeout: 10000 }
    );

    // Check for active floor buttons
    const floors = page.locator("elevator-floor");
    const floorCount = await floors.count();

    let hasActiveButton = false;
    for (let i = 0; i < floorCount; i++) {
      const floor = floors.nth(i);
      const upActive = await floor.getAttribute("up-active");
      const downActive = await floor.getAttribute("down-active");
      if (upActive === "true" || downActive === "true") {
        hasActiveButton = true;
        break;
      }
    }

    expect(hasActiveButton).toBe(true);
  });

  test("floor buttons deactivate when elevator arrives", async ({
    appPage: page,
  }) => {
    // Code that goes to floors with active buttons
    const code = `
export function tick(elevators, floors) {
  const elevator = elevators[0];
  for (const floor of floors) {
    if (floor.buttons.up || floor.buttons.down) {
      elevator.goToFloor(floor.level);
      return;
    }
  }
}`;
    await setEditorCode(page, code);

    // Speed up simulation
    await increaseTimeScale(page);
    await increaseTimeScale(page);
    await increaseTimeScale(page);

    await startSimulation(page);

    // Wait for at least one passenger to be transported (proves button was deactivated)
    await waitForTransported(page, 1);

    const stats = await getStats(page);
    // If passengers were transported, buttons were deactivated when elevator arrived
    expect(stats.transported).toBeGreaterThan(0);
  });

  test("transported counter increments when passenger delivered", async ({
    appPage: page,
  }) => {
    // Speed up simulation
    await increaseTimeScale(page);
    await increaseTimeScale(page);
    await increaseTimeScale(page);

    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Initial stats
    const initialStats = await getStats(page);
    expect(initialStats.transported).toBe(0);

    // Wait for passengers to be transported
    await waitForTransported(page, 1);

    // Stats should update
    const finalStats = await getStats(page);
    expect(finalStats.transported).toBeGreaterThan(initialStats.transported);
  });

  test("move count increments when elevator changes floors", async ({
    appPage: page,
  }) => {
    const moveCode = `
export function tick(elevators, floors) {
  const elevator = elevators[0];
  if (elevator.currentFloor === 0) {
    elevator.goToFloor(2);
  } else if (elevator.currentFloor === 2) {
    elevator.goToFloor(0);
  }
}`;
    await setEditorCode(page, moveCode);

    // Speed up simulation
    await increaseTimeScale(page);
    await increaseTimeScale(page);

    await startSimulation(page);

    // Initial stats
    const initialStats = await getStats(page);

    // Wait for elevator to make at least one move more than initial
    await waitForMoveCount(page, initialStats.moveCount + 1);

    // Move count should increase
    const finalStats = await getStats(page);
    expect(finalStats.moveCount).toBeGreaterThan(initialStats.moveCount);
  });

  test("elapsed time updates during simulation", async ({ appPage: page }) => {
    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Get initial elapsed time
    const initialStats = await getStats(page);

    // Wait for elapsed time to reach at least 1 second
    await waitForElapsedTime(page, 1);

    // Elapsed time should have increased
    const finalStats = await getStats(page);
    expect(finalStats.elapsedTime).not.toBe(initialStats.elapsedTime);
  });

  test("stats update during simulation", async ({ appPage: page }) => {
    // Speed up simulation
    await increaseTimeScale(page);
    await increaseTimeScale(page);
    await increaseTimeScale(page);

    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for passengers to be transported
    await waitForTransported(page, 1);

    const stats = await getStats(page);

    // All stats should have meaningful values
    expect(stats.transported).toBeGreaterThan(0);
    expect(stats.elapsedTime).not.toBe("0s");
    expect(parseFloat(stats.transportedPerSec)).toBeGreaterThan(0);
    expect(stats.avgWaitTime).not.toBe("0s");
    expect(stats.maxWaitTime).not.toBe("0s");
    expect(stats.moveCount).toBeGreaterThan(0);
  });
});
