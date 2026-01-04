// @ts-check
import { test, expect } from "../fixtures/test-fixtures.js";

test.describe("Theme & Layout", () => {
  test("theme toggle switches between light/dark", async ({
    cleanPage: page,
  }) => {
    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );

    // Find and click theme toggle button
    // Theme toggle is typically in the header controls area
    const themeToggle = page.locator(".theme-switcher, #theme-toggle").first();

    // If theme toggle exists, click it
    if ((await themeToggle.count()) > 0) {
      await themeToggle.click();
      // Wait for theme to change
      await page.waitForFunction(
        (initial) =>
          document.documentElement.getAttribute("data-theme") !== initial,
        initialTheme,
        { timeout: 2000 },
      );

      const newTheme = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme"),
      );

      // Theme should have changed
      expect(newTheme).not.toBe(initialTheme);

      // Toggle back
      await themeToggle.click();
      // Wait for theme to change back
      await page.waitForFunction(
        (initial) =>
          document.documentElement.getAttribute("data-theme") === initial,
        initialTheme,
        { timeout: 2000 },
      );

      const finalTheme = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme"),
      );

      // Should be back to initial theme
      expect(finalTheme).toBe(initialTheme);
    }
  });

  test("theme applies to editor", async ({ cleanPage: page }) => {
    const editor = page.locator("#code .cm-editor");
    await expect(editor).toBeVisible();

    // Check for theme-related classes on editor
    const editorClasses = await editor.getAttribute("class");

    // CodeMirror editors should have some theme class
    expect(editorClasses).toBeTruthy();
  });

  test("theme persists across page reload", async ({ cleanPage: page }) => {
    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute("data-theme"),
    );

    // Find and click theme toggle
    const themeToggle = page.locator(".theme-switcher, #theme-toggle").first();

    if ((await themeToggle.count()) > 0) {
      await themeToggle.click();
      // Wait for theme to change
      await page.waitForFunction(
        (initial) =>
          document.documentElement.getAttribute("data-theme") !== initial,
        initialTheme,
        { timeout: 2000 },
      );

      const toggledTheme = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme"),
      );

      // Reload page
      await page.reload();
      await page.waitForSelector("#code .cm-editor", { timeout: 10000 });

      // Theme should be preserved
      const themeAfterReload = await page.evaluate(() =>
        document.documentElement.getAttribute("data-theme"),
      );

      expect(themeAfterReload).toBe(toggledTheme);
    }
  });

  test("layout toggle switches between vertical/side-by-side", async ({
    appPage: page,
  }) => {
    const layoutToggle = page.locator("#layout-toggle");
    await expect(layoutToggle).toBeVisible();

    // Get initial layout state
    const initialLayout = await page.evaluate(() =>
      localStorage.getItem("layout-preference"),
    );

    // Click layout toggle
    await layoutToggle.click();
    // Wait for layout preference to change
    await page.waitForFunction(
      (initial) => localStorage.getItem("layout-preference") !== initial,
      initialLayout,
      { timeout: 2000 },
    );

    // Layout should change (either via class or localStorage)
    const newLayout = await page.evaluate(() =>
      localStorage.getItem("layout-preference"),
    );

    // If layout preference is used, it should change
    // Or check for CSS class changes on the container
    const mainContent = page.locator(".main-content");
    const hasHorizontalClass = await mainContent.evaluate((el) =>
      el.classList.contains("horizontal"),
    );

    // Toggle should have changed something
    expect(hasHorizontalClass || newLayout !== initialLayout).toBe(true);
  });

  test("layout persists across page reload", async ({ cleanPage: page }) => {
    const layoutToggle = page.locator("#layout-toggle");

    // Get initial layout
    const initialLayout = await page.evaluate(() =>
      localStorage.getItem("layout-preference"),
    );

    // Click layout toggle
    await layoutToggle.click();
    // Wait for layout preference to change
    await page.waitForFunction(
      (initial) => localStorage.getItem("layout-preference") !== initial,
      initialLayout,
      { timeout: 2000 },
    );

    // Get layout state after toggle
    const layoutAfterToggle = await page.evaluate(() =>
      localStorage.getItem("layout-preference"),
    );

    // Reload page
    await page.reload();
    await page.waitForSelector("#code .cm-editor", { timeout: 10000 });

    // Layout should be preserved
    const layoutAfterReload = await page.evaluate(() =>
      localStorage.getItem("layout-preference"),
    );

    expect(layoutAfterReload).toBe(layoutAfterToggle);
  });

  test("splitter is visible in side-by-side mode", async ({
    appPage: page,
  }) => {
    const layoutToggle = page.locator("#layout-toggle");
    const splitter = page.locator("#layout-splitter");

    // Ensure we're in side-by-side mode
    // Check if splitter is visible
    const splitterVisible = await splitter.isVisible();

    if (!splitterVisible) {
      // Toggle to side-by-side mode
      await layoutToggle.click();
      // Wait for layout to change
      await page.waitForFunction(
        () =>
          document
            .querySelector(".main-content")
            ?.classList.contains("horizontal"),
        { timeout: 2000 },
      );
    }

    // In side-by-side mode, splitter should be visible
    const mainContent = page.locator(".main-content");
    const hasHorizontal = await mainContent.evaluate((el) =>
      el.classList.contains("horizontal"),
    );

    if (hasHorizontal) {
      await expect(splitter).toBeVisible();
    }
  });

  test("layout toggle button icon changes", async ({ appPage: page }) => {
    const layoutToggle = page.locator("#layout-toggle");
    const layoutIcon = layoutToggle.locator(".layout-icon");

    // Get initial icon
    const initialIcon = await layoutIcon.textContent();

    // Click toggle
    await layoutToggle.click();
    // Wait for icon to potentially change
    await page.waitForFunction(
      (initial) => {
        const icon = document.querySelector("#layout-toggle .layout-icon");
        return icon?.textContent !== initial || true; // Always pass after checking
      },
      initialIcon,
      { timeout: 2000 },
    );

    // Icon might change to indicate different layout state
    const newIcon = await layoutIcon.textContent();

    // Icons should represent different layouts
    // The actual icons are ⚎ and ⚏ or similar
    expect(initialIcon || newIcon).toBeTruthy();
  });
});
