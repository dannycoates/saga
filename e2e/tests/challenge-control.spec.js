// @ts-check
import { test, expect, testCode } from "../fixtures/test-fixtures.js";
import {
  setEditorCode,
  startSimulation,
  stopSimulation,
  waitForSimulationRunning,
  waitForSimulationStopped,
  clickStartStop,
  getTimeScale,
  increaseTimeScale,
  decreaseTimeScale,
} from "../helpers/simulation-helpers.js";

test.describe("Challenge Control", () => {
  test("Start button initiates simulation", async ({ appPage: page }) => {
    // Verify initial paused state
    await expect(
      page.locator('challenge-control[is-paused="true"]'),
    ).toBeVisible();

    // Set valid code
    await setEditorCode(page, testCode.simpleJS);

    // Click Start button
    await clickStartStop(page);

    // Verify simulation started
    await waitForSimulationRunning(page);
    await expect(
      page.locator('challenge-control[is-paused="false"]'),
    ).toBeVisible();

    // Button text should change to "Stop"
    const buttonText = await page
      .locator("challenge-control")
      .locator(".startstop")
      .textContent();
    expect(buttonText).toBe("Stop");
  });

  test("Stop button halts and resets simulation", async ({ appPage: page }) => {
    // Start simulation
    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Verify running
    await expect(
      page.locator('challenge-control[is-paused="false"]'),
    ).toBeVisible();

    // Click Stop button
    await clickStartStop(page);

    // Verify simulation stopped
    await waitForSimulationStopped(page);
    await expect(
      page.locator('challenge-control[is-paused="true"]'),
    ).toBeVisible();

    // Button text should change to "Start"
    const buttonText = await page
      .locator("challenge-control")
      .locator(".startstop")
      .textContent();
    expect(buttonText).toBe("Start");
  });

  test("time scale increase button multiplies by 1.618", async ({
    cleanPage: page,
  }) => {
    // Get initial time scale (should be 1x)
    let timeScale = await getTimeScale(page);
    expect(timeScale).toBe("1x");

    // Click increase button
    await increaseTimeScale(page);

    // Time scale should be ~2x (1 * 1.618 rounded)
    timeScale = await getTimeScale(page);
    expect(timeScale).toBe("2x");

    // Click increase again
    await increaseTimeScale(page);

    // Time scale should be ~3x (2 * 1.618 rounded)
    timeScale = await getTimeScale(page);
    expect(timeScale).toBe("3x");
  });

  test("time scale decrease button divides by 1.618", async ({
    cleanPage: page,
  }) => {
    // First increase to 2x
    await increaseTimeScale(page);
    let timeScale = await getTimeScale(page);
    expect(timeScale).toBe("2x");

    // Click decrease button
    await decreaseTimeScale(page);

    // Time scale should be back to 1x
    timeScale = await getTimeScale(page);
    expect(timeScale).toBe("1x");
  });

  test("time scale display updates correctly", async ({ cleanPage: page }) => {
    const challengeControl = page.locator("challenge-control");
    const timeScaleDisplay = challengeControl.locator(".time-scale-value");

    // Initial value
    await expect(timeScaleDisplay).toHaveText("1x");

    // Increase multiple times
    await increaseTimeScale(page);
    await expect(timeScaleDisplay).toHaveText("2x");

    await increaseTimeScale(page);
    await expect(timeScaleDisplay).toHaveText("3x");

    await increaseTimeScale(page);
    await expect(timeScaleDisplay).toHaveText("5x");
  });

  test("time scale persists across reload", async ({ cleanPage: page }) => {
    // Increase time scale
    await increaseTimeScale(page);
    await increaseTimeScale(page);
    const timeScaleBeforeReload = await getTimeScale(page);
    expect(timeScaleBeforeReload).toBe("3x");

    // Reload page
    await page.reload();
    await page.waitForSelector("#code .cm-editor", { timeout: 10000 });

    // Time scale should be preserved
    const timeScaleAfterReload = await getTimeScale(page);
    expect(timeScaleAfterReload).toBe("3x");
  });

  test("challenge description displays correctly", async ({
    appPage: page,
  }) => {
    const challengeControl = page.locator("challenge-control");
    const description = challengeControl.locator("#description");

    // Challenge 1 description should mention transporting people
    const descText = await description.textContent();
    expect(descText).toContain("Transport");
  });

  test("challenge number displays correctly", async ({ appPage: page }) => {
    const challengeControl = page.locator("challenge-control");

    // Should display "Challenge #1:" for the default challenge
    const headerText = await challengeControl.locator("h3").textContent();
    expect(headerText).toContain("Challenge #1:");
  });
});
