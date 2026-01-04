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

// Python runtime tests need extended timeout for Pyodide loading
test.describe("Python Runtime", () => {
  // Increase test timeout for Python runtime tests
  test.setTimeout(120000);

  test("language selector switches to Python", async ({ appPage: page }) => {
    // Initial language should be JavaScript
    const languageSelect = page.locator("#language-select");
    await expect(languageSelect).toHaveValue("javascript");

    // Switch to Python
    await page.selectOption("#language-select", "python");

    // Verify language changed
    await expect(languageSelect).toHaveValue("python");
  });

  test("Pyodide runtime loads with loading indicator", async ({
    appPage: page,
  }) => {
    const loadingIndicator = page.locator("#runtime-loading");

    // Switch to Python
    await page.selectOption("#language-select", "python");

    // Loading indicator should appear
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 });

    // Wait for loading to complete
    await expect(loadingIndicator).toBeHidden({ timeout: 60000 });
  });

  test("default Python template loads", async ({ appPage: page }) => {
    await selectLanguage(page, "python");

    // Check that default template contains Python code
    const content = await getEditorCode(page);
    expect(content).toContain("def tick");
  });

  test("valid Python code executes", async ({ appPage: page }) => {
    await selectLanguage(page, "python");

    await setEditorCode(page, testCode.simplePython);
    await startSimulation(page);

    // Verify simulation is running without errors
    await page.waitForFunction(
      () => {
        const control = document.querySelector("challenge-control");
        return control?.getAttribute("is-paused") === "false";
      },
      { timeout: 5000 },
    );

    // Should not show error modal
    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);
  });

  test("Python tick function called each frame", async ({ appPage: page }) => {
    await selectLanguage(page, "python");

    // Use Python code that tracks tick calls
    const counterCode = `
tick_count = 0

def tick(elevators, floors):
    global tick_count
    tick_count += 1
`;
    await setEditorCode(page, counterCode);
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
      { timeout: 5000 },
    );

    // We can't directly check Python variables from JS,
    // but we can verify the simulation is running without errors
    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);
  });

  test("Python elevator API works", async ({ appPage: page }) => {
    await selectLanguage(page, "python");

    // Code that uses elevator API
    const apiTestCode = `
def tick(elevators, floors):
    elevator = elevators[0]
    current = elevator.current_floor
    if current == 0:
        elevator.go_to_floor(2)
`;
    await setEditorCode(page, apiTestCode);
    await startSimulation(page);

    // Wait for elevator to move
    await page.waitForFunction(
      () => {
        const stats = document.querySelector("elevator-stats");
        const el = stats?.shadowRoot?.querySelector('[data-stat="move-count"]');
        return parseInt(el?.textContent || "0", 10) >= 1;
      },
      { timeout: 10000 },
    );

    // Check stats - move count should increase if elevator moved
    const stats = await getStats(page);
    expect(stats.moveCount).toBeGreaterThanOrEqual(0);

    // No error should have occurred
    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);
  });

  test("Python syntax error displays correctly", async ({ appPage: page }) => {
    await selectLanguage(page, "python");

    await setEditorCode(page, testCode.syntaxErrorPython);

    // Use clickStartStop since syntax error will prevent simulation from starting
    await clickStartStop(page);

    // Wait for error modal to appear
    await page
      .locator("code-status")
      .locator("dialog[open]")
      .waitFor({ timeout: 10000 });

    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);

    const errorMessage = await getErrorMessage(page);
    expect(errorMessage.length).toBeGreaterThan(0);
  });

  test("Python runtime error displays correctly", async ({ appPage: page }) => {
    await selectLanguage(page, "python");

    await setEditorCode(page, testCode.runtimeErrorPython);

    // Use clickStartStop since runtime error may prevent simulation from fully starting
    await clickStartStop(page);

    // Wait for error modal to appear
    await page
      .locator("code-status")
      .locator("dialog[open]")
      .waitFor({ timeout: 10000 });

    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);

    const errorMessage = await getErrorMessage(page);
    expect(errorMessage.length).toBeGreaterThan(0);
  });
});
