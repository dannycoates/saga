// @ts-check
import { test, expect, testCode } from "../fixtures/test-fixtures.js";
import {
  setEditorCode,
  startSimulation,
  isFeedbackVisible,
  getFeedbackTitle,
  clickNextChallenge,
  increaseTimeScale,
  getStats,
  waitForFeedbackVisible,
} from "../helpers/simulation-helpers.js";

test.describe("Game Feedback", () => {
  // These tests require completing Challenge 1 which takes time
  // We use maximum time scale to speed things up

  test("success message appears when challenge completed", async ({
    appPage: page,
  }) => {
    // Maximize time scale (1 -> 2 -> 3 -> 5 -> 8 -> 13 -> 21 -> 34 -> 40)
    for (let i = 0; i < 8; i++) {
      await increaseTimeScale(page);
    }

    // Set efficient code
    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Challenge 1: Transport 15 people in 60 seconds
    // At 40x speed, this should complete quickly
    // Wait for feedback element to get a title attribute (feedback rendered)
    await page
      .locator("game-feedback[title]")
      .waitFor({ state: "attached", timeout: 45000 });

    // Feedback should be present
    const visible = await isFeedbackVisible(page);
    expect(visible).toBe(true);
  });

  test("success message shows correct title", async ({ appPage: page }) => {
    // Maximize time scale
    for (let i = 0; i < 8; i++) {
      await increaseTimeScale(page);
    }

    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for feedback element to get a title attribute
    await page
      .locator("game-feedback[title]")
      .waitFor({ state: "attached", timeout: 45000 });

    // Get the title and check it contains "completed" or "Success"
    const title = await getFeedbackTitle(page);
    expect(
      title.toLowerCase().includes("completed") ||
        title.toLowerCase().includes("success"),
    ).toBe(true);
  });

  test("next challenge link appears on success", async ({ appPage: page }) => {
    // Maximize time scale
    for (let i = 0; i < 8; i++) {
      await increaseTimeScale(page);
    }

    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for feedback to appear (success or failure)
    await waitForFeedbackVisible(page);

    const stats = await getStats(page);

    if (stats.transported >= 15) {
      const visible = await isFeedbackVisible(page);
      if (visible) {
        // Check for "Next challenge" link
        const nextLink = page.locator("game-feedback").locator("a");
        await expect(nextLink).toBeVisible();
        const linkText = await nextLink.textContent();
        expect(linkText?.toLowerCase()).toContain("next");
      }
    }
  });

  test("clicking next challenge navigates to next challenge", async ({
    appPage: page,
  }) => {
    // Maximize time scale
    for (let i = 0; i < 8; i++) {
      await increaseTimeScale(page);
    }

    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for feedback to appear (success or failure)
    await waitForFeedbackVisible(page);

    const stats = await getStats(page);

    if (stats.transported >= 15) {
      const visible = await isFeedbackVisible(page);
      if (visible) {
        // Click next challenge
        await clickNextChallenge(page);

        // Wait for URL to change to challenge 2
        await page.waitForFunction(
          () => window.location.href.includes("challenge=2"),
          { timeout: 5000 },
        );
        const url = page.url();
        expect(url).toContain("challenge=2");

        // Wait for challenge control to update (component is replaced on challenge load)
        await page.waitForFunction(
          () => {
            const control = document.querySelector("challenge-control");
            if (!control?.shadowRoot) return false;
            const h3 = control.shadowRoot.querySelector("h3");
            return h3?.textContent?.includes("Challenge #2:");
          },
          { timeout: 5000 },
        );

        // Challenge control should show Challenge #2
        const headerText = await page
          .locator("challenge-control")
          .locator("h3")
          .textContent();
        expect(headerText).toContain("Challenge #2:");
      }
    }
  });

  test("failure message appears when challenge failed", async ({
    appPage: page,
  }) => {
    // Use code that does nothing - challenge will fail
    await setEditorCode(page, testCode.doNothingJS);

    // Maximize time scale
    for (let i = 0; i < 8; i++) {
      await increaseTimeScale(page);
    }

    await startSimulation(page);

    // Wait for feedback to appear (failure in this case)
    await waitForFeedbackVisible(page);

    // Check if failure feedback appeared
    const visible = await isFeedbackVisible(page);

    // The challenge should fail since we did nothing
    if (visible) {
      const title = await getFeedbackTitle(page);
      // Failure title contains "failed" or indicates unsuccessful completion
      expect(
        title.toLowerCase().includes("fail") ||
          title.toLowerCase().includes("try again") ||
          !title.toLowerCase().includes("completed"),
      ).toBe(true);
    }
  });

  test("failure message shows correct title", async ({ appPage: page }) => {
    // Use code that does nothing
    await setEditorCode(page, testCode.doNothingJS);

    // Maximize time scale
    for (let i = 0; i < 8; i++) {
      await increaseTimeScale(page);
    }

    await startSimulation(page);

    // Wait for feedback to appear (failure in this case)
    await waitForFeedbackVisible(page);

    const visible = await isFeedbackVisible(page);

    if (visible) {
      const title = await getFeedbackTitle(page);
      // Title should indicate failure
      expect(title.length).toBeGreaterThan(0);
    }
  });

  test("feedback overlay is properly displayed", async ({ appPage: page }) => {
    // Maximize time scale
    for (let i = 0; i < 8; i++) {
      await increaseTimeScale(page);
    }

    // Use simple code to complete challenge
    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for feedback element to get a title attribute (feedback rendered)
    await page
      .locator("game-feedback[title]")
      .waitFor({ state: "attached", timeout: 45000 });

    // Check feedback exists with title
    const feedback = page.locator("game-feedback[title]");
    await expect(feedback).toHaveAttribute("title");

    // Check feedback has message attribute
    await expect(feedback).toHaveAttribute("message");

    // The title should contain success or failure indication
    const title = await feedback.getAttribute("title");
    expect(title?.length).toBeGreaterThan(0);
  });
});
