// Template renderer using simple string replacement
function renderTemplate(template, data) {
  return template.replace(/{([^}]+)}/g, (match, key) => {
    const keys = key.split(".");
    let value = data;
    for (const k of keys) {
      value = value?.[k];
    }
    return value !== undefined ? value : match;
  });
}

// Helper functions
export function clearAll(elems) {
  elems.forEach((elem) => {
    elem.innerHTML = "";
  });
}

function setTransformPos(elem, x, y) {
  const style = `translate(${x}px,${y}px) translateZ(0)`;
  elem.style.transform = style;
  elem.style["-ms-transform"] = style;
  elem.style["-webkit-transform"] = style;
}

function updateUserState(userElem, elemUser, user) {
  setTransformPos(elemUser, user.worldX, user.worldY);
  if (user.done) {
    userElem.classList.add("leaving");
  }
}

// Presenter classes
export class StatsPresenter {
  constructor(parentElem, world) {
    this.transportedCounter = parentElem.querySelector(".transportedcounter");
    this.elapsedTime = parentElem.querySelector(".elapsedtime");
    this.transportedPerSec = parentElem.querySelector(".transportedpersec");
    this.avgWaitTime = parentElem.querySelector(".avgwaittime");
    this.maxWaitTime = parentElem.querySelector(".maxwaittime");
    this.moveCount = parentElem.querySelector(".movecount");

    world.on("stats_display_changed", () => this.updateStats(world));
    world.trigger("stats_display_changed");
  }

  updateStats(world) {
    this.transportedCounter.textContent = world.transportedCounter;
    this.elapsedTime.textContent = world.elapsedTime.toFixed(0) + "s";
    this.transportedPerSec.textContent = world.transportedPerSec.toPrecision(3);
    this.avgWaitTime.textContent = world.avgWaitTime.toFixed(1) + "s";
    this.maxWaitTime.textContent = world.maxWaitTime.toFixed(1) + "s";
    this.moveCount.textContent = world.moveCount;
  }
}

export class ChallengePresenter {
  constructor(
    parentElem,
    challenge,
    app,
    world,
    worldController,
    challengeNum,
    template,
  ) {
    const html = renderTemplate(template, {
      challenge: challenge,
      num: challengeNum,
      timeScale: worldController.timeScale.toFixed(0) + "x",
      startButtonText: worldController.isPaused ? "Start" : "Stop",
    });
    parentElem.innerHTML = html;

    parentElem.querySelector(".startstop").addEventListener("click", () => {
      app.startStopOrRestart();
    });

    parentElem
      .querySelector(".timescale_increase")
      .addEventListener("click", (e) => {
        e.preventDefault();
        if (worldController.timeScale < 40) {
          const timeScale = Math.round(worldController.timeScale * 1.618);
          worldController.setTimeScale(timeScale);
        }
      });

    parentElem
      .querySelector(".timescale_decrease")
      .addEventListener("click", (e) => {
        e.preventDefault();
        const timeScale = Math.round(worldController.timeScale / 1.618);
        worldController.setTimeScale(timeScale);
      });
  }
}

export class FeedbackPresenter {
  constructor(parentElem, template, world, title, message, url) {
    const html = renderTemplate(template, {
      title: title,
      message: message,
      url: url,
      paddingTop: world.floors.length * world.floorHeight * 0.2,
    });
    parentElem.innerHTML = html;

    if (!url) {
      const link = parentElem.querySelector("a");
      if (link) link.remove();
    }
  }
}

export class WorldPresenter {
  constructor(
    worldElem,
    world,
    floorTempl,
    elevatorTempl,
    elevatorButtonTempl,
    userTempl,
  ) {
    this.worldElem = worldElem;
    this.world = world;
    this.elevatorButtonTempl = elevatorButtonTempl;
    this.userTempl = userTempl;

    worldElem.style.height = world.floorHeight * world.floors.length + "px";

    // Create floors
    this.createFloors(floorTempl);

    // Create elevators
    this.createElevators(elevatorTempl);

    // Setup user creation
    this.setupUserHandling();
  }

  createFloors(template) {
    this.world.floors.forEach((floor) => {
      const floorHtml = renderTemplate(template, floor);
      const floorDiv = document.createElement("div");
      floorDiv.innerHTML = floorHtml;
      const floorElem = floorDiv.firstElementChild;

      const upButton = floorElem.querySelector(".up");
      const downButton = floorElem.querySelector(".down");

      floor.on("buttonstate_change", (buttons) => {
        upButton.classList.toggle("activated", buttons.up);
        downButton.classList.toggle("activated", buttons.down);
      });

      upButton.addEventListener("click", () => {
        floor.pressUpButton();
      });

      downButton.addEventListener("click", () => {
        floor.pressDownButton();
      });

      this.worldElem.appendChild(floorElem);
    });

    // Hide buttons for first and last floors
    const floors = this.worldElem.querySelectorAll(".floor");
    floors[0].querySelector(".down").classList.add("invisible");
    floors[floors.length - 1].querySelector(".up").classList.add("invisible");
  }

  renderElevatorButtons(states) {
    return states
      .map((b, i) => {
        return renderTemplate(this.elevatorButtonTempl, { floorNum: i });
      })
      .join("");
  }

  createElevators(template) {
    this.world.elevators.forEach((elevator) => {
      const elevatorHtml = renderTemplate(template, { e: elevator });
      const elevDiv = document.createElement("div");
      elevDiv.innerHTML = elevatorHtml;
      const elevatorElem = elevDiv.firstElementChild;

      const buttonIndicator = elevatorElem.querySelector(".buttonindicator");
      buttonIndicator.innerHTML = this.renderElevatorButtons(elevator.buttons);

      const buttons = Array.from(buttonIndicator.children);
      const floorIndicator = elevatorElem.querySelector(
        ".floorindicator > span",
      );

      elevatorElem.addEventListener("click", (e) => {
        if (e.target.classList.contains("buttonpress")) {
          elevator.pressFloorButton(parseInt(e.target.textContent));
        }
      });

      elevator.on("new_display_state", () => {
        setTransformPos(elevatorElem, elevator.worldX, elevator.worldY);
      });

      elevator.on("new_current_floor", (floor) => {
        floorIndicator.textContent = floor;
      });

      elevator.on("floor_buttons_changed", (states, indexChanged) => {
        buttons[indexChanged].classList.toggle(
          "activated",
          states[indexChanged],
        );
      });

      elevator.on("indicatorstate_change", (indicatorStates) => {
        elevatorElem
          .querySelector(".up")
          .classList.toggle("activated", indicatorStates.up);
        elevatorElem
          .querySelector(".down")
          .classList.toggle("activated", indicatorStates.down);
      });

      elevator.trigger("new_state", elevator);
      elevator.trigger("new_display_state", elevator);
      elevator.trigger("new_current_floor", elevator.currentFloor);

      this.worldElem.appendChild(elevatorElem);
    });
  }

  setupUserHandling() {
    this.world.on("new_user", (user) => {
      const userHtml = renderTemplate(this.userTempl, {
        u: user,
        state: user.done ? "leaving" : "",
      });

      const userDiv = document.createElement("div");
      userDiv.innerHTML = userHtml;
      const userElem = userDiv.firstElementChild;

      user.on("new_display_state", () => {
        updateUserState(userElem, userElem, user);
      });

      user.on("removed", () => {
        userElem.remove();
      });

      this.worldElem.appendChild(userElem);
    });
  }
}

export class CodeStatusPresenter {
  constructor(parentElem, template, error) {
    console.log(error);
    const errorDisplay = error ? "block" : "none";
    const successDisplay = error ? "none" : "block";
    let errorMessage = error;

    if (error && error.stack) {
      errorMessage = error.stack;
      errorMessage = errorMessage.replace(/\n/g, "<br>");
    }

    const html = renderTemplate(template, {
      errorMessage: errorMessage,
      errorDisplay: errorDisplay,
      successDisplay: successDisplay,
    });
    parentElem.innerHTML = html;
  }
}

// Factory functions for backward compatibility
export function presentStats(parentElem, world) {
  return new StatsPresenter(parentElem, world);
}

export function presentChallenge(
  parentElem,
  challenge,
  app,
  world,
  worldController,
  challengeNum,
  template,
) {
  return new ChallengePresenter(
    parentElem,
    challenge,
    app,
    world,
    worldController,
    challengeNum,
    template,
  );
}

export function presentFeedback(
  parentElem,
  template,
  world,
  title,
  message,
  url,
) {
  return new FeedbackPresenter(
    parentElem,
    template,
    world,
    title,
    message,
    url,
  );
}

export function presentWorld(
  worldElem,
  world,
  floorTempl,
  elevatorTempl,
  elevatorButtonTempl,
  userTempl,
) {
  return new WorldPresenter(
    worldElem,
    world,
    floorTempl,
    elevatorTempl,
    elevatorButtonTempl,
    userTempl,
  );
}

export function presentCodeStatus(parentElem, template, error) {
  return new CodeStatusPresenter(parentElem, template, error);
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
