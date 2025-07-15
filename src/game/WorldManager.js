import { JSSimulationBackend } from "../core/JSSimulationBackend.js";
import { DisplayManager } from "../ui/DisplayManager.js";
import { presentStats } from "../ui/presenters.js";
import { presentWorld } from "../ui/presentWorld.js";
import { APP_CONSTANTS } from "../config/constants.js";

/**
 * WorldManager that directly manages simulation backend and display manager
 */
export class WorldManager extends EventTarget {
  constructor(dom) {
    super();
    this.dom = dom;

    // Core components
    this.backend = null;
    this.displayManager = null;
    this.worldPresenter = null;

    // Configuration
    this.options = null;
    this.floorHeight = 50;

    // Event handling
    this.abortController = new AbortController();

    // World controller properties
    this.dtMax = APP_CONSTANTS.FRAME_RATE;
    this.timeScale = 1.0;
    this.isPaused = true;

    // Animation frame tracking
    this.animationFrameId = null;
    this.codeObj = null;
    this.lastT = null;
    this.runFrame = async (t) => {
      if (!this.isPaused && !this.challengeEnded && this.lastT !== null) {
        const dt = t - this.lastT;
        let scaledDt = dt * 0.001 * this.timeScale;
        scaledDt = Math.min(scaledDt, this.dtMax * 3 * this.timeScale);

        try {
          await this.backend.callUserCode(this.codeObj, dt);
        } catch (e) {
          this.handlePassengerCodeError(e);
        }

        while (scaledDt > 0.0 && !this.challengeEnded) {
          const thisDt = Math.min(this.dtMax, scaledDt);
          this.backend.tick(thisDt);
          scaledDt -= this.dtMax;
        }
      }
      this.lastT = t;
      if (!this.challengeEnded) {
        this.animationFrameId = window.requestAnimationFrame(this.runFrame);
      }
    };
  }

  get floors() {
    return this.displayManager.floors;
  }

  get elevators() {
    return this.displayManager.elevators;
  }

  get passengers() {
    return this.displayManager.passengers;
  }

  get stats() {
    return this.backend
      ? this.backend.getStats()
      : {
          transportedCounter: 0,
          transportedPerSec: 0,
          avgWaitTime: 0,
          maxWaitTime: 0,
          moveCount: 0,
          elapsedTime: 0,
        };
  }

  get challengeEnded() {
    return this.backend ? this.backend.hasEnded() : true;
  }

  setTimeScale(timeScale) {
    this.timeScale = timeScale;
    this.dispatchEvent(new CustomEvent("timescale_changed"));
    localStorage.setItem(APP_CONSTANTS.TIME_SCALE_KEY, this.timeScale);
  }

  setPaused(paused) {
    this.isPaused = paused;
    this.dispatchEvent(new CustomEvent("timescale_changed"));
  }

  handlePassengerCodeError(e) {
    this.setPaused(true);
    console.log("Usercode error on update", e);
    this.dispatchEvent(new CustomEvent("usercode_error", { detail: e }));
  }

  initializeDisplays(worldElement) {
    if (!this.backend || !this.displayManager) return;

    const state = this.backend.getState();
    this.displayManager.initialize(state, worldElement);

    // Subscribe the display manager to backend events
    this.displayManager.subscribeToBackend(this.backend);

    // Set up passenger spawn forwarding for UI components
    this.backend.addEventListener(
      "passenger_spawned",
      (e) => {
        const display = this.passengers.get(e.detail.passenger.id);
        if (display) {
          this.dispatchEvent(
            new CustomEvent("new_passenger", { detail: display }),
          );
        }
      },
      { signal: this.abortController.signal },
    );
  }

  initializeChallenge(challengeOptions) {
    // Clean up previous world
    this.cleanup();

    // Set default options
    const defaultOptions = {
      floorHeight: 50,
      floorCount: 4,
      elevatorCount: 2,
      spawnRate: 0.5,
      renderingEnabled: true,
    };
    this.options = { ...defaultOptions, ...challengeOptions };
    this.floorHeight = this.options.floorHeight || 50;

    // Create simulation backend
    this.backend = new JSSimulationBackend();

    // Create display manager
    this.displayManager = new DisplayManager({
      renderingEnabled: this.options.renderingEnabled,
      floorHeight: this.floorHeight,
    });

    // Initialize simulation
    this.backend.initialize({
      floorCount: this.options.floorCount,
      elevatorCount: this.options.elevatorCount,
      elevatorCapacities: this.options.elevatorCapacities,
      spawnRate: this.options.spawnRate,
      speedFloorsPerSec: this.options.speedFloorsPerSec,
    });

    // Set up event forwarding
    this.setupEventForwarding();

    // Clear UI elements
    this.dom.clearElements(["world", "feedback"]);

    // Present world and stats (passing this as the "world" object)
    presentStats(this.dom.getElement("stats"), this);
    this.worldPresenter = presentWorld(this.dom.getElement("world"), this);
  }

  setupEventForwarding() {
    const { signal } = this.abortController;

    // Forward backend events
    this.backend.addEventListener(
      "stats_changed",
      (e) => {
        this.dispatchEvent(new CustomEvent("stats_display_changed"));
        this.dispatchEvent(new CustomEvent("stats_changed"));
      },
      { signal },
    );

    this.backend.addEventListener(
      "usercode_error",
      (e) => {
        this.dispatchEvent(
          new CustomEvent("usercode_error", { detail: e.detail }),
        );
      },
      { signal },
    );
  }

  async start(codeObj) {
    if (!this.backend) {
      throw new Error("World not created. Call initializeChallenge() first.");
    }

    // Check if runtime is still loading
    if (this.dom.isRuntimeLoading()) {
      console.log(APP_CONSTANTS.MESSAGES.RUNTIME_LOADING);
      return;
    }

    this.codeObj = codeObj;
    this.setPaused(false);
    this.animationFrameId = window.requestAnimationFrame(this.runFrame);
  }

  cleanup() {
    // Cancel any running animation frame
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // AbortController automatically removes all event listeners
    this.abortController.abort();

    // Clean up world presenter
    if (this.worldPresenter && this.worldPresenter.cleanup) {
      this.worldPresenter.cleanup();
      this.worldPresenter = null;
    }

    // Clean up backend and display manager
    if (this.backend) {
      this.backend.dispose();
      this.backend = null;
    }
    if (this.displayManager) {
      this.displayManager.cleanup();
      this.displayManager = null;
    }

    // Create new AbortController for future use
    this.abortController = new AbortController();
  }
}
