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

export function presentWorld(worldElem, world) {
  // Clear existing content using modern method
  worldElem.replaceChildren();

  // Set world height
  worldElem.style.height = world.floorHeight * world.floors.size + "px";

  // Create floors
  let index = 0;
  world.floors.forEach((floorDisplay, floor) => {
    const floorComponent = document.createElement("elevator-floor");
    floorComponent.floor = floorDisplay;

    // Handle first and last floor button visibility
    if (index === 0) {
      floorComponent.setAttribute("hide-down", "true");
    }
    if (index === world.floors.size - 1) {
      floorComponent.setAttribute("hide-up", "true");
    }

    worldElem.appendChild(floorComponent);
    index++;
  });

  // Create elevators
  world.elevators.forEach((elevatorDisplay, elevator) => {
    const elevatorComponent = document.createElement("elevator-car");
    elevatorComponent.elevator = elevatorDisplay;
    worldElem.appendChild(elevatorComponent);
  });

  // Setup passenger creation
  const newPassengerHandler = (event) => {
    const passenger = event.detail;
    const passengerComponent = document.createElement("elevator-passenger");
    passengerComponent.passenger = passenger;
    worldElem.appendChild(passengerComponent);
  };
  world.addEventListener("new_passenger", newPassengerHandler);

  // Return cleanup function
  return {
    worldElem,
    world,
    cleanup: () => {
      world.removeEventListener("new_passenger", newPassengerHandler);
    },
  };
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
