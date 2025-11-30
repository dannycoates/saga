// @ts-check
import { test, expect, testCode } from "../fixtures/test-fixtures.js";
import {
  setEditorCode,
  startSimulation,
  clickStartStop,
  isErrorModalVisible,
  getErrorMessage,
  closeErrorModal,
  waitForSimulationStopped,
  waitForErrorModalHidden,
} from "../helpers/simulation-helpers.js";

test.describe("Error Handling", () => {
  test("invalid JavaScript shows error modal", async ({ appPage: page }) => {
    await setEditorCode(page, testCode.syntaxErrorJS);

    // Try to start - this will fail due to syntax error
    await clickStartStop(page);

    // Wait for error modal to appear
    await page.locator("code-status").locator("dialog[open]").waitFor({ timeout: 5000 });

    const hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);
  });

  test("error modal displays error message", async ({ appPage: page }) => {
    await setEditorCode(page, testCode.syntaxErrorJS);

    // Try to start - this will fail due to syntax error
    await clickStartStop(page);

    // Wait for error modal
    await page.locator("code-status").locator("dialog[open]").waitFor({ timeout: 5000 });

    const errorMessage = await getErrorMessage(page);
    expect(errorMessage.length).toBeGreaterThan(0);
  });

  test("close button dismisses error modal", async ({ appPage: page }) => {
    await setEditorCode(page, testCode.syntaxErrorJS);
    await clickStartStop(page);

    // Wait for error modal
    await page.locator("code-status").locator("dialog[open]").waitFor({ timeout: 5000 });

    // Verify modal is visible
    let hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);

    // Click close button
    await closeErrorModal(page);

    // Modal should be hidden
    await waitForErrorModalHidden(page);
    hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);
  });

  test("Escape key dismisses error modal", async ({ appPage: page }) => {
    await setEditorCode(page, testCode.syntaxErrorJS);
    await clickStartStop(page);

    // Wait for error modal
    await page.locator("code-status").locator("dialog[open]").waitFor({ timeout: 5000 });

    // Verify modal is visible
    let hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);

    // Press Escape key
    await page.keyboard.press("Escape");

    // Modal should be hidden
    await waitForErrorModalHidden(page);
    hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);
  });

  test("clicking backdrop dismisses error modal", async ({ appPage: page }) => {
    await setEditorCode(page, testCode.syntaxErrorJS);
    await clickStartStop(page);

    // Wait for error modal
    await page.locator("code-status").locator("dialog[open]").waitFor({ timeout: 5000 });

    // Verify modal is visible
    let hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);

    // Click on the backdrop by clicking at the very edge of the viewport
    // The backdrop covers the entire viewport when a modal dialog is open
    // Click at top-left corner which is outside the centered modal content
    await page.mouse.click(10, 10);

    // Modal should be hidden
    await waitForErrorModalHidden(page);
    hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);
  });

  test("simulation stops when error occurs", async ({ appPage: page }) => {
    await setEditorCode(page, testCode.runtimeErrorJS);

    // Use clickStartStop since runtime error may prevent simulation from fully starting
    await clickStartStop(page);

    // Wait for runtime error to occur
    await page.locator("code-status").locator("dialog[open]").waitFor({ timeout: 5000 });

    // Simulation should be stopped after error
    await waitForSimulationStopped(page);
    await expect(
      page.locator('challenge-control[is-paused="true"]')
    ).toBeVisible();
  });

  test("error clears when code is fixed and restarted", async ({
    appPage: page,
  }) => {
    // First trigger an error
    await setEditorCode(page, testCode.syntaxErrorJS);
    await clickStartStop(page);

    // Wait for error modal
    await page.locator("code-status").locator("dialog[open]").waitFor({ timeout: 5000 });

    // Verify error modal appeared
    let hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(true);

    // Close the error modal
    await closeErrorModal(page);

    // Fix the code
    await setEditorCode(page, testCode.simpleJS);

    // Start again
    await startSimulation(page);

    // Verify simulation is running without errors (wait for it to stabilize)
    await page.waitForFunction(
      () => {
        const control = document.querySelector("challenge-control");
        const dialog = document.querySelector("code-status dialog[open]");
        // Simulation running and no error modal
        return control?.getAttribute("is-paused") === "false" && !dialog;
      },
      { timeout: 5000 }
    );

    // No error should appear
    hasError = await isErrorModalVisible(page);
    expect(hasError).toBe(false);

    // Simulation should be running
    await expect(
      page.locator('challenge-control[is-paused="false"]')
    ).toBeVisible();
  });
});
