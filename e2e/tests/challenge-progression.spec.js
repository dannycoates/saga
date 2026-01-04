// @ts-check
import { test, expect, testCode } from "../fixtures/test-fixtures.js";
import {
  setEditorCode,
  startSimulation,
  goToChallenge,
  getElevatorCount,
  getFloorCount,
  waitForElevatorsRendered,
  waitForFloorsRendered,
  isFeedbackVisible,
  clickNextChallenge,
  increaseTimeScale,
  getStats,
  waitForFeedbackVisible,
} from "../helpers/simulation-helpers.js";

test.describe("Challenge Progression", () => {
  test("Challenge 1 loads by default", async ({ appPage: page }) => {
    // Default URL should load Challenge 1
    const challengeControl = page.locator("challenge-control");
    const headerText = await challengeControl.locator("h3").textContent();

    expect(headerText).toContain("Challenge #1:");
  });

  test("URL hash challenge=3 loads challenge 3", async ({ appPage: page }) => {
    await goToChallenge(page, 3);

    const challengeControl = page.locator("challenge-control");
    const headerText = await challengeControl.locator("h3").textContent();

    expect(headerText).toContain("Challenge #3:");
  });

  test("challenge configuration applies correctly", async ({
    appPage: page,
  }) => {
    // Challenge 1: 3 floors, 1 elevator
    await goToChallenge(page, 1);
    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);
    await waitForElevatorsRendered(page);
    await waitForFloorsRendered(page);

    let elevatorCount = await getElevatorCount(page);
    let floorCount = await getFloorCount(page);

    expect(elevatorCount).toBe(1);
    expect(floorCount).toBe(3);

    // Stop current simulation
    await page.locator("challenge-control").locator(".startstop").click();

    // Challenge 3: 8 floors, 2 elevators
    await goToChallenge(page, 3);
    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);
    await waitForElevatorsRendered(page);
    await waitForFloorsRendered(page);

    elevatorCount = await getElevatorCount(page);
    floorCount = await getFloorCount(page);

    expect(elevatorCount).toBe(2);
    expect(floorCount).toBe(8);
  });

  test("completing challenge shows success feedback", async ({
    appPage: page,
  }) => {
    await goToChallenge(page, 1);

    // Maximize time scale
    for (let i = 0; i < 8; i++) {
      await increaseTimeScale(page);
    }

    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for feedback element to get a title attribute (feedback rendered)
    await page
      .locator("game-feedback[title]")
      .waitFor({ state: "attached", timeout: 45000 });

    // Feedback should be present
    const visible = await isFeedbackVisible(page);
    expect(visible).toBe(true);
  });

  test("next challenge link updates URL correctly", async ({
    appPage: page,
  }) => {
    await goToChallenge(page, 1);

    // Maximize time scale
    for (let i = 0; i < 8; i++) {
      await increaseTimeScale(page);
    }

    await setEditorCode(page, testCode.simpleJS);
    await startSimulation(page);

    // Wait for feedback to appear
    await waitForFeedbackVisible(page);

    const stats = await getStats(page);

    if (stats.transported >= 15) {
      const visible = await isFeedbackVisible(page);
      if (visible) {
        await clickNextChallenge(page);

        // Wait for URL to change to challenge 2
        await page.waitForFunction(
          () => window.location.href.includes("challenge=2"),
          { timeout: 5000 },
        );
        const url = page.url();
        expect(url).toContain("challenge=2");
      }
    }
  });

  test("all challenges can be navigated via URL", async ({ appPage: page }) => {
    // Test navigation to various challenge numbers
    const challengesToTest = [1, 2, 5, 10, 15, 16];

    for (const challengeNum of challengesToTest) {
      await goToChallenge(page, challengeNum);

      const challengeControl = page.locator("challenge-control");
      const headerText = await challengeControl.locator("h3").textContent();

      expect(headerText).toContain(`Challenge #${challengeNum}:`);
    }
  });
});
