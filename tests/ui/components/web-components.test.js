import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock IntersectionObserver for JSDOM (not natively supported)
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Import component registrations
import "../../../src/ui/components/elevator-stats.js";
import "../../../src/ui/components/game-feedback.js";
import "../../../src/ui/components/elevator-passenger.js";

import { EventBus } from "../../../src/utils/EventBus.js";

/**
 * Helper: create element, add to DOM, wait for connectedCallback.
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @returns {HTMLElement}
 */
function createElement(tag, attrs = {}) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  document.body.appendChild(el);
  return el;
}

describe("elevator-stats", () => {
  /** @type {HTMLElement} */
  let el;

  afterEach(() => {
    el?.remove();
  });

  it("should create shadow DOM on connect", () => {
    el = createElement("elevator-stats");
    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot?.innerHTML).toContain("data-stat");
  });

  it("should render stat values from attributes", () => {
    el = createElement("elevator-stats", {
      transported: "42",
      "elapsed-time": "30s",
      "move-count": "15",
    });

    const transported = el.shadowRoot?.querySelector(
      '[data-stat="transported"]',
    );
    expect(transported?.textContent).toBe("42");

    const moves = el.shadowRoot?.querySelector('[data-stat="move-count"]');
    expect(moves?.textContent).toBe("15");
  });

  it("should update when attributes change", () => {
    el = createElement("elevator-stats", { transported: "0" });

    el.setAttribute("transported", "99");

    const transported = el.shadowRoot?.querySelector(
      '[data-stat="transported"]',
    );
    expect(transported?.textContent).toBe("99");
  });

  it("should update from stats object via setter", () => {
    el = createElement("elevator-stats");

    /** @type {any} */ (el).world = {
      stats: {
        transportedCount: 25,
        elapsedTime: 10,
        transportedPerSec: 2.5,
        avgWaitTime: 3.2,
        maxWaitTime: 8.1,
        moveCount: 7,
      },
    };

    expect(el.getAttribute("transported")).toBe("25");
    expect(el.getAttribute("move-count")).toBe("7");
  });

  it("should subscribe to eventBus stats events", () => {
    el = createElement("elevator-stats");
    const eventBus = new EventBus();

    /** @type {any} */ (el).eventBus = eventBus;

    eventBus.emit("simulation:stats_changed", {
      transportedCount: 50,
      elapsedTime: 20,
      transportedPerSec: 2.5,
      avgWaitTime: 4.0,
      maxWaitTime: 9.0,
      moveCount: 12,
    });

    expect(el.getAttribute("transported")).toBe("50");
    expect(el.getAttribute("move-count")).toBe("12");
  });

  it("should clean up event listeners on disconnect", () => {
    el = createElement("elevator-stats");
    const eventBus = new EventBus();

    /** @type {any} */ (el).eventBus = eventBus;
    el.remove();

    // Should not throw or update after disconnect
    eventBus.emit("simulation:stats_changed", {
      transportedCount: 999,
      elapsedTime: 0,
      transportedPerSec: 0,
      avgWaitTime: 0,
      maxWaitTime: 0,
      moveCount: 0,
    });

    expect(el.getAttribute("transported")).not.toBe("999");
  });
});

describe("game-feedback", () => {
  /** @type {HTMLElement} */
  let el;

  afterEach(() => {
    el?.remove();
  });

  it("should create shadow DOM on connect", () => {
    el = createElement("game-feedback");
    expect(el.shadowRoot).not.toBeNull();
  });

  it("should render title and message", () => {
    el = createElement("game-feedback", {
      title: "Success!",
      message: "Challenge completed",
    });

    const html = el.shadowRoot?.innerHTML ?? "";
    expect(html).toContain("Success!");
    expect(html).toContain("Challenge completed");
  });

  it("should render next challenge link when next-url is set", () => {
    el = createElement("game-feedback", {
      title: "Win",
      message: "Done",
      "next-url": "#challenge=3",
    });

    const link = el.shadowRoot?.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("#challenge=3");
  });

  it("should not render link when next-url is empty", () => {
    el = createElement("game-feedback", {
      title: "Fail",
      message: "Try again",
      "next-url": "",
    });

    const link = el.shadowRoot?.querySelector("a");
    expect(link).toBeNull();
  });

  it("should re-render when attributes change", () => {
    el = createElement("game-feedback", {
      title: "First",
      message: "msg",
    });

    el.setAttribute("title", "Second");

    const html = el.shadowRoot?.innerHTML ?? "";
    expect(html).toContain("Second");
  });
});

describe("elevator-passenger", () => {
  /** @type {HTMLElement} */
  let el;

  afterEach(() => {
    el?.remove();
  });

  it("should create shadow DOM on connect", () => {
    el = createElement("elevator-passenger");
    expect(el.shadowRoot).not.toBeNull();
  });

  it("should render passenger SVG icon", () => {
    el = createElement("elevator-passenger", {
      "passenger-type": "male",
    });

    const icon = el.shadowRoot?.querySelector(".passenger-icon");
    expect(icon).not.toBeNull();
    expect(icon?.querySelector("svg")).not.toBeNull();
  });

  it("should render different passenger types", () => {
    el = createElement("elevator-passenger", {
      "passenger-type": "female",
    });

    const svg = el.shadowRoot?.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("should update position from attributes", () => {
    el = createElement("elevator-passenger", {
      "x-position": "100",
      "y-position": "200",
    });

    // Position is set via CSS custom properties
    const xVar = el.style.getPropertyValue("--translate-x");
    const yVar = el.style.getPropertyValue("--translate-y");
    expect(xVar).toBe("96px"); // 100 - 4 offset
    expect(yVar).toBe("196px"); // 200 - 4 offset
  });

  it("should add leaving class when state is leaving", () => {
    el = createElement("elevator-passenger", {
      "passenger-type": "male",
    });

    el.setAttribute("state", "leaving");

    const icon = el.shadowRoot?.querySelector(".passenger-icon");
    expect(icon?.classList.contains("leaving")).toBe(true);
  });

  it("should bind to view model via setter", () => {
    el = createElement("elevator-passenger");

    // Create a mock view model (EventTarget)
    const model = new EventTarget();
    /** @type {any} */ (model).displayType = "child";
    /** @type {any} */ (model).done = false;
    /** @type {any} */ (model).worldX = 50;
    /** @type {any} */ (model).worldY = 100;

    /** @type {any} */ (el).model = model;

    expect(el.getAttribute("passenger-type")).toBe("child");
    expect(el.getAttribute("x-position")).toBe("50");
    expect(el.getAttribute("y-position")).toBe("100");
  });

  it("should update when model dispatches new_display_state", () => {
    el = createElement("elevator-passenger");

    const model = new EventTarget();
    /** @type {any} */ (model).displayType = "male";
    /** @type {any} */ (model).done = false;
    /** @type {any} */ (model).worldX = 10;
    /** @type {any} */ (model).worldY = 20;

    /** @type {any} */ (el).model = model;

    // Update model position and fire event
    /** @type {any} */ (model).worldX = 200;
    /** @type {any} */ (model).worldY = 300;
    model.dispatchEvent(new CustomEvent("new_display_state"));

    expect(el.getAttribute("x-position")).toBe("200");
    expect(el.getAttribute("y-position")).toBe("300");
  });

  it("should remove self when model dispatches removed", () => {
    el = createElement("elevator-passenger");

    const model = new EventTarget();
    /** @type {any} */ (model).displayType = "male";
    /** @type {any} */ (model).done = false;
    /** @type {any} */ (model).worldX = 0;
    /** @type {any} */ (model).worldY = 0;

    /** @type {any} */ (el).model = model;

    expect(document.body.contains(el)).toBe(true);

    model.dispatchEvent(new CustomEvent("removed"));

    expect(document.body.contains(el)).toBe(false);
    // Prevent afterEach from trying to remove again
    el = /** @type {any} */ (null);
  });

  it("should clean up listeners on disconnect", () => {
    el = createElement("elevator-passenger");

    const model = new EventTarget();
    /** @type {any} */ (model).displayType = "male";
    /** @type {any} */ (model).done = false;
    /** @type {any} */ (model).worldX = 0;
    /** @type {any} */ (model).worldY = 0;

    /** @type {any} */ (el).model = model;

    el.remove();

    // Dispatching after disconnect should not throw
    model.dispatchEvent(new CustomEvent("new_display_state"));
    model.dispatchEvent(new CustomEvent("removed"));
  });
});
