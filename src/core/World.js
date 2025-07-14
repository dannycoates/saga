import { JSSimulationBackend } from "./JSSimulationBackend.js";
import { DisplayManager } from "../ui/DisplayManager.js";

/**
 * World class that uses modern architecture
 * This maintains the same public API but uses SimulationBackend and DisplayManager internally
 */
export class World extends EventTarget {
  constructor(options) {
    super();
    const defaultOptions = {
      floorHeight: 50,
      floorCount: 4,
      elevatorCount: 2,
      spawnRate: 0.5,
      renderingEnabled: true,
    };
    options = { ...defaultOptions, ...options };
    this.options = options;
    this.floorHeight = options.floorHeight || 50;

    // Create AbortController for event handling
    this.abortController = new AbortController();

    // Create simulation backend
    this.backend = new JSSimulationBackend();

    // Create display manager
    this.displayManager = new DisplayManager({
      renderingEnabled: options.renderingEnabled,
      floorHeight: this.floorHeight,
    });

    // Initialize simulation
    this.backend.initialize({
      floorCount: options.floorCount,
      elevatorCount: options.elevatorCount,
      elevatorCapacities: options.elevatorCapacities,
      spawnRate: options.spawnRate,
      speedFloorsPerSec: options.speedFloorsPerSec,
    });

    // Get initial state
    // const initialState = this.backend.getState();

    // Subscribe display manager to backend events (will be done in initializeDisplays)
    // this.displayManager.subscribeToBackend(this.backend);

    // Forward backend events
    this.backend.addEventListener("stats_changed", (e) => {
      this.dispatchEvent(new CustomEvent("stats_display_changed"));
      this.dispatchEvent(new CustomEvent("stats_changed"));
    }, { signal: this.abortController.signal });

    this.backend.addEventListener("usercode_error", (e) => {
      this.dispatchEvent(
        new CustomEvent("usercode_error", { detail: e.detail }),
      );
    }, { signal: this.abortController.signal });

    // We'll set up passenger spawn forwarding after initializeDisplays is called

    // Expose displays for compatibility
    const displays = this.displayManager.getDisplays();
    this.floors = displays.floors;
    this.elevators = displays.elevators;
    this.passengers = displays.passengers;
  }

  // Compatibility properties
  get transportedCounter() {
    const stats = this.backend.getStats();
    return stats.transportedCounter;
  }

  get transportedPerSec() {
    const stats = this.backend.getStats();
    return stats.transportedPerSec;
  }

  get moveCount() {
    const stats = this.backend.getStats();
    return stats.moveCount;
  }

  get elapsedTime() {
    const stats = this.backend.getStats();
    return stats.elapsedTime;
  }

  get maxWaitTime() {
    const stats = this.backend.getStats();
    return stats.maxWaitTime;
  }

  get avgWaitTime() {
    const stats = this.backend.getStats();
    return stats.avgWaitTime;
  }

  get challengeEnded() {
    return this.backend.hasEnded();
  }

  set challengeEnded(value) {
    if (value) {
      this.unWind();
    }
  }

  tick(dt) {
    this.backend.tick(dt);
  }

  async callUserCode(codeObj) {
    await this.backend.callUserCode(codeObj);
  }

  unWind() {
    // Abort all event listeners
    this.abortController.abort();
    
    // Clean up backend and display manager
    this.backend.dispose();
    this.displayManager.cleanup();
    
    // Create new AbortController for potential reuse
    this.abortController = new AbortController();
  }

  // Initialize displays with world element
  initializeDisplays(worldElement) {
    const state = this.backend.getState();
    this.displayManager.initialize(state, worldElement);

    // Subscribe the display manager to backend events
    this.displayManager.subscribeToBackend(this.backend);

    // Update display references
    const displays = this.displayManager.getDisplays();
    this.floors = displays.floors;
    this.elevators = displays.elevators;
    this.passengers = displays.passengers;

    // Set up passenger spawn forwarding for UI components
    this.backend.addEventListener("passenger_spawned", (e) => {
      // The DisplayManager will have already created the display
      setTimeout(() => {
        const display = this.displayManager.passengerDisplays.get(
          e.detail.passenger.id,
        );
        if (display) {
          this.dispatchEvent(
            new CustomEvent("new_passenger", { detail: display }),
          );
        }
      }, 0);
    }, { signal: this.abortController.signal });
  }
}

/**
 * WorldController now works with the backend's user code execution
 */
export class WorldController extends EventTarget {
  constructor(dtMax = 1 / 60) {
    super();
    this.dtMax = dtMax;
    this.timeScale = 1.0;
    this.isPaused = true;
  }

  start(world, codeObj, animationFrameRequester, autoStart) {
    this.isPaused = true;
    let lastT = null;

    world.addEventListener("usercode_error", (e) =>
      this.handlePassengerCodeError(e.detail),
    );

    const updater = async (t) => {
      if (!this.isPaused && !world.challengeEnded && lastT !== null) {
        const dt = t - lastT;
        let scaledDt = dt * 0.001 * this.timeScale;
        scaledDt = Math.min(scaledDt, this.dtMax * 3 * this.timeScale);

        try {
          await world.callUserCode(codeObj);
        } catch (e) {
          this.handlePassengerCodeError(e);
        }

        while (scaledDt > 0.0 && !world.challengeEnded) {
          const thisDt = Math.min(this.dtMax, scaledDt);
          world.tick(thisDt);
          scaledDt -= this.dtMax;
        }
      }
      lastT = t;
      if (!world.challengeEnded) {
        animationFrameRequester(updater);
      }
    };

    if (autoStart) {
      this.setPaused(false);
    }
    animationFrameRequester(updater);
  }

  handlePassengerCodeError(e) {
    this.setPaused(true);
    console.log("Usercode error on update", e);
    this.dispatchEvent(new CustomEvent("usercode_error", { detail: e }));
  }

  setPaused(paused) {
    this.isPaused = paused;
    this.dispatchEvent(new CustomEvent("timescale_changed"));
  }

  setTimeScale(timeScale) {
    this.timeScale = timeScale;
    this.dispatchEvent(new CustomEvent("timescale_changed"));
  }
}
