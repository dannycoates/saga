// Import web components
import { ElevatorStats } from './components/elevator-stats.js';
import { ChallengeControl } from './components/challenge-control.js';
import { GameFeedback } from './components/game-feedback.js';
import { ElevatorFloor } from './components/elevator-floor.js';
import { ElevatorCar } from './components/elevator-car.js';
import { ElevatorUser } from './components/elevator-user.js';
import { CodeStatus } from './components/code-status.js';

// Helper functions
export function clearAll(elems) {
  elems.forEach((elem) => {
    elem.innerHTML = "";
  });
}

// Factory functions using web components
export function presentStats(parentElem, world) {
  // Clear existing content
  parentElem.innerHTML = '';
  
  // Create and append the web component
  const statsComponent = document.createElement('elevator-stats');
  statsComponent.world = world;
  parentElem.appendChild(statsComponent);
  
  return statsComponent;
}

export function presentChallenge(
  parentElem,
  challenge,
  app,
  world,
  worldController,
  challengeNum,
  template // template parameter kept for compatibility but not used
) {
  // Clear existing content
  parentElem.innerHTML = '';
  
  // Create and append the web component
  const challengeComponent = document.createElement('challenge-control');
  challengeComponent.setAttribute('challenge-num', challengeNum);
  challengeComponent.setAttribute('challenge-description', challenge.condition.description);
  challengeComponent.app = app;
  challengeComponent.worldController = worldController;
  parentElem.appendChild(challengeComponent);
  
  return challengeComponent;
}

export function presentFeedback(
  parentElem,
  template, // template parameter kept for compatibility but not used
  world,
  title,
  message,
  url
) {
  // Clear existing content
  parentElem.innerHTML = '';
  
  // Create and append the web component
  const feedbackComponent = document.createElement('game-feedback');
  feedbackComponent.setAttribute('title', title);
  feedbackComponent.setAttribute('message', message);
  if (url) {
    feedbackComponent.setAttribute('next-url', url);
  }
  parentElem.appendChild(feedbackComponent);
  
  return feedbackComponent;
}

export function presentWorld(
  worldElem,
  world,
  floorTempl, // template parameters kept for compatibility but not used
  elevatorTempl,
  elevatorButtonTempl,
  userTempl
) {
  // Clear existing content
  worldElem.innerHTML = '';
  
  // Set world height
  worldElem.style.height = world.floorHeight * world.floors.length + "px";
  
  // Create floors
  world.floors.forEach((floor, index) => {
    const floorComponent = document.createElement('elevator-floor');
    floorComponent.floor = floor;
    
    // Handle first and last floor button visibility
    if (index === 0) {
      floorComponent.setAttribute('hide-down', 'true');
    }
    if (index === world.floors.length - 1) {
      floorComponent.setAttribute('hide-up', 'true');
    }
    
    worldElem.appendChild(floorComponent);
  });
  
  // Create elevators
  world.elevators.forEach((elevator) => {
    const elevatorComponent = document.createElement('elevator-car');
    elevatorComponent.elevator = elevator;
    worldElem.appendChild(elevatorComponent);
  });
  
  // Setup user creation
  world.addEventListener('new_user', (event) => {
    const user = event.detail;
    const userComponent = document.createElement('elevator-user');
    userComponent.user = user;
    worldElem.appendChild(userComponent);
  });
  
  return { worldElem, world };
}

export function presentCodeStatus(parentElem, template, error) {
  // Clear existing content
  parentElem.innerHTML = '';
  
  // Create and append the web component
  const codeStatusComponent = document.createElement('code-status');
  codeStatusComponent.setError(error);
  parentElem.appendChild(codeStatusComponent);
  
  return codeStatusComponent;
}

export function makeDemoFullscreen() {
  document
    .querySelectorAll("body .container > *:not(.world)")
    .forEach((elem) => {
      elem.style.visibility = "hidden";
    });

  ["html", "body", "body .container", ".world"].forEach((selector) => {
    const elem = document.querySelector(selector);
    if (elem) {
      elem.style.width = "100%";
      elem.style.margin = "0";
      elem.style.padding = "0";
    }
  });
}