import { challenges } from "./challenges.js";
import { presentChallenge, presentFeedback } from "../ui/presenters.js";
import { APP_CONSTANTS } from "../config/constants.js";

export class ChallengeManager {
  constructor(dom, worldManager, urlManager) {
    this.dom = dom;
    this.worldManager = worldManager;
    this.urlManager = urlManager;
    this.currentChallengeIndex = 0;
    this.statsChangedHandler = null;
  }

  getCurrentChallengeIndex() {
    return this.currentChallengeIndex;
  }

  showChallenge(challengeIndex, app) {
    // Update current challenge
    this.currentChallengeIndex = challengeIndex;

    this.worldManager.initializeChallenge(challenges[challengeIndex].options);

    // Present challenge UI
    presentChallenge(
      this.dom.getElement("challenge"),
      challenges[challengeIndex],
      app,
      this.worldManager,
      challengeIndex + 1,
    );

    // Setup challenge completion handler
    this.setupChallengeCompletionHandler(this.worldManager, challengeIndex);
  }

  setupChallengeCompletionHandler(world, challengeIndex) {
    // Clean up previous handler
    if (this.statsChangedHandler) {
      // Remove from worldManager since that's where the events come from now
      this.worldManager.removeEventListener(
        "stats_changed",
        this.statsChangedHandler,
      );
    }

    // Setup new handler
    this.statsChangedHandler = () => {
      const challengeStatus = challenges[challengeIndex].condition.evaluate(
        world.stats,
      );

      if (challengeStatus !== null) {
        this.worldManager.end();

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

    this.worldManager.addEventListener(
      "stats_changed",
      this.statsChangedHandler,
    );
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
      this.worldManager.removeEventListener(
        "stats_changed",
        this.statsChangedHandler,
      );
      this.statsChangedHandler = null;
    }
  }
}
