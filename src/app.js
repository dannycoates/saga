import { Observable, getCodeObjFromCode, throttle } from "./core/utils.js";
import { createWorldCreator, createWorldController } from "./core/World.js";
import { challenges } from "./game/challenges.js";
import { fitnessSuite } from "./game/fitness.js";
import {
  presentStats,
  presentChallenge,
  presentFeedback,
  presentWorld,
  presentCodeStatus,
  makeDemoFullscreen,
  clearAll,
} from "./ui/presenters.js";
import { basicSetup, EditorView } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

// CodeMirror editor wrapper
class CodeEditor extends Observable {
  constructor(element, storageKey) {
    super();
    this.storageKey = storageKey;

    const defaultCode = document
      .getElementById("default-elev-implementation")
      .textContent.trim();
    const existingCode = localStorage.getItem(storageKey) || defaultCode;

    this.view = new EditorView({
      doc: existingCode,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.autoSave();
          }
        }),
      ],
      parent: element,
    });

    this.autoSave = throttle(() => this.saveCode(), 1000);
  }

  reset() {
    const defaultCode = document
      .getElementById("default-elev-implementation")
      .textContent.trim();
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: defaultCode },
    });
  }

  saveCode() {
    localStorage.setItem(this.storageKey, this.getCode());
    document.getElementById("save_message").textContent =
      "Code saved " + new Date().toTimeString();
    this.trigger("change");
  }

  getCode() {
    return this.view.state.doc.toString();
  }

  setCode(code) {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: code },
    });
  }

  async getCodeObj() {
    console.log("Getting code...");
    const code = this.getCode();
    try {
      const obj = await getCodeObjFromCode(code);
      this.trigger("code_success");
      return obj;
    } catch (e) {
      this.trigger("usercode_error", e);
      return null;
    }
  }

  setDevTestCode() {
    const devCode = document
      .getElementById("devtest-elev-implementation")
      .textContent.trim();
    this.setCode(devCode);
  }
}

// Main Application class
export class ElevatorApp extends Observable {
  constructor() {
    super();

    this.worldController = createWorldController(1.0 / 60.0);
    this.worldCreator = createWorldCreator();
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
    this.editor = new CodeEditor(codeArea, "develevate_code");

    this.setupEventHandlers();
    this.loadFromUrl();
  }

  setupEventHandlers() {
    // Button handlers
    document.getElementById("button_reset").addEventListener("click", () => {
      if (
        confirm("Do you really want to reset to the default implementation?")
      ) {
        localStorage.setItem("develevateBackupCode", this.editor.getCode());
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
          this.editor.setCode(
            localStorage.getItem("develevateBackupCode") || "",
          );
        }
        this.editor.view.focus();
      });

    const applyButton = document.getElementById("button_apply");
    if (applyButton) {
      applyButton.addEventListener("click", () => {
        this.editor.trigger("apply_code");
      });
    }

    // Editor events
    this.editor.on("apply_code", () => {
      this.startChallenge(this.currentChallengeIndex, true);
    });

    this.editor.on("code_success", () => {
      presentCodeStatus(this.codestatusElem, null);
    });

    this.editor.on("usercode_error", (error) => {
      presentCodeStatus(this.codestatusElem, null, error);
    });

    // World controller error handling
    this.worldController.on("usercode_error", (error) => {
      this.editor.trigger("usercode_error", error);
    });

    // Handle browser back/forward navigation
    window.addEventListener("hashchange", () => {
      this.loadFromUrl();
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

    // Check for special modes
    if (params.devtest) {
      this.editor.setDevTestCode();
    }
    if (params.fullscreen) {
      makeDemoFullscreen();
    }

    // Start challenge - always start paused unless explicitly specified
    const shouldAutoStart = params.autostart === 'true';
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
    if (this.world) {
      this.world.unWind();
    }

    this.currentChallengeIndex = challengeIndex;
    this.world = this.worldCreator.createWorld(
      challenges[challengeIndex].options,
    );
    window.world = this.world; // For debugging

    // Clear and setup UI
    const clearElems = [this.worldElem, this.feedbackElem];
    clearElems.forEach((elem) => (elem.innerHTML = ""));

    presentStats(this.statsElem, this.world);
    this.challengePresenter = presentChallenge(
      this.challengeElem,
      challenges[challengeIndex],
      this,
      this.world,
      this.worldController,
      challengeIndex + 1,
      null,
    );
    presentWorld(this.worldElem, this.world, null, null, null, null);

    // Setup timescale change handler
    this.worldController.on("timescale_changed", () => {
      localStorage.setItem("elevatorTimeScale", this.worldController.timeScale);
      // The challenge control component will update automatically via its worldController property
    });

    // Setup challenge completion handler
    this.world.on("stats_changed", () => {
      const challengeStatus = challenges[challengeIndex].condition.evaluate(
        this.world,
      );
      if (challengeStatus !== null) {
        this.world.challengeEnded = true;
        this.worldController.setPaused(true);

        if (challengeStatus) {
          presentFeedback(
            this.feedbackElem,
            null,
            this.world,
            "Success!",
            "Challenge completed",
            this.createParamsUrl({ challenge: challengeIndex + 2 }),
          );
        } else {
          presentFeedback(
            this.feedbackElem,
            null,
            this.world,
            "Challenge failed",
            "Maybe your program needs an improvement?",
            "",
          );
        }
      }
    });

    const codeObj = await this.editor.getCodeObj();
    if (codeObj) {
      console.log("Starting...");
      this.worldController.start(
        this.world,
        codeObj,
        window.requestAnimationFrame,
        autoStart,
      );
    }
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
