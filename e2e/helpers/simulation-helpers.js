// @ts-check

/**
 * Helper utilities for Elevator Saga E2E tests
 */

/**
 * Wait for the simulation to start (is-paused="false")
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout=10000]
 */
export async function waitForSimulationRunning(page, timeout = 10000) {
  await page
    .locator('challenge-control[is-paused="false"]')
    .waitFor({ timeout });
}

/**
 * Wait for the simulation to stop (is-paused="true")
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout=10000]
 */
export async function waitForSimulationStopped(page, timeout = 10000) {
  await page
    .locator('challenge-control[is-paused="true"]')
    .waitFor({ timeout });
}

/**
 * Wait for N passengers to be transported
 * @param {import('@playwright/test').Page} page
 * @param {number} count - Number of passengers to wait for
 * @param {number} [timeout=30000]
 */
export async function waitForTransported(page, count, timeout = 30000) {
  const statsComponent = page.locator("elevator-stats");
  await statsComponent
    .locator('[data-stat="transported"]')
    .filter({ hasText: new RegExp(`^${count}$|^[${count}-9]\\d*$`) })
    .waitFor({ timeout });
}

/**
 * Get current game stats
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{transported: number, elapsedTime: string, transportedPerSec: string, avgWaitTime: string, maxWaitTime: string, moveCount: number}>}
 */
export async function getStats(page) {
  const statsComponent = page.locator("elevator-stats");

  const transported = await statsComponent
    .locator('[data-stat="transported"]')
    .textContent();
  const elapsedTime = await statsComponent
    .locator('[data-stat="elapsed-time"]')
    .textContent();
  const transportedPerSec = await statsComponent
    .locator('[data-stat="transported-per-sec"]')
    .textContent();
  const avgWaitTime = await statsComponent
    .locator('[data-stat="avg-wait-time"]')
    .textContent();
  const maxWaitTime = await statsComponent
    .locator('[data-stat="max-wait-time"]')
    .textContent();
  const moveCount = await statsComponent
    .locator('[data-stat="move-count"]')
    .textContent();

  return {
    transported: parseInt(transported || "0", 10),
    elapsedTime: elapsedTime || "0s",
    transportedPerSec: transportedPerSec || "0",
    avgWaitTime: avgWaitTime || "0s",
    maxWaitTime: maxWaitTime || "0s",
    moveCount: parseInt(moveCount || "0", 10),
  };
}

/**
 * Set code in the CodeMirror editor
 * @param {import('@playwright/test').Page} page
 * @param {string} code - Code to set in the editor
 */
export async function setEditorCode(page, code) {
  // Use the editor's setCode method for reliable code setting
  await page.evaluate((codeStr) => {
    // @ts-ignore
    window.app?.editor?.setCode(codeStr);
  }, code);
}

/**
 * Get current code from the CodeMirror editor
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function getEditorCode(page) {
  return await page.evaluate(() => {
    // Access the app's editor instance
    // @ts-ignore
    return window.app?.editor?.getCode() || "";
  });
}

/**
 * Wait for a specific runtime to finish loading
 * @param {import('@playwright/test').Page} page
 * @param {'javascript' | 'python' | 'java'} language
 * @param {number} [timeout=60000] - Extended timeout for Python/Java
 */
export async function waitForRuntimeLoaded(page, language, timeout = 60000) {
  // First, ensure loading indicator disappears
  const loadingIndicator = page.locator("#runtime-loading");

  // Wait for loading to start (if it does)
  try {
    await loadingIndicator.waitFor({ state: "visible", timeout: 1000 });
    // Loading started, wait for it to finish
    await loadingIndicator.waitFor({ state: "hidden", timeout });
  } catch {
    // Loading indicator never appeared, runtime may already be loaded
  }

  // Verify language selector shows correct value
  await page.waitForFunction(
    (lang) => {
      const select = document.querySelector("#language-select");
      return select && /** @type {HTMLSelectElement} */ (select).value === lang;
    },
    language,
    { timeout: 5000 },
  );
}

/**
 * Select a language in the language selector
 * @param {import('@playwright/test').Page} page
 * @param {'javascript' | 'python' | 'java'} language
 */
export async function selectLanguage(page, language) {
  await page.selectOption("#language-select", language);
  await waitForRuntimeLoaded(page, language);
}

/**
 * Click the Start/Stop button
 * @param {import('@playwright/test').Page} page
 */
export async function clickStartStop(page) {
  // Use evaluate to directly call the app's startOrStop method
  // This is more reliable than clicking through Shadow DOM
  await page.evaluate(() => {
    // @ts-ignore
    window.app?.startOrStop();
  });
}

/**
 * Start the simulation
 * @param {import('@playwright/test').Page} page
 */
export async function startSimulation(page) {
  const isPaused = await page
    .locator("challenge-control")
    .getAttribute("is-paused");
  if (isPaused === "true") {
    await clickStartStop(page);
    await waitForSimulationRunning(page);
  }
}

/**
 * Stop the simulation
 * @param {import('@playwright/test').Page} page
 */
export async function stopSimulation(page) {
  const isPaused = await page
    .locator("challenge-control")
    .getAttribute("is-paused");
  if (isPaused === "false") {
    await clickStartStop(page);
    await waitForSimulationStopped(page);
  }
}

/**
 * Check if the error modal is visible
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isErrorModalVisible(page) {
  // Check if dialog exists and is open without waiting
  const dialogCount = await page.locator("code-status dialog[open]").count();
  return dialogCount > 0;
}

/**
 * Get the error message from the error modal
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function getErrorMessage(page) {
  const codeStatus = page.locator("code-status");
  return (await codeStatus.locator("#error-content").textContent()) || "";
}

/**
 * Close the error modal
 * @param {import('@playwright/test').Page} page
 */
export async function closeErrorModal(page) {
  const codeStatus = page.locator("code-status");
  await codeStatus.locator(".close-button").first().click();
}

/**
 * Check if game feedback is visible (success/failure message)
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isFeedbackVisible(page) {
  // Check if game-feedback element exists with a title attribute
  // (visibility detection can be unreliable due to CSS positioning)
  const count = await page.locator("game-feedback[title]").count();
  return count > 0;
}

/**
 * Get the feedback title
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function getFeedbackTitle(page) {
  // Get the title from the attribute (more reliable than shadow DOM)
  const feedback = page.locator("game-feedback[title]");
  return (await feedback.getAttribute("title")) || "";
}

/**
 * Click the "Next challenge" link in the feedback
 * @param {import('@playwright/test').Page} page
 */
export async function clickNextChallenge(page) {
  const feedback = page.locator("game-feedback");
  await feedback.locator("a").click();
}

/**
 * Get the current time scale value
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
export async function getTimeScale(page) {
  const challengeControl = page.locator("challenge-control");
  return (
    (await challengeControl.locator(".time-scale-value").textContent()) || "1x"
  );
}

/**
 * Increase the time scale
 * @param {import('@playwright/test').Page} page
 */
export async function increaseTimeScale(page) {
  await page
    .locator("challenge-control")
    .locator(".timescale_increase")
    .click();
}

/**
 * Decrease the time scale
 * @param {import('@playwright/test').Page} page
 */
export async function decreaseTimeScale(page) {
  await page
    .locator("challenge-control")
    .locator(".timescale_decrease")
    .click();
}

/**
 * Wait for at least one elevator to exist in the world
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout=10000]
 */
export async function waitForElevatorsRendered(page, timeout = 10000) {
  await page.locator("elevator-car").first().waitFor({ timeout });
}

/**
 * Wait for at least one floor to exist in the world
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout=10000]
 */
export async function waitForFloorsRendered(page, timeout = 10000) {
  await page.locator("elevator-floor").first().waitFor({ timeout });
}

/**
 * Get the number of elevators in the world
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
export async function getElevatorCount(page) {
  return await page.locator("elevator-car").count();
}

/**
 * Get the number of floors in the world
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
export async function getFloorCount(page) {
  return await page.locator("elevator-floor").count();
}

/**
 * Navigate to a specific challenge via URL
 * @param {import('@playwright/test').Page} page
 * @param {number} challengeNum - Challenge number (1-indexed)
 */
export async function goToChallenge(page, challengeNum) {
  await page.goto(`/#challenge=${challengeNum}`);
  await page.waitForSelector("#code .cm-editor", { timeout: 10000 });
}

/**
 * Wait for elapsed time to reach at least the specified seconds
 * @param {import('@playwright/test').Page} page
 * @param {number} seconds - Minimum elapsed time to wait for
 * @param {number} [timeout=30000]
 */
export async function waitForElapsedTime(page, seconds, timeout = 30000) {
  await page.waitForFunction(
    (targetSeconds) => {
      // elevator-stats is a web component with shadow DOM
      const stats = document.querySelector("elevator-stats");
      if (!stats?.shadowRoot) return false;
      const el = stats.shadowRoot.querySelector('[data-stat="elapsed-time"]');
      if (!el) return false;
      const text = el.textContent || "0";
      const elapsed = parseFloat(text.replace("s", ""));
      return elapsed >= targetSeconds;
    },
    seconds,
    { timeout },
  );
}

/**
 * Wait for move count to reach at least the specified value
 * @param {import('@playwright/test').Page} page
 * @param {number} count - Minimum move count to wait for
 * @param {number} [timeout=30000]
 */
export async function waitForMoveCount(page, count, timeout = 30000) {
  await page.waitForFunction(
    (targetCount) => {
      // elevator-stats is a web component with shadow DOM
      const stats = document.querySelector("elevator-stats");
      if (!stats?.shadowRoot) return false;
      const el = stats.shadowRoot.querySelector('[data-stat="move-count"]');
      if (!el) return false;
      const moves = parseInt(el.textContent || "0", 10);
      return moves >= targetCount;
    },
    count,
    { timeout },
  );
}

/**
 * Wait for at least one passenger to be visible
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout=10000]
 */
export async function waitForPassengersVisible(page, timeout = 10000) {
  await page.locator("elevator-passenger").first().waitFor({ timeout });
}

/**
 * Wait for code to be saved to localStorage
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedCode - The code that should be saved
 * @param {'javascript' | 'python' | 'java'} [language='javascript']
 * @param {number} [timeout=5000]
 */
export async function waitForCodeSaved(
  page,
  expectedCode,
  language = "javascript",
  timeout = 5000,
) {
  await page.waitForFunction(
    ({ code, lang }) => {
      const saved = localStorage.getItem(`develevate_code_${lang}`);
      return saved === code;
    },
    { code: expectedCode, lang: language },
    { timeout },
  );
}

/**
 * Wait for error modal to be hidden
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout=5000]
 */
export async function waitForErrorModalHidden(page, timeout = 5000) {
  await page
    .locator("code-status dialog[open]")
    .waitFor({ state: "hidden", timeout });
}

/**
 * Wait for game feedback to be visible
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout=30000]
 */
export async function waitForFeedbackVisible(page, timeout = 30000) {
  // Use 'attached' state because visibility detection can be unreliable
  // due to CSS positioning of the overlay
  await page
    .locator("game-feedback[title]")
    .waitFor({ state: "attached", timeout });
}

/**
 * Wait for a window variable to have a specific value or pass a condition
 * @param {import('@playwright/test').Page} page
 * @param {string} varName - Name of window variable
 * @param {(value: any) => boolean} condition - Condition function
 * @param {number} [timeout=10000]
 */
export async function waitForWindowVar(
  page,
  varName,
  condition,
  timeout = 10000,
) {
  await page.waitForFunction(
    ({ name, condStr }) => {
      // @ts-ignore
      const value = window[name];
      // Evaluate condition (passed as string for serialization)
      const condFn = new Function("value", `return ${condStr}`);
      return condFn(value);
    },
    {
      name: varName,
      condStr: condition
        .toString()
        .replace(/^[^=]+=>\s*/, "return ")
        .replace(/^function[^{]*{/, "")
        .replace(/}$/, ""),
    },
    { timeout },
  );
}

/**
 * Wait for tick count to reach at least the specified value (requires window.testTickCount)
 * @param {import('@playwright/test').Page} page
 * @param {number} count - Minimum tick count
 * @param {number} [timeout=10000]
 */
export async function waitForTickCount(page, count, timeout = 10000) {
  await page.waitForFunction(
    (targetCount) => {
      // @ts-ignore
      return (window.testTickCount || 0) >= targetCount;
    },
    count,
    { timeout },
  );
}

/**
 * Wait for floor buttons to be pressed (via window.buttonStates)
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout=10000]
 */
export async function waitForFloorButtonsPressed(page, timeout = 10000) {
  await page.waitForFunction(
    () => {
      // @ts-ignore
      return (window.buttonStates || []).length > 0;
    },
    { timeout },
  );
}
