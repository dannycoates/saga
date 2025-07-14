import { WorldCreator, WorldController } from "./core/World.js";
import { challenges } from "./game/challenges.js";
import {
  presentStats,
  presentChallenge,
  presentFeedback,
  presentWorld,
  presentCodeStatus,
} from "./ui/presenters.js";
import { RuntimeManager } from "./runtimes/manager.js";
import { themeManager } from "./ui/theme-manager.js";
import { ThemeSwitcher } from "./ui/components/theme-switcher.js";
import { CodeEditor } from "./ui/CodeEditor.js";


// Main Application class
export class ElevatorApp extends EventTarget {
  constructor() {
    super();

    this.worldController = new WorldController(1.0 / 60.0);
    this.worldCreator = new WorldCreator();
    this.runtimeManager = new RuntimeManager();
    this.world = null;
    this.currentChallengeIndex = 0;

    // DOM elements
    this.worldElem = document.querySelector(".innerworld");
    this.statsElem = document.querySelector(".statscontainer");
    this.feedbackElem = document.querySelector(".feedbackcontainer");
    this.challengeElem = document.querySelector(".challenge");
    this.codestatusElem = document.querySelector(".codestatus");

    // Setup editor
    const codeArea = document.getElementById("code");
    this.editor = new CodeEditor(
      codeArea,
      "develevate_code",
      this.runtimeManager,
    );

    // Event handlers storage
    this.timescaleChangedHandler = null;
    this.statsChangedHandler = null;
    this.worldPresenter = null;

    this.setupEventHandlers();

    // Initialize theme switcher
    this.initializeThemeSwitcher();

    // Set the runtime manager to the editor's current language and check if it needs loading
    this.runtimeManager.currentLanguage = this.editor.currentLanguage;

    // Wait for initial runtime to load before starting the challenge
    this.initializeWithRuntime();
  }

  setupEventHandlers() {
    // Button handlers
    document.getElementById("button_reset").addEventListener("click", () => {
      if (
        confirm("Do you really want to reset to the default implementation?")
      ) {
        // Save current code as backup for current language
        localStorage.setItem(
          `develevateBackupCode_${this.editor.currentLanguage}`,
          this.editor.getCode(),
        );
        this.editor.reset();
      }
      this.editor.view.focus();
    });

    document
      .getElementById("button_resetundo")
      .addEventListener("click", () => {
        if (
          confirm(
            "Do you want to bring back the code as before the last reset?",
          )
        ) {
          // Load backup for current language
          const backupCode = localStorage.getItem(
            `develevateBackupCode_${this.editor.currentLanguage}`,
          );
          if (backupCode) {
            this.editor.setCode(backupCode);
          } else {
            alert("No backup found for current language");
          }
        }
        this.editor.view.focus();
      });

    const applyButton = document.getElementById("button_apply");
    if (applyButton) {
      applyButton.addEventListener("click", () => {
        this.editor.dispatchEvent(new CustomEvent("apply_code"));
      });
    }

    // Editor events
    this.editor.addEventListener("apply_code", () => {
      this.startChallenge(this.currentChallengeIndex, true);
    });

    this.editor.addEventListener("usercode_error", (e) => {
      presentCodeStatus(this.codestatusElem, e.detail);
    });

    // World controller error handling
    this.worldController.addEventListener("usercode_error", (e) => {
      this.editor.dispatchEvent(
        new CustomEvent("usercode_error", { detail: e.detail }),
      );
    });

    // Handle browser back/forward navigation
    window.addEventListener("hashchange", () => {
      this.loadFromUrl();
    });

    // Language selector
    const languageSelect = document.getElementById("language-select");
    languageSelect.value = this.editor.currentLanguage;
    languageSelect.addEventListener("change", async (e) => {
      const newLanguage = e.target.value;

      try {
        // Show loading state
        this.showRuntimeLoading(true, `Loading ${newLanguage} runtime...`);

        // Select the language in runtime manager
        await this.runtimeManager.selectLanguage(newLanguage);

        // Update editor language
        this.editor.setLanguage(newLanguage);

        // Clear status
        presentCodeStatus(this.codestatusElem);
      } catch (error) {
        presentCodeStatus(this.codestatusElem, error);
        // Revert language selector
        languageSelect.value = this.editor.currentLanguage;
      } finally {
        // Hide loading state
        this.showRuntimeLoading(false);
      }
    });
  }

  loadFromUrl() {
    const params = this.parseParams();

    this.currentChallengeIndex = Math.min(
      Math.max(0, (params.challenge | 0) - 1),
      challenges.length - 1,
    );

    const timeScale =
      parseFloat(localStorage.getItem("elevatorTimeScale")) ||
      parseFloat(params.timescale) ||
      2.0;
    this.worldController.setTimeScale(timeScale);

    // Start challenge - always start paused unless explicitly specified
    const shouldAutoStart = params.autostart === "true";
    this.startChallenge(this.currentChallengeIndex, shouldAutoStart);
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

  initializeThemeSwitcher() {
    // Initialize theme manager
    themeManager.watchSystemTheme();

    // Create and add theme switcher to header
    const themeSwitcher = new ThemeSwitcher(themeManager);
    const header = document.querySelector(".header");
    if (header) {
      header.appendChild(themeSwitcher.getElement());
    }
  }

  showRuntimeLoading(show, message = "Loading runtime...") {
    const loadingIndicator = document.getElementById("runtime-loading");
    const languageSelect = document.getElementById("language-select");

    if (show) {
      loadingIndicator.style.display = "inline-flex";
      // Update the loading text
      const loadingText = loadingIndicator.querySelector(".loading-text");
      if (loadingText) {
        loadingText.textContent = message;
      }
      languageSelect.disabled = true;
      this.setStartButtonEnabled(false);
    } else {
      loadingIndicator.style.display = "none";
      languageSelect.disabled = false;
      this.setStartButtonEnabled(true);
    }
  }

  async initializeWithRuntime() {
    // Load challenge and render world area immediately, before waiting for runtime
    this.loadFromUrl();

    // Load runtime in parallel - this won't block the world rendering
    const runtime = this.runtimeManager.getCurrentRuntime();
    if (!runtime.loaded) {
      // Show loading state
      this.showRuntimeLoading(
        true,
        `Loading ${this.editor.currentLanguage} runtime...`,
      );

      try {
        // Pre-load the runtime in the background
        await this.runtimeManager.selectLanguage(this.editor.currentLanguage);
        this.showRuntimeLoading(false);
      } catch (error) {
        console.error("Failed to load initial runtime:", error);
        this.showRuntimeLoading(false);
      }
    }
  }

  setStartButtonEnabled(enabled) {
    // Find all challenge-control elements and update their start buttons
    const challengeControls = document.querySelectorAll("challenge-control");
    challengeControls.forEach((control) => {
      const button = control.shadowRoot?.querySelector(".startstop");
      if (button) {
        button.disabled = !enabled;
        button.style.opacity = enabled ? "1" : "0.6";
        button.style.cursor = enabled ? "pointer" : "not-allowed";
      }
    });
  }

  startStopOrRestart() {
    if (this.worldController.isPaused) {
      // Start button clicked - start the challenge
      this.startChallenge(this.currentChallengeIndex, true);
    } else {
      // Stop button clicked - reset the game state
      this.worldController.setPaused(true);
      this.startChallenge(this.currentChallengeIndex, false);
    }
  }

  async startChallenge(challengeIndex, autoStart) {
    // Clean up previous event listeners
    if (this.timescaleChangedHandler) {
      this.worldController.removeEventListener(
        "timescale_changed",
        this.timescaleChangedHandler,
      );
      this.timescaleChangedHandler = null;
    }
    if (this.statsChangedHandler && this.world) {
      this.world.removeEventListener("stats_changed", this.statsChangedHandler);
      this.statsChangedHandler = null;
    }
    if (this.worldPresenter && this.worldPresenter.cleanup) {
      this.worldPresenter.cleanup();
      this.worldPresenter = null;
    }

    if (this.world) {
      this.world.unWind();
    }

    // Update challenge index and create world first
    this.currentChallengeIndex = challengeIndex;
    this.world = this.worldCreator.createWorld(
      challenges[challengeIndex].options,
    );

    // Clear and setup UI immediately - this allows rendering before runtime loads
    const clearElems = [this.worldElem, this.feedbackElem];
    clearElems.forEach((elem) => (elem.innerHTML = ""));

    presentStats(this.statsElem, this.world);
    this.challengePresenter = presentChallenge(
      this.challengeElem,
      challenges[challengeIndex],
      this,
      this.worldController,
      challengeIndex + 1,
    );
    this.worldPresenter = presentWorld(this.worldElem, this.world);

    // Setup timescale change handler
    this.timescaleChangedHandler = () => {
      localStorage.setItem("elevatorTimeScale", this.worldController.timeScale);
      // The challenge control component will update automatically via its worldController property
    };
    this.worldController.addEventListener(
      "timescale_changed",
      this.timescaleChangedHandler,
    );

    // Setup challenge completion handler
    this.statsChangedHandler = () => {
      const challengeStatus = challenges[challengeIndex].condition.evaluate(
        this.world,
      );
      if (challengeStatus !== null) {
        this.world.challengeEnded = true;
        this.worldController.setPaused(true);

        if (challengeStatus) {
          presentFeedback(
            this.feedbackElem,
            "Success!",
            "Challenge completed",
            this.createParamsUrl({ challenge: challengeIndex + 2 }),
          );
        } else {
          presentFeedback(
            this.feedbackElem,
            "Challenge failed",
            "Maybe your program needs an improvement?",
            "",
          );
        }
      }
    };
    this.world.addEventListener("stats_changed", this.statsChangedHandler);

    // Only proceed with runtime-dependent operations if we're auto-starting
    if (autoStart) {
      // Check if runtime is still loading
      const loadingIndicator = document.getElementById("runtime-loading");
      if (loadingIndicator && loadingIndicator.style.display !== "none") {
        console.log("Runtime is still loading, please wait...");
        return;
      }

      const codeObj = await this.editor.getCodeObj(this);
      if (codeObj) {
        this.worldController.start(
          this.world,
          codeObj,
          window.requestAnimationFrame,
          autoStart,
        );
      }
    }
    // If not auto-starting, just render the world and wait for user to click start
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
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.app = new ElevatorApp();
  });
} else {
  window.app = new ElevatorApp();
}
