// @ts-check
import { test as base, expect } from "@playwright/test";

/**
 * Custom test fixtures for Elevator Saga E2E tests
 */
export const test = base.extend({
  /**
   * Page fixture that waits for app initialization
   */
  appPage: async ({ page }, use) => {
    await page.goto("/");
    // Wait for CodeMirror editor to be ready
    await page.waitForSelector("#code .cm-editor", { timeout: 10000 });
    await use(page);
  },

  /**
   * Page fixture with cleared localStorage and default time scale of 1x
   */
  cleanPage: async ({ page }, use) => {
    // Navigate to the app first to access localStorage
    await page.goto("/");
    // Clear all localStorage and set time scale to 1
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("elevatorTimeScale", "1");
    });
    // Reload to apply the clean state
    await page.reload();
    await page.waitForSelector("#code .cm-editor", { timeout: 10000 });
    await use(page);
  },
});

export { expect };

/**
 * Test code snippets for different scenarios
 */
export const testCode = {
  /**
   * Simple JavaScript code that efficiently completes Challenge 1
   * (Transport 15 people in 60 seconds with 3 floors, 1 elevator)
   */
  simpleJS: `export function tick(elevators, floors) {
  const elevator = elevators[0];

  // Check for pressed floor buttons in elevator
  if (elevator.pressedFloorButtons.length > 0) {
    elevator.goToFloor(elevator.pressedFloorButtons[0]);
    return;
  }

  // Check floors for waiting passengers
  for (const floor of floors) {
    if (floor.buttons.up || floor.buttons.down) {
      elevator.goToFloor(floor.level);
      return;
    }
  }
}`,

  /**
   * JavaScript code with a syntax error
   */
  syntaxErrorJS: `export function tick(elevators, floors) {
  const elevator = elevators[0]
  elevator.goToFloor(  // Missing closing parenthesis and argument
}`,

  /**
   * JavaScript code with a runtime error
   */
  runtimeErrorJS: `export function tick(elevators, floors) {
  // This will throw a TypeError
  const x = null;
  x.nonExistentMethod();
}`,

  /**
   * Simple Python code that efficiently completes Challenge 1
   */
  simplePython: `def tick(elevators, floors):
    elevator = elevators[0]

    # Check for pressed floor buttons in elevator
    if len(elevator.pressed_floor_buttons) > 0:
        elevator.go_to_floor(elevator.pressed_floor_buttons[0])
        return

    # Check floors for waiting passengers
    for floor in floors:
        if floor.buttons.up or floor.buttons.down:
            elevator.go_to_floor(floor.level)
            return
`,

  /**
   * Python code with a syntax error
   */
  syntaxErrorPython: `def tick(elevators, floors):
    elevator = elevators[0]
    elevator.goToFloor(  # Missing closing parenthesis
`,

  /**
   * Python code with a runtime error
   */
  runtimeErrorPython: `def tick(elevators, floors):
    # This will throw an AttributeError
    x = None
    x.non_existent_method()
`,

  /**
   * Simple Java code that efficiently completes Challenge 1
   */
  simpleJava: `public class ElevatorController {
    public void tick(Elevator[] elevators, Floor[] floors) {
        Elevator elevator = elevators[0];

        // Check for pressed floor buttons in elevator
        int[] pressed = elevator.pressedFloorButtons;
        if (pressed.length > 0) {
            elevator.goToFloor(pressed[0]);
            return;
        }

        // Check floors for waiting passengers
        for (Floor floor : floors) {
            if (floor.buttons.up || floor.buttons.down) {
                elevator.goToFloor(floor.level);
                return;
            }
        }
    }
}`,

  /**
   * Java code with a compilation error
   */
  syntaxErrorJava: `public class ElevatorController {
    public void tick(Elevator[] elevators, Floor[] floors) {
        Elevator elevator = elevators[0]  // Missing semicolon
        elevator.goToFloor(0);
    }
}`,

  /**
   * Java code with a runtime error
   */
  runtimeErrorJava: `public class ElevatorController {
    public void tick(Elevator[] elevators, Floor[] floors) {
        // This will throw a NullPointerException
        String x = null;
        x.length();
    }
}`,

  /**
   * Code that does nothing (for testing simulation without actions)
   */
  doNothingJS: `export function tick(elevators, floors) {
  // Do nothing
}`,
};
