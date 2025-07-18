import { challenges } from "../game/challenges.js";
import { APP_CONSTANTS } from "../config/constants.js";

export class URLManager {
  constructor(app) {
    this.app = app;
    this.abortController = new AbortController();
    this.setupHashChangeListener();
  }

  setupHashChangeListener() {
    const { signal } = this.abortController;
    this.boundLoadFromUrl = () => this.loadFromUrl();
    window.addEventListener("hashchange", this.boundLoadFromUrl, { signal });
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

    // Apply settings and start challenge
    this.app.loadChallenge(challengeIndex);
    this.app.setTimeScale(timeScale);
  }

  cleanup() {
    // AbortController automatically removes all event listeners
    this.abortController.abort();

    // Clear bound handlers for memory cleanup
    this.boundLoadFromUrl = null;
  }
}
