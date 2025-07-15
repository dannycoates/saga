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
import { themeManager } from "./theme-manager.js";

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
  constructor(element, storageKey, runtimeManager) {
    super();
    this.storageKey = storageKey;
    this.runtimeManager = runtimeManager;
    this.currentLanguage =
      localStorage.getItem(`${storageKey}_language`) || "javascript";
    this.parentElement = element;

    // Create compartments for extensions
    this.languageCompartment = new Compartment();
    this.linterCompartment = new Compartment();
    this.themeCompartment = new Compartment();

    // Initialize the appropriate interface
    this.initializeInterface();

    this.autoSave = throttle(() => this.saveCode(), 1000);

    // Listen for theme changes
    themeManager.onThemeChange((theme) => {
      this.updateTheme(theme);
    });
  }

  initializeInterface() {
    if (this.currentLanguage === 'wasm') {
      this.createWasmInterface();
    } else {
      this.createCodeEditor();
    }
  }

  createCodeEditor() {
    // Clear existing content
    this.parentElement.innerHTML = '';

    // Get the appropriate default code based on language
    const defaultCode =
      this.runtimeManager.runtimes[this.currentLanguage].getDefaultTemplate();

    const existingCode =
      localStorage.getItem(`${this.storageKey}_${this.currentLanguage}`) ||
      defaultCode;

    this.view = new EditorView({
      doc: existingCode,
      extensions: this.getExtensions(),
      parent: this.parentElement,
    });
    
    // Clear any WASM interface references
    this.wasmInterface = null;
  }

  createWasmInterface() {
    // Clear existing content and CodeMirror view
    this.parentElement.innerHTML = '';
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }

    // Create WASM file interface
    this.wasmInterface = document.createElement('div');
    this.wasmInterface.className = 'wasm-interface';
    this.wasmInterface.innerHTML = `
      <div class="wasm-upload-area">
        <div class="drop-zone" id="wasm-drop-zone">
          <div class="drop-zone-content">
            <div class="upload-icon">📁</div>
            <h3>Drop your WASM file here</h3>
            <p>or</p>
            <input type="file" id="wasm-file-input" accept=".wasm" style="display: none;">
            <button id="wasm-file-button" class="file-select-button">Select WASM File</button>
          </div>
        </div>
        <div class="wasm-file-info" id="wasm-file-info" style="display: none;">
          <h4>Loaded WASM File:</h4>
          <div class="file-details">
            <span class="file-name" id="wasm-file-name"></span>
            <span class="file-size" id="wasm-file-size"></span>
          </div>
          <button id="wasm-file-remove" class="remove-button">Remove File</button>
        </div>
        <div class="wasm-instructions">
          <h4>Instructions:</h4>
          <ol>
            <li>Implement the elevator-api.wit interface in your preferred language</li>
            <li>Compile your code to a WASM component (.wasm file)</li>
            <li>Upload the .wasm file using the file selector or drag & drop</li>
            <li>Click "Apply" to run your WASM elevator controller</li>
          </ol>
          <p><strong>Interface specification:</strong> See <code>elevator-api.wit</code> in the project root</p>
        </div>
      </div>
    `;

    this.parentElement.appendChild(this.wasmInterface);
    this.setupWasmFileHandlers();
  }

  setupWasmFileHandlers() {
    const dropZone = this.wasmInterface.querySelector('#wasm-drop-zone');
    const fileInput = this.wasmInterface.querySelector('#wasm-file-input');
    const fileButton = this.wasmInterface.querySelector('#wasm-file-button');
    const fileInfo = this.wasmInterface.querySelector('#wasm-file-info');
    const fileName = this.wasmInterface.querySelector('#wasm-file-name');
    const fileSize = this.wasmInterface.querySelector('#wasm-file-size');
    const removeButton = this.wasmInterface.querySelector('#wasm-file-remove');

    // File button click
    fileButton.addEventListener('click', () => {
      fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleWasmFile(e.target.files[0]);
      }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].name.endsWith('.wasm')) {
        this.handleWasmFile(files[0]);
      } else {
        alert('Please drop a .wasm file');
      }
    });

    // Remove button
    removeButton.addEventListener('click', () => {
      this.currentWasmFile = null;
      fileInfo.style.display = 'none';
      dropZone.style.display = 'block';
      fileInput.value = '';
    });

    const updateFileInfo = () => {
      const runtime = this.runtimeManager.runtimes.wasm;
      if (runtime && runtime.hasWasmFile()) {
        const fileInfo = runtime.getFileInfo();
        fileName.textContent = 'WASM Module';
        fileSize.textContent = `${(fileInfo.size / 1024).toFixed(1)} KB`;
        dropZone.style.display = 'none';
        this.wasmInterface.querySelector('#wasm-file-info').style.display = 'block';
      }
    };

    // Check if there's already a WASM file loaded
    updateFileInfo();
  }

  async handleWasmFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Store the file for the runtime
      this.currentWasmFile = arrayBuffer;
      
      // Update UI
      const fileName = this.wasmInterface.querySelector('#wasm-file-name');
      const fileSize = this.wasmInterface.querySelector('#wasm-file-size');
      const fileInfo = this.wasmInterface.querySelector('#wasm-file-info');
      const dropZone = this.wasmInterface.querySelector('#wasm-drop-zone');
      
      fileName.textContent = file.name;
      fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
      dropZone.style.display = 'none';
      fileInfo.style.display = 'block';

      // Trigger save event
      this.dispatchEvent(new CustomEvent("change"));
      
    } catch (error) {
      console.error('Failed to load WASM file:', error);
      alert('Failed to load WASM file: ' + error.message);
    }
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
    // Only update theme if we have a CodeMirror view (not for WASM interface)
    if (this.view) {
      const themeExtension = theme === "dark" ? gruvboxDark : gruvboxLight;
      this.view.dispatch({
        effects: this.themeCompartment.reconfigure(themeExtension),
      });
    }
  }

  setLanguage(language) {
    if (language === this.currentLanguage) return;

    // Save current code if we have a code editor
    if (this.view) {
      this.saveCode();
    }

    // Update language
    this.currentLanguage = language;
    localStorage.setItem(`${this.storageKey}_language`, language);

    // Reinitialize the interface for the new language
    this.initializeInterface();
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
    if (this.currentLanguage === 'wasm') {
      // Reset WASM interface
      this.currentWasmFile = null;
      if (this.wasmInterface) {
        const fileInfo = this.wasmInterface.querySelector('#wasm-file-info');
        const dropZone = this.wasmInterface.querySelector('#wasm-drop-zone');
        const fileInput = this.wasmInterface.querySelector('#wasm-file-input');
        fileInfo.style.display = 'none';
        dropZone.style.display = 'block';
        fileInput.value = '';
      }
      return;
    }

    const defaultCode =
      this.runtimeManager.runtimes[this.currentLanguage].getDefaultTemplate();

    if (this.view) {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: defaultCode },
      });
    }
  }

  saveCode() {
    if (this.currentLanguage === 'wasm') {
      // WASM files don't get saved to localStorage (too large)
      document.getElementById("save_message").textContent =
        "WASM file loaded " + new Date().toTimeString();
      this.dispatchEvent(new CustomEvent("change"));
      return;
    }

    localStorage.setItem(
      `${this.storageKey}_${this.currentLanguage}`,
      this.getCode(),
    );
    document.getElementById("save_message").textContent =
      "Code saved " + new Date().toTimeString();
    this.dispatchEvent(new CustomEvent("change"));
  }

  getCode() {
    if (this.currentLanguage === 'wasm') {
      return this.currentWasmFile || null;
    }
    return this.view ? this.view.state.doc.toString() : '';
  }

  setCode(code) {
    if (this.currentLanguage === 'wasm') {
      // For WASM, code would be an ArrayBuffer
      if (code instanceof ArrayBuffer) {
        this.currentWasmFile = code;
      }
      return;
    }
    if (this.view) {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: code },
      });
    }
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