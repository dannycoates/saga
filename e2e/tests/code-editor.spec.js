// @ts-check
import { test, expect, testCode } from "../fixtures/test-fixtures.js";
import {
  setEditorCode,
  getEditorCode,
  startSimulation,
  stopSimulation,
  waitForSimulationRunning,
  waitForSimulationStopped,
  waitForCodeSaved,
  waitForElapsedTime,
} from "../helpers/simulation-helpers.js";

test.describe("Code Editor", () => {
  test("editor loads with default template", async ({ appPage: page }) => {
    // Check that CodeMirror editor is present
    const editor = page.locator("#code .cm-editor");
    await expect(editor).toBeVisible();

    // Check that editor has content (default template)
    const content = await getEditorCode(page);
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("function tick");
  });

  test("editor accepts text input", async ({ appPage: page }) => {
    const testText = "// Test comment";
    await setEditorCode(page, testText);

    const content = await getEditorCode(page);
    expect(content).toBe(testText);
  });

  test("syntax highlighting activates", async ({ appPage: page }) => {
    // Check for CodeMirror syntax highlighting classes
    const editor = page.locator("#code .cm-editor");
    await expect(editor).toBeVisible();

    // CodeMirror should have syntax-highlighted spans
    // The cm-content contains the actual text with highlighting
    const cmContent = editor.locator(".cm-content");
    await expect(cmContent).toBeVisible();

    // CodeMirror 6 uses cm-line for lines - verify editor is functional
    const cmLine = editor.locator(".cm-line");
    expect(await cmLine.count()).toBeGreaterThan(0);
  });

  test("auto-save triggers on edit", async ({ appPage: page }) => {
    const testCodeStr = "// Auto-save test " + Date.now();
    await setEditorCode(page, testCodeStr);

    // Wait for auto-save to complete
    await waitForCodeSaved(page, testCodeStr);

    // Check localStorage for saved code
    const savedCode = await page.evaluate(() => {
      return localStorage.getItem("develevate_code_javascript");
    });

    expect(savedCode).toBe(testCodeStr);
  });

  test("Ctrl+S starts simulation when paused", async ({ appPage: page }) => {
    // Verify simulation is paused initially
    await expect(
      page.locator('challenge-control[is-paused="true"]'),
    ).toBeVisible();

    // Set valid code
    await setEditorCode(page, testCode.simpleJS);

    // Focus the editor and press Ctrl+S (Mod+S in CodeMirror)
    const editor = page.locator("#code .cm-content");
    await editor.click();
    await page.keyboard.press("Control+s");

    // Simulation should start
    await waitForSimulationRunning(page);
    await expect(
      page.locator('challenge-control[is-paused="false"]'),
    ).toBeVisible();
  });

  test("Ctrl+S restarts running simulation", async ({ appPage: page }) => {
    // Set valid code and start simulation
    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Verify simulation is running
    await expect(
      page.locator('challenge-control[is-paused="false"]'),
    ).toBeVisible();

    // Wait for elapsed time to reach at least 0.5 seconds
    await waitForElapsedTime(page, 0.5);

    // Focus the editor and press Ctrl+S (restarts simulation)
    const editor = page.locator("#code .cm-content");
    await editor.click();
    await page.keyboard.press("Control+s");

    // Simulation should still be running after restart
    await waitForSimulationRunning(page);
    await expect(
      page.locator('challenge-control[is-paused="false"]'),
    ).toBeVisible();
  });

  test("Reset button resets to default template", async ({ appPage: page }) => {
    // Modify the code
    const modifiedCode = "// Modified code";
    await setEditorCode(page, modifiedCode);

    // Verify modification
    let content = await getEditorCode(page);
    expect(content).toBe(modifiedCode);

    // Handle the confirmation dialog
    page.on("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });

    // Click reset button
    await page.click("#button_reset");

    // Code should be reset to default template
    content = await getEditorCode(page);
    expect(content).toContain("function tick");
    expect(content).not.toBe(modifiedCode);
  });

  test("Undo Reset restores previous code", async ({ appPage: page }) => {
    // Store original default code
    const originalCode = await getEditorCode(page);

    // Modify the code
    const modifiedCode = "// Modified code for undo test";
    await setEditorCode(page, modifiedCode);

    // Wait for auto-save
    await waitForCodeSaved(page, modifiedCode);

    // Handle reset confirmation
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // Reset the code
    await page.click("#button_reset");

    // Verify code was reset
    let content = await getEditorCode(page);
    expect(content).not.toBe(modifiedCode);

    // Click Undo Reset
    await page.click("#button_resetundo");

    // Code should be restored to the modified version
    content = await getEditorCode(page);
    expect(content).toBe(modifiedCode);
  });

  test("code persists across page reload", async ({ cleanPage: page }) => {
    const testCodeStr = "// Persistence test " + Date.now();
    await setEditorCode(page, testCodeStr);

    // Wait for auto-save
    await waitForCodeSaved(page, testCodeStr);

    // Reload the page
    await page.reload();
    await page.waitForSelector("#code .cm-editor", { timeout: 10000 });

    // Code should be preserved
    const content = await getEditorCode(page);
    expect(content).toBe(testCodeStr);
  });
});
