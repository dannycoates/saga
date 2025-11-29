import { JSSimulationBackend } from "../core/JSSimulationBackend.js";
import { APP_CONSTANTS } from "../config/constants.js";

/**
 * @typedef {import('../ui/DisplayManager.js').DisplayManager} DisplayManager
 * @typedef {import('../ui/DisplayManager.js').DisplayManagerOptions} DisplayManagerOptions
 */

/**
 * @typedef {Object} DisplayManagerClass
 * @property {(options?: DisplayManagerOptions) => DisplayManager} create - Factory method
 */

/**
 * @typedef {Object} Challenge
 * @property {ChallengeOptions} options - Challenge configuration
 * @property {ChallengeCondition} condition - Win/lose condition
 * @property {number} [id] - Challenge index (added at runtime)
 */

/**
 * @typedef {Object} ChallengeOptions
 * @property {number} [floorCount] - Number of floors
 * @property {number} [elevatorCount] - Number of elevators
 * @property {number} [spawnRate] - Passenger spawn rate per second
 * @property {number[]} [elevatorCapacities] - Capacity for each elevator
 * @property {number} [speedFloorsPerSec] - Elevator speed
 * @property {number} [floorHeight] - Floor height in pixels
 * @property {boolean} [isRenderingEnabled] - Whether to render visuals
 */

/**
 * @typedef {Object} ChallengeCondition
 * @property {string} description - Human-readable condition description (HTML)
 * @property {(stats: import('../core/SimulationBackend.js').SimulationStats) => boolean | null} evaluate - Returns true (win), false (lose), or null (in progress)
 */

/**
 * Main game orchestrator that manages simulation backend and display.
 * Handles game loop, challenge lifecycle, and event forwarding.
 *
 * @extends EventTarget
 *
 * @fires WorldManager#stats_changed - Forwarded from backend when stats update
 * @fires WorldManager#challenge_ended - Forwarded from backend when challenge ends
 * @fires WorldManager#timescale_changed - Emitted when time scale or pause state changes
 */
export class WorldManager extends EventTarget {
  /**
   * Creates a new WorldManager instance.
   * @param {DisplayManagerClass} DisplayManagerClass - Class with static create() method for creating display managers.
   */
  constructor(DisplayManagerClass) {
    super();
    /** @type {DisplayManagerClass} Class for creating display managers */
    this.DisplayManagerClass = DisplayManagerClass;
    /** @type {JSSimulationBackend | null} */
    this.backend = null;
    /** @type {DisplayManager} */
    this.displayManager = DisplayManagerClass.create();
    /** @type {Challenge | null} */
    this.challenge = null;

    // Event handling
    /** @type {AbortController} */
    this.abortController = new AbortController();

    // World controller properties
    /** @type {number} Maximum time delta per physics step */
    this.dtMax = APP_CONSTANTS.FRAME_RATE;
    /** @type {number} Simulation speed multiplier */
    this.timeScale = 1.0;
    /** @type {boolean} Whether simulation is paused */
    this.isPaused = true;

    // Animation frame tracking
    /** @type {number | null} Current animation frame ID */
    this.animationFrameId = null;
    /** @type {import('../core/SimulationBackend.js').UserCodeObject | null} */
    this.codeObj = null;
    /** @type {number | null} Last tick timestamp */
    this.lastTickTime = null;

    /**
     * Animation frame callback. Updates simulation state each frame.
     * @param {number} t - Current timestamp from requestAnimationFrame
     * @returns {Promise<void>}
     */
    this.runFrame = async (t) => {
      if (!this.isPaused && this.lastTickTime !== null) {
        const backend = this.backend;
        const dt = t - this.lastTickTime;
        let scaledDt = dt * 0.001 * this.timeScale;
        scaledDt = Math.min(scaledDt, this.dtMax * 3 * this.timeScale);
        // This await is a little bit perilous since runFrame can't be awaited.
        // `this.anything` after the await MAY HAVE CHANGED in the meantime,
        // which is why we capture backend.
        await backend?.callUserCode(this.codeObj, dt);
        while (scaledDt > 0.0) {
          const thisDt = Math.min(this.dtMax, scaledDt);
          backend?.tick(thisDt);
          scaledDt -= this.dtMax;
        }
      }
      this.lastTickTime = t;
      // this.animationFrameId will be null when the sim ends or is stopped.
      // It's our signal to stop the loop.
      if (this.animationFrameId) {
        this.animationFrameId = window.requestAnimationFrame(this.runFrame);
      }
    };
  }

  /**
   * Current simulation statistics.
   * @type {import('../core/SimulationBackend.js').SimulationStats}
   * @readonly
   */
  get stats() {
    return this.backend
      ? this.backend.getStats()
      : {
          transportedCount: 0,
          transportedPerSec: 0,
          avgWaitTime: 0,
          maxWaitTime: 0,
          moveCount: 0,
          elapsedTime: 0,
        };
  }

  /**
   * Stops the current simulation and reinitializes the challenge.
   * @returns {void}
   */
  end() {
    this.setPaused(true);
    this.initializeChallenge(this.challenge, false);
  }

  /**
   * Sets the simulation time scale (speed multiplier).
   * Persists to localStorage and emits timescale_changed event.
   * @param {number} timeScale - Speed multiplier (1.0 = normal speed)
   * @returns {void}
   */
  setTimeScale(timeScale) {
    this.timeScale = timeScale;
    this.dispatchEvent(new CustomEvent("timescale_changed"));
    localStorage.setItem(APP_CONSTANTS.TIME_SCALE_KEY, String(this.timeScale));
  }

  /**
   * Sets the pause state and emits timescale_changed event.
   * @param {boolean} paused - Whether to pause the simulation
   * @returns {void}
   */
  setPaused(paused) {
    this.isPaused = paused;
    this.dispatchEvent(new CustomEvent("timescale_changed"));
  }

  /**
   * Initializes or reinitializes a challenge.
   * Creates backend, display manager, and sets up event handlers.
   * @param {Challenge | null} challenge - Challenge configuration
   * @param {boolean} [clearStats=true] - Whether to clear statistics display
   * @returns {void}
   */
  initializeChallenge(challenge, clearStats = true) {
    // Clean up previous world
    this.cleanup();

    this.challenge = challenge;
    // Set default options
    const defaultOptions = {
      floorHeight: 50,
      spawnRate: 0.5,
      isRenderingEnabled: true,
    };
    const challengeOptions = challenge?.options ?? {};
    const options = { ...defaultOptions, ...challengeOptions };

    // Create simulation backend
    this.backend = new JSSimulationBackend();

    // Create display manager using class factory
    this.displayManager = this.DisplayManagerClass.create({
      isRenderingEnabled: options.isRenderingEnabled,
      floorHeight: options.floorHeight,
    });

    // Initialize simulation
    this.backend.initialize({
      floorCount: options.floorCount ?? 3,
      elevatorCount: options.elevatorCount ?? 1,
      elevatorCapacities: options.elevatorCapacities ?? [4],
      spawnRate: options.spawnRate,
      speedFloorsPerSec: options.speedFloorsPerSec ?? 2.6,
      endCondition: challenge?.condition ?? { evaluate: () => null },
    });

    // Initialize displays with the world element
    this.displayManager.initialize(this.backend.getState());
    this.displayManager.subscribeToBackend(this.backend);

    // Set up event forwarding
    this.setupEventHandlers();

    // Emit event for UI layer to handle presentation
    this.dispatchEvent(new CustomEvent("challenge_initialized", { detail: { clearStats } }));
  }

  /**
   * Sets up event handlers to forward backend events.
   * @private
   * @returns {void}
   */
  setupEventHandlers() {
    const { signal } = this.abortController;

    // Forward backend events
    this.backend?.addEventListener(
      "stats_changed",
      (e) => {
        this.dispatchEvent(
          new CustomEvent("stats_changed", { detail: /** @type {CustomEvent} */ (e).detail }),
        );
      },
      { signal },
    );

    this.backend?.addEventListener(
      "challenge_ended",
      (e) => {
        this.end();
        this.dispatchEvent(
          new CustomEvent("challenge_ended", { detail: /** @type {CustomEvent} */ (e).detail }),
        );
      },
      { signal },
    );

    this.backend?.addEventListener(
      "passenger_spawned",
      (e) => {
        this.dispatchEvent(
          new CustomEvent("passenger_spawned", { detail: /** @type {CustomEvent} */ (e).detail }),
        );
      },
      { signal },
    );
  }

  /**
   * Starts the simulation with user code.
   * @param {import('../core/SimulationBackend.js').UserCodeObject} codeObj - User code object
   * @returns {Promise<void>}
   * @throws {Error} If initializeChallenge() hasn't been called
   */
  async start(codeObj) {
    if (!this.backend) {
      throw new Error("World not created. Call initializeChallenge() first.");
    }

    this.dispatchEvent(new CustomEvent("simulation_started"));
    this.codeObj = codeObj;
    await this.codeObj.start?.();
    this.setPaused(false);
    this.animationFrameId = window.requestAnimationFrame(this.runFrame);
  }

  /**
   * Cleans up all resources and event listeners.
   * @returns {void}
   */
  cleanup() {
    // Cancel any running animation frame
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastTickTime = null;

    // AbortController automatically removes all event listeners
    this.abortController.abort();

    if (this.backend) {
      this.backend.cleanup();
      this.backend = null;
    }
    this.displayManager.cleanup();

    // Emit cleanup event for UI layer
    this.dispatchEvent(new CustomEvent("cleanup"));

    // Create new AbortController for future use
    this.abortController = new AbortController();
  }
}
