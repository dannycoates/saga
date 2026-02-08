import { throttle } from "../utils/common.js";
import { basicSetup, EditorView } from "codemirror";
import { gruvboxLight } from "cm6-theme-gruvbox-light";
import { gruvboxDark } from "cm6-theme-gruvbox-dark";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { Compartment } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import { lintGutter } from "@codemirror/lint";
import { themeManager } from "./ThemeManager.js";
import { runtimeImports } from "virtual:runtime-registry";

/**
 * @typedef {import('../runtimes/RuntimeManager.js').RuntimeManager} RuntimeManager
 * @typedef {import('../app.js').ElevatorApp} ElevatorApp
 */

/**
 * CodeMirror editor wrapper with dynamic language loading.
 * @extends EventTarget
 */
export class CodeEditor extends EventTarget {
  /**
   * Creates a code editor instance.
   * @param {HTMLElement} element - Parent element for the editor
   * @param {string} storageKey - LocalStorage key prefix
   * @param {RuntimeManager} runtimeManager - Runtime manager for templates and editor configs
   * @param {ElevatorApp | null} [app=null] - Application instance
   */
  constructor(element, storageKey, runtimeManager, app = null) {
    super();
    /** @type {string} LocalStorage key prefix */
    this.storageKey = storageKey;
    /** @type {RuntimeManager} Runtime manager for dynamic loading */
    this.runtimeManager = runtimeManager;
    /** @type {ElevatorApp | null} Application instance */
    this.app = app;
    /** @type {string} Current language */
    this.currentLanguage =
      localStorage.getItem(`${storageKey}_language`) || "javascript";

    /** @type {Map<string, object>} Cached editor configs by language */
    this.editorConfigs = new Map();

    /** @type {Map<string, string>} Cached default templates by language */
    this.templateCache = new Map();

    // Create compartments for extensions
    this.languageCompartment = new Compartment();
    this.linterCompartment = new Compartment();
    this.themeCompartment = new Compartment();
    this.layoutCompartment = new Compartment();

    // Store element for deferred view creation
    this.element = element;
    this.view = null;
    this.autoSave = throttle(() => this.saveCode(), 1000);

    // Listen for theme changes
    themeManager.onThemeChange((theme) => {
      this.updateTheme(theme);
    });
  }

  /**
   * Initializes the editor asynchronously.
   * Must be called after construction to load initial language config.
   * @returns {Promise<void>}
   */
  async initialize() {
    // Load initial template and editor config
    const [defaultCode, config] = await Promise.all([
      this.getDefaultTemplate(this.currentLanguage),
      this.loadEditorConfig(this.currentLanguage),
    ]);

    const existingCode =
      localStorage.getItem(`${this.storageKey}_${this.currentLanguage}`) ||
      defaultCode;

    this.view = new EditorView({
      doc: existingCode,
      extensions: this.getExtensions(config),
      parent: this.element,
    });
  }

  /**
   * Gets the default template for a language.
   * Caches templates to avoid repeated loads.
   * @param {string} language - Language identifier
   * @returns {Promise<string>}
   */
  async getDefaultTemplate(language) {
    if (this.templateCache.has(language)) {
      return /** @type {string} */ (this.templateCache.get(language));
    }

    const template = await this.runtimeManager.getDefaultTemplate(language);
    this.templateCache.set(language, template);
    return template;
  }

  /**
   * Loads editor configuration for a language from its runtime module.
   * @param {string} language - Language identifier
   * @returns {Promise<{langExtension: import('@codemirror/state').Extension, linterExtension: import('@codemirror/state').Extension|null}>}
   */
  async loadEditorConfig(language) {
    if (this.editorConfigs.has(language)) {
      return /** @type {{langExtension: import('@codemirror/state').Extension, linterExtension: import('@codemirror/state').Extension | null}} */ (
        this.editorConfigs.get(language)
      );
    }

    // Import the runtime module to get editor config
    const module = /** @type {any} */ (await runtimeImports[language]());

    const config = {
      langExtension: await module.editorConfig.getLanguageExtension(),
      linterExtension: await module.editorConfig.getLinter(),
    };

    this.editorConfigs.set(language, config);
    return config;
  }

  /**
   * Gets all CodeMirror extensions for the current language.
   * @private
   * @param {{langExtension: import('@codemirror/state').Extension, linterExtension: import('@codemirror/state').Extension|null}} config - Editor config
   * @returns {import('@codemirror/state').Extension[]} Array of CodeMirror extensions
   */
  getExtensions(config) {
    const currentTheme = themeManager.getCurrentTheme();
    const themeExtension = currentTheme === "dark" ? gruvboxDark : gruvboxLight;

    // Default layout theme (no height constraints)
    const defaultLayoutTheme = EditorView.theme({});

    const extensions = [
      basicSetup,
      this.languageCompartment.of(config.langExtension),
      this.themeCompartment.of(themeExtension),
      this.layoutCompartment.of(defaultLayoutTheme),
      indentUnit.of("    "), // 4 spaces for indentation
      lintGutter(), // Add lint gutter for error indicators
      this.linterCompartment.of(config.linterExtension || []),
      keymap.of([
        indentWithTab,
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            if (this.app && this.app.gameController) {
              if (!this.app.gameController.isPaused) {
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

  /**
   * Updates the editor theme.
   * @param {'light' | 'dark'} theme - Theme to apply
   * @returns {void}
   */
  updateTheme(theme) {
    if (!this.view) return;
    const themeExtension = theme === "dark" ? gruvboxDark : gruvboxLight;
    this.view.dispatch({
      effects: this.themeCompartment.reconfigure(themeExtension),
    });
  }

  /**
   * Switches the editor to a different programming language.
   * Saves current code, loads saved code for new language, and reconfigures extensions.
   * @param {string} language - Language identifier
   * @returns {Promise<void>}
   */
  async setLanguage(language) {
    if (language === this.currentLanguage) return;
    if (!this.view) return;

    // Save current code
    this.saveCode();

    // Update language
    this.currentLanguage = language;
    localStorage.setItem(`${this.storageKey}_language`, language);

    // Load editor config and template for new language
    const [config, defaultCode] = await Promise.all([
      this.loadEditorConfig(language),
      this.getDefaultTemplate(language),
    ]);

    const existingCode =
      localStorage.getItem(`${this.storageKey}_${language}`) || defaultCode;

    // Reconfigure both language and linter compartments
    this.view.dispatch({
      effects: [
        this.languageCompartment.reconfigure(config.langExtension),
        this.linterCompartment.reconfigure(config.linterExtension || []),
      ],
    });

    // Set the code
    this.setCode(existingCode);
  }

  /**
   * Resets the editor content to the default template for the current language.
   * @returns {Promise<void>}
   */
  async reset() {
    if (!this.view) return;
    const defaultCode = await this.getDefaultTemplate(this.currentLanguage);

    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: defaultCode },
    });
  }

  /**
   * Saves the current code to localStorage and dispatches a change event.
   * @returns {void}
   */
  saveCode() {
    if (!this.view) return;
    localStorage.setItem(
      `${this.storageKey}_${this.currentLanguage}`,
      this.getCode(),
    );
    const saveMsg = document.getElementById("save_message");
    if (saveMsg) {
      saveMsg.textContent = "Code saved " + new Date().toTimeString();
    }
    this.dispatchEvent(new CustomEvent("change"));
  }

  /**
   * Gets the current code content from the editor.
   * @returns {string} Current editor content
   */
  getCode() {
    if (!this.view) return "";
    return this.view.state.doc.toString();
  }

  /**
   * Sets the editor content to the specified code.
   * @param {string} code - Code to set in the editor
   * @returns {void}
   */
  setCode(code) {
    if (!this.view) return;
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: code },
    });
  }

  /**
   * Sets the layout mode for the editor (side-by-side or vertical).
   * Adjusts editor height constraints based on layout.
   * @param {boolean} isSideBySide - Whether to use side-by-side layout
   * @returns {void}
   */
  setLayoutMode(isSideBySide) {
    if (!this.view) return;
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
}
