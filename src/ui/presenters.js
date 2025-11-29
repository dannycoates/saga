/**
 * Presenter functions for creating and attaching web components.
 * Factory pattern for UI component instantiation.
 * @module presenters
 */

// Import web components
import "./components/elevator-stats.js";
import "./components/challenge-control.js";
import "./components/game-feedback.js";
import "./components/elevator-floor.js";
import "./components/elevator-car.js";
import "./components/elevator-passenger.js";
import "./components/code-status.js";

/**
 * @typedef {import('../game/WorldManager.js').WorldManager} WorldManager
 * @typedef {import('../app.js').ElevatorApp} ElevatorApp
 * @typedef {import('../game/WorldManager.js').Challenge} Challenge
 * @typedef {import('./DisplayManager.js').DisplayManager} DisplayManager
 * @typedef {import('./display/FloorDisplay.js').FloorDisplay} FloorDisplay
 * @typedef {import('./display/ElevatorDisplay.js').ElevatorDisplay} ElevatorDisplay
 * @typedef {import('./display/PassengerDisplay.js').PassengerDisplay} PassengerDisplay
 */

/**
 * Creates and attaches a stats component.
 * @param {HTMLElement} parentElem - Parent element
 * @param {WorldManager} world - World manager
 * @returns {ElevatorStatsElement} Created component
 */
export function presentStats(parentElem, world) {
  // Create and append the web component
  const statsComponent = /** @type {ElevatorStatsElement} */ (document.createElement("elevator-stats"));
  statsComponent.world = world;
  parentElem.replaceChildren(statsComponent);

  return statsComponent;
}

/**
 * Creates and attaches a challenge control component.
 * @param {HTMLElement} parentElem - Parent element
 * @param {Challenge & {id: number}} challenge - Challenge configuration
 * @param {ElevatorApp} app - Application instance
 * @param {WorldManager} worldManager - World manager
 * @param {number} challengeNum - Challenge number (1-indexed)
 * @returns {ChallengeControlElement} Created component
 */
export function presentChallenge(
  parentElem,
  challenge,
  app,
  worldManager,
  challengeNum,
) {
  // Create and append the web component
  const challengeComponent = /** @type {ChallengeControlElement} */ (document.createElement("challenge-control"));
  challengeComponent.setAttribute("challenge-num", String(challengeNum));
  challengeComponent.setAttribute(
    "challenge-description",
    challenge.condition.description,
  );
  challengeComponent.app = app;
  challengeComponent.worldManager = worldManager;
  parentElem.replaceChildren(challengeComponent);

  return challengeComponent;
}

/**
 * Creates and attaches a feedback component.
 * @param {HTMLElement} parentElem - Parent element
 * @param {string} title - Feedback title
 * @param {string} message - Feedback message
 * @param {string} [url] - Optional next challenge URL
 * @returns {HTMLElement} Created component
 */
export function presentFeedback(parentElem, title, message, url) {
  // Create and append the web component
  const feedbackComponent = document.createElement("game-feedback");
  feedbackComponent.setAttribute("title", title);
  feedbackComponent.setAttribute("message", message);
  if (url) {
    feedbackComponent.setAttribute("next-url", url);
  }
  parentElem.replaceChildren(feedbackComponent);

  return feedbackComponent;
}

/**
 * Creates and attaches a code status component.
 * @param {HTMLElement} parentElem - Parent element
 * @param {Error} [error] - Optional error to display
 * @returns {CodeStatusElement} Created component
 */
export function presentCodeStatus(parentElem, error) {
  // Create and append the web component
  const codeStatusComponent = /** @type {CodeStatusElement} */ (document.createElement("code-status"));
  codeStatusComponent.setError(error);
  parentElem.replaceChildren(codeStatusComponent);

  return codeStatusComponent;
}

/**
 * Creates and attaches a floor component.
 * @param {HTMLElement} parentElem - Parent element
 * @param {FloorDisplay} display - Floor display object
 * @param {number} floorCount - Total number of floors
 * @returns {void}
 */
export function presentFloor(parentElem, display, floorCount) {
  const floorComponent = /** @type {ElevatorFloorElement} */ (document.createElement("elevator-floor"));
  floorComponent.floor = display;
  if (display.level === 0) {
    floorComponent.setAttribute("hide-down", "true");
  } else if (display.level === floorCount - 1) {
    floorComponent.setAttribute("hide-up", "true");
  }
  parentElem.appendChild(floorComponent);
}

/**
 * Creates and attaches an elevator component.
 * @param {HTMLElement} parentElem - Parent element
 * @param {ElevatorDisplay} display - Elevator display object
 * @returns {void}
 */
export function presentElevator(parentElem, display) {
  const elevatorComponent = /** @type {ElevatorCarElement} */ (document.createElement("elevator-car"));
  elevatorComponent.elevator = display;
  parentElem.appendChild(elevatorComponent);
}

/**
 * Creates and attaches a passenger component.
 * @param {HTMLElement} parentElem - Parent element
 * @param {PassengerDisplay} display - Passenger display object
 * @returns {void}
 */
export function presentPassenger(parentElem, display) {
  const passengerComponent = /** @type {ElevatorPassengerElement} */ (document.createElement("elevator-passenger"));
  passengerComponent.passenger = display;
  parentElem.appendChild(passengerComponent);
}

/**
 * Presents the entire world with floors and elevators.
 * @param {HTMLElement} element - Container element
 * @param {DisplayManager} displayManager - Display manager
 * @returns {void}
 */
export function presentWorld(element, displayManager) {
  const floorCount = displayManager.floorDisplays.size;
  element.style.height = displayManager.floorHeight * floorCount + "px";
  displayManager.floorDisplays.forEach((floorDisplay) => {
    presentFloor(element, floorDisplay, floorCount);
  });
  displayManager.elevatorDisplays.forEach((elevatorDisplay) => {
    presentElevator(element, elevatorDisplay);
  });
}
