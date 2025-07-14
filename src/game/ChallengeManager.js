import { challenges } from "./challenges.js";
import { presentChallenge, presentFeedback } from "../ui/presenters.js";
import { APP_CONSTANTS } from "../config/constants.js";

export class ChallengeManager {
  constructor(dom, worldManager, urlManager) {
    this.dom = dom;
    this.worldManager = worldManager;
    this.urlManager = urlManager;
    this.currentChallengeIndex = 0;
    this.challengePresenter = null;
    this.statsChangedHandler = null;
  }

  getCurrentChallengeIndex() {
    return this.currentChallengeIndex;
  }

  setCurrentChallengeIndex(index) {
    this.currentChallengeIndex = index;
  }

  async startChallenge(challengeIndex, autoStart, editor, app) {
    // Update current challenge
    this.currentChallengeIndex = challengeIndex;

    // Create world for this challenge
    const world = this.worldManager.createWorld(
      challenges[challengeIndex].options,
    );

    // Present challenge UI
    this.challengePresenter = presentChallenge(
      this.dom.getElement("challenge"),
      challenges[challengeIndex],
      app,
      this.worldManager.worldController,
      challengeIndex + 1,
    );

    // Setup challenge completion handler
    this.setupChallengeCompletionHandler(world, challengeIndex);

    // Start world if auto-starting
    if (autoStart) {
      await this.worldManager.startWorld(editor, app, autoStart);
    }
  }

  setupChallengeCompletionHandler(world, challengeIndex) {
    // Clean up previous handler
    if (this.statsChangedHandler && world) {
      const previousWorld = this.worldManager.world;
      if (previousWorld && previousWorld !== world) {
        previousWorld.removeEventListener(
          "stats_changed",
          this.statsChangedHandler,
        );
      }
    }

    // Setup new handler
    this.statsChangedHandler = () => {
      const challengeStatus =
        challenges[challengeIndex].condition.evaluate(world);

      if (challengeStatus !== null) {
        world.challengeEnded = true;
        this.worldManager.worldController.setPaused(true);

        if (challengeStatus) {
          // Challenge succeeded
          presentFeedback(
            this.dom.getElement("feedback"),
            APP_CONSTANTS.MESSAGES.SUCCESS_TITLE,
            APP_CONSTANTS.MESSAGES.SUCCESS_MESSAGE,
            this.urlManager.createParamsUrl({ challenge: challengeIndex + 2 }),
          );
        } else {
          // Challenge failed
          presentFeedback(
            this.dom.getElement("feedback"),
            APP_CONSTANTS.MESSAGES.FAILURE_TITLE,
            APP_CONSTANTS.MESSAGES.FAILURE_MESSAGE,
            "",
          );
        }
      }
    };

    world.addEventListener("stats_changed", this.statsChangedHandler);
  }

  getChallenge(index) {
    return challenges[index];
  }

  getTotalChallenges() {
    return challenges.length;
  }

  cleanup() {
    // Clean up challenge completion handler
    if (this.statsChangedHandler) {
      const world = this.worldManager.world;
      if (world) {
        world.removeEventListener("stats_changed", this.statsChangedHandler);
      }
      this.statsChangedHandler = null;
    }

    // Clean up challenge presenter
    if (this.challengePresenter) {
      // Challenge presenter cleanup if needed
      this.challengePresenter = null;
    }
  }
}
