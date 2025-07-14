import { challenges } from "../game/challenges.js";
import { APP_CONSTANTS } from "../config/constants.js";

export class URLManager {
  constructor(app) {
    this.app = app;
    this.setupHashChangeListener();
  }

  setupHashChangeListener() {
    this.boundLoadFromUrl = () => this.loadFromUrl();
    window.addEventListener("hashchange", this.boundLoadFromUrl);
  }

  parseParams() {
    const params = {};
    const hashParams = window.location.hash.replace(/^#/, "").split(",");

    hashParams.forEach((p) => {
      const [key, val] = p.split("=");
      params[key] = val;
    });

    return params;
  }

  createParamsUrl(overrides) {
    const current = this.parseParams();
    const merged = { ...current, ...overrides };

    return (
      "#" +
      Object.entries(merged)
        .filter(([key, val]) => key != null && val != null)
        .map(([key, val]) => `${key}=${val}`)
        .join(",")
    );
  }

  loadFromUrl() {
    const params = this.parseParams();

    // Parse challenge index
    const challengeIndex = Math.min(
      Math.max(0, (params.challenge | 0) - 1),
      challenges.length - 1,
    );

    // Parse time scale
    const timeScale =
      parseFloat(localStorage.getItem(APP_CONSTANTS.TIME_SCALE_KEY)) ||
      parseFloat(params.timescale) ||
      APP_CONSTANTS.DEFAULT_TIME_SCALE;

    // Parse auto-start flag
    const shouldAutoStart = params.autostart === "true";

    // Apply settings and start challenge
    this.app.setCurrentChallengeIndex(challengeIndex);
    this.app.setTimeScale(timeScale);
    this.app.startChallenge(challengeIndex, shouldAutoStart);
  }

  cleanup() {
    // Remove event listeners if needed
    if (this.boundLoadFromUrl) {
      window.removeEventListener("hashchange", this.boundLoadFromUrl);
    }
  }
}