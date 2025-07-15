// Import web components
import "./components/elevator-stats.js";
import "./components/challenge-control.js";
import "./components/game-feedback.js";
import "./components/elevator-floor.js";
import "./components/elevator-car.js";
import "./components/elevator-passenger.js";
import "./components/code-status.js";

// Factory functions using web components
export function presentStats(parentElem, world) {
  // Clear existing content using modern method
  parentElem.replaceChildren();

  // Create and append the web component
  const statsComponent = document.createElement("elevator-stats");
  statsComponent.world = world;
  parentElem.appendChild(statsComponent);

  return statsComponent;
}

export function presentChallenge(
  parentElem,
  challenge,
  app,
  worldManager,
  challengeNum,
) {
  // Clear existing content using modern method
  parentElem.replaceChildren();

  // Create and append the web component
  const challengeComponent = document.createElement("challenge-control");
  challengeComponent.setAttribute("challenge-num", challengeNum);
  challengeComponent.setAttribute(
    "challenge-description",
    challenge.condition.description,
  );
  challengeComponent.app = app;
  challengeComponent.worldManager = worldManager;
  parentElem.appendChild(challengeComponent);

  return challengeComponent;
}

export function presentFeedback(parentElem, title, message, url) {
  // Clear existing content using modern method
  parentElem.replaceChildren();

  // Create and append the web component
  const feedbackComponent = document.createElement("game-feedback");
  feedbackComponent.setAttribute("title", title);
  feedbackComponent.setAttribute("message", message);
  if (url) {
    feedbackComponent.setAttribute("next-url", url);
  }
  parentElem.appendChild(feedbackComponent);

  return feedbackComponent;
}

export function presentCodeStatus(parentElem, error) {
  // Clear existing content using modern method
  parentElem.replaceChildren();

  // Create and append the web component
  const codeStatusComponent = document.createElement("code-status");
  codeStatusComponent.setError(error);
  parentElem.appendChild(codeStatusComponent);

  return codeStatusComponent;
}

export function presentFloor(parentElem, display, floorCount) {
  const floorComponent = document.createElement("elevator-floor");
  floorComponent.floor = display;
  if (display.level === 0) {
    floorComponent.setAttribute("hide-down", "true");
  } else if (display.level === floorCount - 1) {
    floorComponent.setAttribute("hide-up", "true");
  }
  parentElem.appendChild(floorComponent);
}

export function presentElevator(parentElem, display) {
  const elevatorComponent = document.createElement("elevator-car");
  elevatorComponent.elevator = display;
  parentElem.appendChild(elevatorComponent);
}

export function presentPassenger(parentElem, display) {
  const passengerComponent = document.createElement("elevator-passenger");
  passengerComponent.passenger = display;
  parentElem.appendChild(passengerComponent);
}

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
