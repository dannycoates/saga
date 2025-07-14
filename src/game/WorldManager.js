import { WorldCreator, WorldController } from "../core/World.js";
import { presentStats, presentWorld } from "../ui/presenters.js";
import { APP_CONSTANTS } from "../config/constants.js";

export class WorldManager {
  constructor(dom) {
    this.dom = dom;
    this.worldController = new WorldController(APP_CONSTANTS.FRAME_RATE);
    this.worldCreator = new WorldCreator();
    this.world = null;
    this.worldPresenter = null;
    this.abortController = new AbortController();
    
    // Event handlers
    this.timescaleChangedHandler = null;
  }

  getWorldController() {
    return this.worldController;
  }

  getCurrentWorld() {
    return this.world;
  }

  setTimeScale(timeScale) {
    this.worldController.setTimeScale(timeScale);
  }

  createWorld(challengeOptions) {
    // Clean up previous world
    this.cleanup();

    // Create new world
    this.world = this.worldCreator.createWorld(challengeOptions);

    // Clear UI elements
    this.dom.clearElements(['world', 'feedback']);

    // Present world and stats
    presentStats(this.dom.getElement('stats'), this.world);
    this.worldPresenter = presentWorld(this.dom.getElement('world'), this.world);

    // Setup timescale change handler
    this.setupTimescaleHandler();

    return this.world;
  }

  setupTimescaleHandler() {
    const { signal } = this.abortController;
    this.timescaleChangedHandler = () => {
      localStorage.setItem(APP_CONSTANTS.TIME_SCALE_KEY, this.worldController.timeScale);
      // The challenge control component will update automatically via its worldController property
    };
    this.worldController.addEventListener(
      "timescale_changed",
      this.timescaleChangedHandler,
      { signal }
    );
  }

  async startWorld(editor, app, autoStart) {
    if (!this.world) {
      throw new Error("World not created. Call createWorld() first.");
    }

    // Check if runtime is still loading
    if (this.dom.isRuntimeLoading()) {
      console.log(APP_CONSTANTS.MESSAGES.RUNTIME_LOADING);
      return;
    }

    const codeObj = await editor.getCodeObj(app);
    if (codeObj) {
      this.worldController.start(
        this.world,
        codeObj,
        window.requestAnimationFrame,
        autoStart,
      );
    }
  }

  startStopOrRestart(app) {
    if (this.worldController.isPaused) {
      // Start button clicked - start the challenge
      app.startChallenge(app.getCurrentChallengeIndex(), true);
    } else {
      // Stop button clicked - reset the game state
      this.worldController.setPaused(true);
      app.startChallenge(app.getCurrentChallengeIndex(), false);
    }
  }

  cleanup() {
    // AbortController automatically removes all event listeners
    this.abortController.abort();
    
    // Clean up event handlers for memory cleanup
    this.timescaleChangedHandler = null;

    // Clean up world presenter
    if (this.worldPresenter && this.worldPresenter.cleanup) {
      this.worldPresenter.cleanup();
      this.worldPresenter = null;
    }

    // Clean up world
    if (this.world) {
      this.world.unWind();
    }
    
    // Create new AbortController for future use
    this.abortController = new AbortController();
  }
}