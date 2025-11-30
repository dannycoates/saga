// @ts-check
import { test, expect } from "../fixtures/test-fixtures.js";
import {
  setEditorCode,
  getEditorCode,
  selectLanguage,
  waitForRuntimeLoaded,
  getTimeScale,
  increaseTimeScale,
  waitForCodeSaved,
} from "../helpers/simulation-helpers.js";

test.describe("Persistence", () => {
  test("JavaScript code persists across reload", async ({ cleanPage: page }) => {
    const testCode = "// JS persistence test " + Date.now();
    await setEditorCode(page, testCode);

    // Wait for auto-save
    await waitForCodeSaved(page, testCode, "javascript");

    // Reload page
    await page.reload();
    await page.waitForSelector("#code .cm-editor", { timeout: 10000 });

    // Code should be preserved
    const content = await getEditorCode(page);
    expect(content).toBe(testCode);
  });

  test("Python code persists across reload", async ({ cleanPage: page }) => {
    // Switch to Python
    await selectLanguage(page, "python");

    const testCode = "# Python persistence test " + Date.now();
    await setEditorCode(page, testCode);

    // Wait for auto-save
    await waitForCodeSaved(page, testCode, "python");

    // Reload page
    await page.reload();
    await page.waitForSelector("#code .cm-editor", { timeout: 10000 });

    // Switch back to Python
    await selectLanguage(page, "python");

    // Code should be preserved
    const content = await getEditorCode(page);
    expect(content).toBe(testCode);
  });

  test("Java code persists across reload", async ({ cleanPage: page }) => {
    // Switch to Java
    await selectLanguage(page, "java");

    const testCode = "// Java persistence test " + Date.now();
    await setEditorCode(page, testCode);

    // Wait for auto-save
    await waitForCodeSaved(page, testCode, "java");

    // Reload page
    await page.reload();
    await page.waitForSelector("#code .cm-editor", { timeout: 10000 });

    // Switch back to Java
    await selectLanguage(page, "java");

    // Code should be preserved
    const content = await getEditorCode(page);
    expect(content).toBe(testCode);
  });

  test("time scale persists across reload", async ({ cleanPage: page }) => {
    // Increase time scale
    await increaseTimeScale(page);
    await increaseTimeScale(page);

    const timeScaleBefore = await getTimeScale(page);
    expect(timeScaleBefore).toBe("3x");

    // Reload page
    await page.reload();
    await page.waitForSelector("#code .cm-editor", { timeout: 10000 });

    // Time scale should be preserved
    const timeScaleAfter = await getTimeScale(page);
    expect(timeScaleAfter).toBe("3x");
  });

  test("theme preference persists across reload", async ({
    cleanPage: page,
  }) => {
    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme")
    );

    // Toggle theme
    const themeToggle = page.locator(".theme-switcher, #theme-toggle").first();
    if ((await themeToggle.count()) > 0) {
      await themeToggle.click();
      // Wait for theme to change
      await page.waitForFunction(
        (initial) => document.documentElement.getAttribute("data-theme") !== initial,
        initialTheme,
        { timeout: 2000 }
      );

      const toggledTheme = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme")
      );

      // Reload page
      await page.reload();
      await page.waitForSelector("#code .cm-editor", { timeout: 10000 });

      // Theme should be preserved
      const themeAfterReload = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme")
      );

      expect(themeAfterReload).toBe(toggledTheme);
    }
  });

  test("layout preference persists across reload", async ({
    cleanPage: page,
  }) => {
    // Get initial layout
    const initialLayout = await page.evaluate(() =>
      localStorage.getItem("layout-preference")
    );

    // Toggle layout
    const layoutToggle = page.locator("#layout-toggle");
    await layoutToggle.click();
    // Wait for layout preference to change
    await page.waitForFunction(
      (initial) => localStorage.getItem("layout-preference") !== initial,
      initialLayout,
      { timeout: 2000 }
    );

    const toggledLayout = await page.evaluate(() =>
      localStorage.getItem("layout-preference")
    );

    // Reload page
    await page.reload();
    await page.waitForSelector("#code .cm-editor", { timeout: 10000 });

    // Layout should be preserved
    const layoutAfterReload = await page.evaluate(() =>
      localStorage.getItem("layout-preference")
    );

    expect(layoutAfterReload).toBe(toggledLayout);
  });

  test("switching languages preserves each language code", async ({
    cleanPage: page,
  }) => {
    // Set JavaScript code
    const jsCode = "// JS code " + Date.now();
    await setEditorCode(page, jsCode);
    await waitForCodeSaved(page, jsCode, "javascript");

    // Switch to Python and set code
    await selectLanguage(page, "python");
    const pyCode = "# Python code " + Date.now();
    await setEditorCode(page, pyCode);
    await waitForCodeSaved(page, pyCode, "python");

    // Switch back to JavaScript
    await selectLanguage(page, "javascript");

    // JavaScript code should be preserved
    let content = await getEditorCode(page);
    expect(content).toBe(jsCode);

    // Switch back to Python
    await selectLanguage(page, "python");

    // Python code should be preserved
    content = await getEditorCode(page);
    expect(content).toBe(pyCode);
  });
});
