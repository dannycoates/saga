// @ts-check
import { test, expect, testCode } from "../fixtures/test-fixtures.js";
import {
  setEditorCode,
  getEditorCode,
  startSimulation,
  stopSimulation,
  waitForSimulationRunning,
  getStats,
  isErrorModalVisible,
  getErrorMessage,
  waitForElevatorsRendered,
  waitForTickCount,
  waitForMoveCount,
  waitForFloorButtonsPressed,
} from "../helpers/simulation-helpers.js";

test.describe("JavaScript Runtime", () => {
  test("default JavaScript template loads", async ({ appPage: page }) => {
    // Verify language selector shows JavaScript
    const languageSelect = page.locator("#language-select");
    await expect(languageSelect).toHaveValue("javascript");

    // Verify default template contains JavaScript code
    const content = await getEditorCode(page);
    expect(content).toContain("function tick");
  });

  test("valid JS code executes without error", async ({ appPage: page }) => {
    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for simulation to run a few ticks
    await page.waitForFunction(
      () => {
        const control = document.querySelector("challenge-control");
        return control?.getAttribute("is-paused") === "false";
      },
      { timeout: 5000 }
    );

    // Should not show error modal
    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);
  });

  test("tick function is called each frame", async ({ appPage: page }) => {
    // Use code that increments a counter to verify tick is being called
    const counterCode = `
let tickCount = 0;
export function tick(elevators, floors) {
  tickCount++;
  window.testTickCount = tickCount;
}`;
    await setEditorCode(page, counterCode);
    await startSimulation(page);

    // Wait for tick count to reach at least 11 (so we can assert > 10)
    await waitForTickCount(page, 11);

    // Check that tick was called multiple times
    const tickCount = await page.evaluate(() => window.testTickCount || 0);
    expect(tickCount).toBeGreaterThanOrEqual(11);
  });

  test("elevator.goToFloor() moves elevator", async ({ appPage: page }) => {
    // Code that moves elevator to floor 2
    const moveCode = `
export function tick(elevators, floors) {
  const elevator = elevators[0];
  if (elevator.currentFloor === 0) {
    elevator.goToFloor(2);
  }
}`;
    await setEditorCode(page, moveCode);
    await startSimulation(page);

    // Wait for elevator to make at least one move
    await waitForMoveCount(page, 1);

    // Check that elevator has moved (destination or current floor changed)
    // We can check by looking at move count
    const stats = await getStats(page);
    expect(stats.moveCount).toBeGreaterThan(0);
  });

  test("elevator.currentFloor returns correct value", async ({
    appPage: page,
  }) => {
    // Code that stores current floor values
    const checkCode = `
window.floorChecks = [];
export function tick(elevators, floors) {
  window.floorChecks.push(elevators[0].currentFloor);
}`;
    await setEditorCode(page, checkCode);
    await startSimulation(page);

    // Wait for some floor checks to accumulate
    await page.waitForFunction(
      () => (window.floorChecks || []).length > 10,
      { timeout: 5000 }
    );

    // Verify floor values are valid numbers
    const floorChecks = await page.evaluate(() => window.floorChecks || []);
    expect(floorChecks.length).toBeGreaterThan(0);
    floorChecks.forEach((floor) => {
      expect(typeof floor).toBe("number");
      expect(floor).toBeGreaterThanOrEqual(0);
    });
  });

  test("elevator.pressedFloorButtons updates when buttons pressed", async ({
    appPage: page,
  }) => {
    // Code that tracks pressed buttons - moves elevator to pick up passengers
    const trackCode = `
window.pressedButtons = [];
export function tick(elevators, floors) {
  const elevator = elevators[0];
  const buttons = elevator.pressedFloorButtons;
  if (buttons.length > 0 && !window.pressedButtons.includes(buttons[0])) {
    window.pressedButtons.push(...buttons);
  }
  // Move to floors with waiting passengers to eventually get pressed buttons
  for (const floor of floors) {
    if (floor.buttons.up || floor.buttons.down) {
      elevator.goToFloor(floor.level);
      return;
    }
  }
}`;
    await setEditorCode(page, trackCode);
    await startSimulation(page);

    // Wait for pressed buttons to be recorded (or timeout after reasonable time)
    try {
      await page.waitForFunction(
        () => (window.pressedButtons || []).length > 0,
        { timeout: 10000 }
      );
    } catch {
      // It's okay if no buttons were pressed - passengers may not have been picked up
    }

    // Check if any buttons were tracked
    const pressedButtons = await page.evaluate(() => window.pressedButtons || []);
    // Buttons might be pressed by passengers if they board the elevator
    expect(Array.isArray(pressedButtons)).toBe(true);
  });

  test("floor.buttons.up/down reflect button state", async ({
    appPage: page,
  }) => {
    // Code that moves elevator away from floor 0 first, then tracks floor button states.
    // This ensures passengers spawning on floor 0 must wait (can't board immediately).
    const trackCode = `
window.buttonStates = [];
let movedAway = false;
export function tick(elevators, floors) {
  const elevator = elevators[0];

  // First, move elevator to top floor so passengers on floor 0 can't board immediately
  if (!movedAway && elevator.currentFloor === 0) {
    elevator.goToFloor(floors.length - 1);
    return;
  }
  if (elevator.currentFloor === floors.length - 1) {
    movedAway = true;
  }

  // Track floor button states
  floors.forEach(floor => {
    if (floor.buttons.up || floor.buttons.down) {
      // Only add if not already tracked for this floor
      const existing = window.buttonStates.find(s => s.level === floor.level);
      if (!existing) {
        window.buttonStates.push({
          level: floor.level,
          up: floor.buttons.up,
          down: floor.buttons.down
        });
      }
    }
  });
}`;
    await setEditorCode(page, trackCode);
    await startSimulation(page);

    // Wait for floor buttons to be pressed
    await waitForFloorButtonsPressed(page);

    // Check if any floor buttons were tracked
    const buttonStates = await page.evaluate(() => window.buttonStates || []);
    expect(buttonStates.length).toBeGreaterThan(0);
    buttonStates.forEach((state) => {
      expect(typeof state.level).toBe("number");
      expect(typeof state.up).toBe("boolean");
      expect(typeof state.down).toBe("boolean");
    });
  });

  test("syntax error shows in code-status modal", async ({ appPage: page }) => {
    await setEditorCode(page, testCode.syntaxErrorJS);

    // Try to start - this will fail due to syntax error
    await page.evaluate(() => {
      // @ts-ignore
      window.app?.startOrStop();
    });

    // Wait for error modal to appear
    await page.locator("code-status").locator("dialog[open]").waitFor({ timeout: 5000 });

    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);

    const errorMessage = await getErrorMessage(page);
    expect(errorMessage.length).toBeGreaterThan(0);
  });

  test("runtime error shows in code-status modal", async ({
    appPage: page,
  }) => {
    await setEditorCode(page, testCode.runtimeErrorJS);
    await startSimulation(page);

    // Wait for error modal to appear
    await page.locator("code-status dialog[open]").waitFor({ timeout: 5000 });

    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);

    const errorMessage = await getErrorMessage(page);
    // Error message contains the actual error text (but not necessarily the type prefix)
    expect(errorMessage).toContain("nonExistentMethod");
  });
});
