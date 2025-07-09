import { getCodeObjFromCode, throttle } from "./core/utils.js";
import { createWorldCreator, createWorldController } from "./core/World.js";
import { challenges } from "./game/challenges.js";
import {
  presentStats,
  presentChallenge,
  presentFeedback,
  presentWorld,
  presentCodeStatus,
} from "./ui/presenters.js";
import { basicSetup, EditorView } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { gruvboxLight } from "cm6-theme-gruvbox-light";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";

// Helper function to dedent multi-line strings
function dedent(str) {
  const lines = str.split("\n");
  // Find minimum indentation (ignoring empty lines)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim()) {
      const indent = line.match(/^(\s*)/)[1].length;
      minIndent = Math.min(minIndent, indent);
    }
  }
  // Remove the common indentation
  if (minIndent < Infinity) {
    return lines.map((line) => line.slice(minIndent)).join("\n");
  }
  return str;
}

// CodeMirror editor wrapper
class CodeEditor extends EventTarget {
  constructor(element, storageKey) {
    super();
    this.storageKey = storageKey;

    const defaultCode = dedent(
      document.getElementById("default-elev-implementation").textContent,
    ).trim();
    const existingCode = localStorage.getItem(storageKey) || defaultCode;

    this.view = new EditorView({
      doc: existingCode,
      extensions: [
        basicSetup,
        javascript(),
        gruvboxLight,
        keymap.of([indentWithTab]),
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
    const defaultCode = dedent(
      document.getElementById("default-elev-implementation").textContent,
    ).trim();
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: defaultCode },
    });
  }

  saveCode() {
    localStorage.setItem(this.storageKey, this.getCode());
    document.getElementById("save_message").textContent =
      "Code saved " + new Date().toTimeString();
    this.dispatchEvent(new CustomEvent("change"));
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
      this.dispatchEvent(new CustomEvent("code_success"));
      return obj;
    } catch (e) {
      this.dispatchEvent(new CustomEvent("usercode_error", { detail: e }));
      return null;
    }
  }

  setDevTestCode() {
    const devCode = dedent(
      document.getElementById("devtest-elev-implementation").textContent,
    ).trim();
    this.setCode(devCode);
  }
}

// Main Application class
export class ElevatorApp extends EventTarget {
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

    // Event handlers storage
    this.timescaleChangedHandler = null;
    this.statsChangedHandler = null;
    this.worldPresenter = null;

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
        this.editor.dispatchEvent(new CustomEvent("apply_code"));
      });
    }

    // Editor events
    this.editor.addEventListener("apply_code", () => {
      this.startChallenge(this.currentChallengeIndex, true);
    });

    this.editor.addEventListener("code_success", () => {
      presentCodeStatus(this.codestatusElem);
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
      this.worldController.removeEventListener("timescale_changed", this.timescaleChangedHandler);
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
      this.worldController,
      challengeIndex + 1,
    );
    this.worldPresenter = presentWorld(this.worldElem, this.world);

    // Setup timescale change handler
    this.timescaleChangedHandler = () => {
      localStorage.setItem("elevatorTimeScale", this.worldController.timeScale);
      // The challenge control component will update automatically via its worldController property
    };
    this.worldController.addEventListener("timescale_changed", this.timescaleChangedHandler);

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
