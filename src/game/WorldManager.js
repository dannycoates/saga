import { JSSimulationBackend } from "../core/JSSimulationBackend.js";
import { DisplayManager } from "../ui/DisplayManager.js";
import {
  presentPassenger,
  presentStats,
  presentWorld,
} from "../ui/presenters.js";
import { APP_CONSTANTS } from "../config/constants.js";

/**
 * WorldManager that directly manages simulation backend and display manager
 */
export class WorldManager extends EventTarget {
  constructor(dom) {
    super();
    this.dom = dom;
    this.backend = null;
    this.displayManager = null;
    this.challenge = null;

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
      if (!this.isPaused && this.lastT !== null) {
        const backend = this.backend;
        const dt = t - this.lastT;
        let scaledDt = dt * 0.001 * this.timeScale;
        scaledDt = Math.min(scaledDt, this.dtMax * 3 * this.timeScale);
        await backend.callUserCode(this.codeObj, dt);
        while (scaledDt > 0.0) {
          const thisDt = Math.min(this.dtMax, scaledDt);
          backend.tick(thisDt);
          scaledDt -= this.dtMax;
        }
      }
      this.lastT = t;
      if (this.animationFrameId) {
        this.animationFrameId = window.requestAnimationFrame(this.runFrame);
      }
    };
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

  end() {
    this.setPaused(true);
    this.initializeChallenge(this.challenge, false);
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

  initializeChallenge(challenge, clearStats = true) {
    // Clean up previous world
    this.cleanup();

    this.challenge = challenge;
    // Set default options
    const defaultOptions = {
      floorHeight: 50,
      spawnRate: 0.5,
      renderingEnabled: true,
    };
    const challengeOptions = challenge.options;
    const options = { ...defaultOptions, ...challengeOptions };

    // Create simulation backend
    this.backend = new JSSimulationBackend();

    // Create display manager
    this.displayManager = new DisplayManager({
      renderingEnabled: options.renderingEnabled,
      floorHeight: options.floorHeight,
    });

    // Initialize simulation
    this.backend.initialize({
      floorCount: options.floorCount,
      elevatorCount: options.elevatorCount,
      elevatorCapacities: options.elevatorCapacities,
      spawnRate: options.spawnRate,
      speedFloorsPerSec: options.speedFloorsPerSec,
      endCondition: challenge.condition,
    });

    // Initialize displays with the world element
    this.displayManager.initialize(this.backend.getState());

    // Subscribe the display manager to backend events
    this.displayManager.subscribeToBackend(this.backend);

    // Set up event forwarding
    this.setupEventHandlers();

    // Present world and stats (passing this as the "world" object)
    if (clearStats) {
      presentStats(this.dom.getElement("stats"), this);
    }
    presentWorld(this.dom.getElement("world"), this.displayManager);
  }

  setupEventHandlers() {
    const { signal } = this.abortController;

    // Forward backend events
    this.backend.addEventListener(
      "stats_changed",
      () => {
        this.dispatchEvent(new CustomEvent("stats_changed"));
      },
      { signal },
    );

    this.backend.addEventListener(
      "challenge_ended",
      (e) => {
        this.end();
        this.dispatchEvent(
          new CustomEvent("challenge_ended", { detail: e.detail }),
        );
      },
      { signal },
    );

    this.backend.addEventListener(
      "passenger_spawned",
      (e) => {
        presentPassenger(
          this.dom.getElement("world"),
          this.displayManager.passengerDisplays.get(e.detail.passenger.id),
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
    presentStats(this.dom.getElement("stats"), this);
    this.codeObj = codeObj;
    await this.codeObj.start();
    this.setPaused(false);
    this.animationFrameId = window.requestAnimationFrame(this.runFrame);
  }

  cleanup() {
    // Cancel any running animation frame
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastT = null;
    this.dom.clearElements("world");

    // AbortController automatically removes all event listeners
    this.abortController.abort();

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
