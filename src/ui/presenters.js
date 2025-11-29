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
 * @typedef {import('./ViewModelManager.js').ViewModelManager} ViewModelManager
 * @typedef {import('./viewmodels/FloorViewModel.js').FloorViewModel} FloorViewModel
 * @typedef {import('./viewmodels/ElevatorViewModel.js').ElevatorViewModel} ElevatorViewModel
 * @typedef {import('./viewmodels/PassengerViewModel.js').PassengerViewModel} PassengerViewModel
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
 * @param {FloorViewModel} viewModel - Floor view model object
 * @param {number} floorCount - Total number of floors
 * @returns {void}
 */
export function presentFloor(parentElem, viewModel, floorCount) {
  const floorComponent = /** @type {ElevatorFloorElement} */ (document.createElement("elevator-floor"));
  floorComponent.floor = viewModel;
  if (viewModel.level === 0) {
    floorComponent.setAttribute("hide-down", "true");
  } else if (viewModel.level === floorCount - 1) {
    floorComponent.setAttribute("hide-up", "true");
  }
  parentElem.appendChild(floorComponent);
}

/**
 * Creates and attaches an elevator component.
 * @param {HTMLElement} parentElem - Parent element
 * @param {ElevatorViewModel} viewModel - Elevator view model object
 * @returns {void}
 */
export function presentElevator(parentElem, viewModel) {
  const elevatorComponent = /** @type {ElevatorCarElement} */ (document.createElement("elevator-car"));
  elevatorComponent.elevator = viewModel;
  parentElem.appendChild(elevatorComponent);
}

/**
 * Creates and attaches a passenger component.
 * @param {HTMLElement} parentElem - Parent element
 * @param {PassengerViewModel} viewModel - Passenger view model object
 * @returns {void}
 */
export function presentPassenger(parentElem, viewModel) {
  const passengerComponent = /** @type {ElevatorPassengerElement} */ (document.createElement("elevator-passenger"));
  passengerComponent.passenger = viewModel;
  parentElem.appendChild(passengerComponent);
}

/**
 * Presents the entire world with floors and elevators.
 * @param {HTMLElement} element - Container element
 * @param {ViewModelManager} viewModelManager - View model manager
 * @returns {void}
 */
export function presentWorld(element, viewModelManager) {
  const floorCount = viewModelManager.floorViewModels.size;
  element.style.height = viewModelManager.floorHeight * floorCount + "px";
  viewModelManager.floorViewModels.forEach((floorViewModel) => {
    presentFloor(element, floorViewModel, floorCount);
  });
  viewModelManager.elevatorViewModels.forEach((elevatorViewModel) => {
    presentElevator(element, elevatorViewModel);
  });
}
