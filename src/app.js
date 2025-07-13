import { throttle } from "./core/utils.js";
import { WorldCreator, WorldController } from "./core/World.js";
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
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { gruvboxLight } from "cm6-theme-gruvbox-light";
import { gruvboxDark } from "cm6-theme-gruvbox-dark";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { Compartment } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import { linter, lintGutter } from "@codemirror/lint";
import * as eslint from "eslint-linter-browserify";
import { RuntimeManager } from "./runtimes/manager.js";
import { themeManager } from "./ui/theme-manager.js";
import { ThemeSwitcher } from "./ui/components/theme-switcher.js";

// Enhanced JavaScript linter using ESLint
function createJavaScriptLinter() {
  try {
    const eslintLinter = new eslint.Linter();

    return linter((view) => {
      const diagnostics = [];
      const code = view.state.doc.toString();

      try {
        const messages = eslintLinter.verify(
          code,
          {
            // ESLint flat config format
            languageOptions: {
              ecmaVersion: 2022,
              sourceType: "module",
              globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                console: "readonly",
              },
            },
            rules: {
              // Error-level rules
              "no-undef": "error",
              "no-redeclare": "error",
              "no-unreachable": "error",
              "no-dupe-keys": "error",
              "no-dupe-args": "error",
              "valid-typeof": "error",
              "use-isnan": "error",
              "no-unexpected-multiline": "error",

              // Warning-level rules
              "no-unused-vars": "warn",
              "no-empty": "warn",
              "no-extra-semi": "warn",
            },
          },
          { filename: "elevator.js" },
        );

        // Convert ESLint messages to CodeMirror diagnostics
        messages.forEach((message) => {
          const doc = view.state.doc;
          const line = Math.max(1, Math.min(message.line || 1, doc.lines));
          const lineObj = doc.line(line);
          const column =
            Math.max(0, Math.min(message.column || 1, lineObj.length)) - 1;

          const from = lineObj.from + column;
          const to = Math.min(from + 5, lineObj.to); // Highlight a few characters

          diagnostics.push({
            from,
            to,
            severity: message.severity === 2 ? "error" : "warning",
            message: message.message,
          });
        });
      } catch (eslintError) {
        console.warn("ESLint error:", eslintError);
        // Fall back to basic syntax checking
        try {
          new Function(code);
        } catch (syntaxError) {
          const doc = view.state.doc;
          diagnostics.push({
            from: 0,
            to: Math.min(10, doc.length),
            severity: "error",
            message: syntaxError.message,
          });
        }
      }

      return diagnostics;
    });
  } catch (error) {
    console.warn("Failed to create ESLint linter, linting disabled:", error);
    return null;
  }
}

// CodeMirror editor wrapper
class CodeEditor extends EventTarget {
  constructor(element, storageKey, runtimeManager) {
    super();
    this.storageKey = storageKey;
    this.runtimeManager = runtimeManager;
    this.currentLanguage =
      localStorage.getItem(`${storageKey}_language`) || "javascript";

    // Create compartments for extensions
    this.languageCompartment = new Compartment();
    this.linterCompartment = new Compartment();
    this.themeCompartment = new Compartment();

    // Get the appropriate default code based on language
    const defaultCode =
      this.runtimeManager.runtimes[this.currentLanguage].getDefaultTemplate();

    const existingCode =
      localStorage.getItem(`${storageKey}_${this.currentLanguage}`) ||
      defaultCode;

    this.view = new EditorView({
      doc: existingCode,
      extensions: this.getExtensions(),
      parent: element,
    });

    this.autoSave = throttle(() => this.saveCode(), 1000);

    // Listen for theme changes
    themeManager.onThemeChange((theme) => {
      this.updateTheme(theme);
    });
  }

  getExtensions() {
    let langExtension;
    let lintExtension = null;

    switch (this.currentLanguage) {
      case "javascript":
        langExtension = javascript();
        lintExtension = createJavaScriptLinter();
        break;
      case "python":
        langExtension = python();
        break;
      case "java":
        langExtension = java();
        break;
      default:
        langExtension = javascript();
    }

    const currentTheme = themeManager.getCurrentTheme();
    const themeExtension = currentTheme === "dark" ? gruvboxDark : gruvboxLight;

    const extensions = [
      basicSetup,
      this.languageCompartment.of(langExtension),
      this.themeCompartment.of(themeExtension),
      indentUnit.of("    "), // 4 spaces for indentation
      lintGutter(), // Add lint gutter for error indicators
      this.linterCompartment.of(lintExtension || []), // Use compartment for linter
      keymap.of([indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          this.autoSave();
        }
      }),
    ];

    return extensions;
  }

  updateTheme(theme) {
    const themeExtension = theme === "dark" ? gruvboxDark : gruvboxLight;
    this.view.dispatch({
      effects: this.themeCompartment.reconfigure(themeExtension),
    });
  }

  setLanguage(language) {
    if (language === this.currentLanguage) return;

    // Save current code
    this.saveCode();

    // Update language
    this.currentLanguage = language;
    localStorage.setItem(`${this.storageKey}_language`, language);

    // Load code for new language
    const defaultCode =
      this.runtimeManager.runtimes[language].getDefaultTemplate();
    const existingCode =
      localStorage.getItem(`${this.storageKey}_${language}`) || defaultCode;

    // Reconfigure both language and linter compartments
    let lintExtension = null;
    if (language === "javascript") {
      lintExtension = createJavaScriptLinter();
    }

    this.view.dispatch({
      effects: [
        this.languageCompartment.reconfigure(
          this.getLanguageExtension(language),
        ),
        this.linterCompartment.reconfigure(lintExtension || []),
      ],
    });

    // Set the code
    this.setCode(existingCode);
  }

  getLanguageExtension(language) {
    switch (language) {
      case "javascript":
        return javascript();
      case "python":
        return python();
      case "java":
        return java();
      default:
        return javascript();
    }
  }

  reset() {
    const defaultCode =
      this.runtimeManager.runtimes[this.currentLanguage].getDefaultTemplate();

    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: defaultCode },
    });
  }

  saveCode() {
    localStorage.setItem(
      `${this.storageKey}_${this.currentLanguage}`,
      this.getCode(),
    );
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

  async getCodeObj(app) {
    const code = this.getCode();

    try {
      // Show loading for language selection if needed
      const currentRuntime = this.runtimeManager.getCurrentRuntime();
      if (!currentRuntime || !currentRuntime.loaded) {
        app.showRuntimeLoading(
          true,
          `Loading ${this.currentLanguage} runtime...`,
        );
      }

      // Select the language and load the code
      await this.runtimeManager.selectLanguage(this.currentLanguage);

      // Show loading for code compilation/loading
      app.showRuntimeLoading(true, `Compiling ${this.currentLanguage} code...`);
      await this.runtimeManager.loadCode(code);

      // Hide loading
      app?.showRuntimeLoading(false);

      // Return a wrapper object that calls the runtime manager
      return {
        tick: async (elevators, floors) => {
          return await this.runtimeManager.execute(elevators, floors);
        },
      };
    } catch (e) {
      app.showRuntimeLoading(false);
      this.dispatchEvent(new CustomEvent("usercode_error", { detail: e }));
      return null;
    }
  }
}

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
    const runtime = this.runtimeManager.getCurrentRuntime();
    if (!runtime.loaded) {
      // Show loading state
      this.showRuntimeLoading(
        true,
        `Loading ${this.editor.currentLanguage} runtime...`,
      );

      try {
        // Pre-load the runtime
        await this.runtimeManager.selectLanguage(this.editor.currentLanguage);
        this.showRuntimeLoading(false);
      } catch (error) {
        console.error("Failed to load initial runtime:", error);
        this.showRuntimeLoading(false);
      }
    }

    // Now that runtime is loaded, proceed with loading from URL
    this.loadFromUrl();
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
    // Check if runtime is still loading
    const loadingIndicator = document.getElementById("runtime-loading");
    if (loadingIndicator && loadingIndicator.style.display !== "none") {
      console.log("Runtime is still loading, please wait...");
      return;
    }
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

    this.currentChallengeIndex = challengeIndex;
    this.world = this.worldCreator.createWorld(
      challenges[challengeIndex].options,
    );

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
