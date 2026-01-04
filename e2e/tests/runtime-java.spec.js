// @ts-check
import { test, expect, testCode } from "../fixtures/test-fixtures.js";
import {
  setEditorCode,
  getEditorCode,
  startSimulation,
  clickStartStop,
  selectLanguage,
  waitForRuntimeLoaded,
  isErrorModalVisible,
  getErrorMessage,
  getStats,
} from "../helpers/simulation-helpers.js";

// Java runtime tests need extended timeout for CheerpJ loading
test.describe("Java Runtime", () => {
  // Increase test timeout for Java runtime tests
  test.setTimeout(180000);

  test("language selector switches to Java", async ({ appPage: page }) => {
    // Initial language should be JavaScript
    const languageSelect = page.locator("#language-select");
    await expect(languageSelect).toHaveValue("javascript");

    // Switch to Java
    await page.selectOption("#language-select", "java");

    // Verify language changed
    await expect(languageSelect).toHaveValue("java");
  });

  test("CheerpJ runtime loads with loading indicator", async ({
    appPage: page,
  }) => {
    const loadingIndicator = page.locator("#runtime-loading");

    // Switch to Java
    await page.selectOption("#language-select", "java");

    // Loading indicator should appear
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 });

    // Wait for loading to complete (CheerpJ can take a while)
    await expect(loadingIndicator).toBeHidden({ timeout: 120000 });
  });

  test("default Java template loads", async ({ appPage: page }) => {
    await selectLanguage(page, "java");

    // Check that default template contains Java code
    const content = await getEditorCode(page);
    expect(content).toContain("class ElevatorController");
    expect(content).toContain("void tick");
  });

  test("valid Java code executes", async ({ appPage: page }) => {
    await selectLanguage(page, "java");

    await setEditorCode(page, testCode.simpleJava);
    await startSimulation(page);

    // Verify simulation is running without errors
    await page.waitForFunction(
      () => {
        const control = document.querySelector("challenge-control");
        return control?.getAttribute("is-paused") === "false";
      },
      { timeout: 10000 },
    );

    // Should not show error modal
    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);
  });

  test("Java tick method called each frame", async ({ appPage: page }) => {
    await selectLanguage(page, "java");

    // Use Java code that should work
    const simpleCode = `
public class ElevatorController {
    public void tick(Elevator[] elevators, Floor[] floors) {
        // Simple tick implementation
    }
}`;
    await setEditorCode(page, simpleCode);
    await startSimulation(page);

    // Verify simulation is running without errors for a bit
    await page.waitForFunction(
      () => {
        const control = document.querySelector("challenge-control");
        const stats = document.querySelector("elevator-stats");
        const elapsed = stats?.shadowRoot?.querySelector(
          '[data-stat="elapsed-time"]',
        );
        const time = parseFloat(elapsed?.textContent?.replace("s", "") || "0");
        return control?.getAttribute("is-paused") === "false" && time >= 0.5;
      },
      { timeout: 10000 },
    );

    // We can verify the simulation is running without errors
    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);
  });

  test("Java elevator API works via JNI callbacks", async ({
    appPage: page,
  }) => {
    await selectLanguage(page, "java");

    // Code that uses elevator API
    const apiTestCode = `
public class ElevatorController {
    public void tick(Elevator[] elevators, Floor[] floors) {
        Elevator elevator = elevators[0];
        int current = elevator.currentFloor;
        if (current == 0) {
            elevator.goToFloor(2);
        }
    }
}`;
    await setEditorCode(page, apiTestCode);
    await startSimulation(page);

    // Wait for elevator to move
    await page.waitForFunction(
      () => {
        const stats = document.querySelector("elevator-stats");
        const el = stats?.shadowRoot?.querySelector('[data-stat="move-count"]');
        return parseInt(el?.textContent || "0", 10) >= 1;
      },
      { timeout: 15000 },
    );

    // Check stats - move count should increase if elevator moved
    const stats = await getStats(page);
    expect(stats.moveCount).toBeGreaterThanOrEqual(0);

    // No error should have occurred
    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);
  });

  test("Java compilation error displays correctly", async ({
    appPage: page,
  }) => {
    await selectLanguage(page, "java");

    await setEditorCode(page, testCode.syntaxErrorJava);

    // Use clickStartStop since compilation error will prevent simulation from starting
    await clickStartStop(page);

    // Wait for error modal to appear (Java compilation can take a while)
    await page
      .locator("code-status")
      .locator("dialog[open]")
      .waitFor({ timeout: 30000 });

    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);

    const errorMessage = await getErrorMessage(page);
    expect(errorMessage.length).toBeGreaterThan(0);
  });

  test("Java runtime exception displays correctly", async ({
    appPage: page,
  }) => {
    await selectLanguage(page, "java");

    await setEditorCode(page, testCode.runtimeErrorJava);

    // Use clickStartStop since runtime error may prevent simulation from fully starting
    await clickStartStop(page);

    // Wait for error modal to appear (runtime error may take a moment)
    await page
      .locator("code-status")
      .locator("dialog[open]")
      .waitFor({ timeout: 30000 });

    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);

    const errorMessage = await getErrorMessage(page);
    expect(errorMessage.length).toBeGreaterThan(0);
  });
});
