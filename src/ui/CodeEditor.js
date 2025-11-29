import { throttle } from "../core/utils.js";
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
import { themeManager } from "./ThemeManager.js";

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
export class CodeEditor extends EventTarget {
  constructor(element, storageKey, defaultTemplates, app = null) {
    super();
    this.storageKey = storageKey;
    this.defaultTemplates = defaultTemplates;
    this.app = app;
    this.currentLanguage =
      localStorage.getItem(`${storageKey}_language`) || "javascript";

    // Create compartments for extensions
    this.languageCompartment = new Compartment();
    this.linterCompartment = new Compartment();
    this.themeCompartment = new Compartment();
    this.layoutCompartment = new Compartment();

    // Get the appropriate default code based on language
    const defaultCode = defaultTemplates[this.currentLanguage];

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

    // Default layout theme (no height constraints)
    const defaultLayoutTheme = EditorView.theme({});

    const extensions = [
      basicSetup,
      this.languageCompartment.of(langExtension),
      this.themeCompartment.of(themeExtension),
      this.layoutCompartment.of(defaultLayoutTheme),
      indentUnit.of("    "), // 4 spaces for indentation
      lintGutter(), // Add lint gutter for error indicators
      this.linterCompartment.of(lintExtension || []), // Use compartment for linter
      keymap.of([
        indentWithTab,
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            if (this.app && this.app.worldManager) {
              if (!this.app.worldManager.isPaused) {
                this.app.startOrStop(); // restart
              }
              this.app.startOrStop();
            }
            return true;
          },
        },
      ]),
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
    const defaultCode = this.defaultTemplates[language];
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
    const defaultCode = this.defaultTemplates[this.currentLanguage];

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
  setLayoutMode(isSideBySide) {
    const layoutTheme = isSideBySide
      ? EditorView.theme({
          "&": { height: "100%" },
          ".cm-editor": { overflow: "auto" },
        })
      : EditorView.theme({});

    this.view.dispatch({
      effects: this.layoutCompartment.reconfigure(layoutTheme),
    });
  }

  async getCodeObj(app) {
    const code = this.getCode();

    try {
      // Show loading for language selection if needed
      const currentRuntime = this.runtimeManager.getCurrentRuntime();
      if (!currentRuntime || !currentRuntime.isLoaded) {
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
      this.dispatchEvent(new CustomEvent("user_code_error", { detail: e }));
      return null;
    }
  }
}
