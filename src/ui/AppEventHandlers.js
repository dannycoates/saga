import { APP_CONSTANTS } from "../config/constants.js";
import { presentCodeStatus } from "./presenters.js";
import { KonamiCodeDetector } from "./KonamiCodeDetector.js";

export class AppEventHandlers {
  constructor(app, dom, editor, runtimeManager) {
    this.app = app;
    this.dom = dom;
    this.editor = editor;
    this.runtimeManager = runtimeManager;
    this.abortController = new AbortController();
    this.boundHandlers = {};
    this.konamiDetector = new KonamiCodeDetector();
    this.wasmUnlocked = false;
  }

  setupAllHandlers() {
    this.setupButtonHandlers();
    this.setupEditorHandlers();
    this.setupworldManagerHandlers();
    this.setupLanguageHandler();
    this.setupKonamiCodeHandler();
  }

  setupButtonHandlers() {
    const { signal } = this.abortController;

    // Reset button
    this.dom.getElement("buttonReset")?.addEventListener(
      "click",
      () => {
        if (confirm(APP_CONSTANTS.MESSAGES.RESET_CONFIRM)) {
          // Save current code as backup for current language
          localStorage.setItem(
            `${APP_CONSTANTS.BACKUP_CODE_PREFIX}${this.editor.currentLanguage}`,
            this.editor.getCode(),
          );
          this.editor.reset();
        }
        this.editor.view.focus();
      },
      { signal },
    );

    // Reset undo button
    this.dom.getElement("buttonResetUndo")?.addEventListener(
      "click",
      () => {
        if (confirm(APP_CONSTANTS.MESSAGES.RESET_UNDO_CONFIRM)) {
          // Load backup for current language
          const backupCode = localStorage.getItem(
            `${APP_CONSTANTS.BACKUP_CODE_PREFIX}${this.editor.currentLanguage}`,
          );
          if (backupCode) {
            this.editor.setCode(backupCode);
          } else {
            alert(APP_CONSTANTS.MESSAGES.NO_BACKUP_FOUND);
          }
        }
        this.editor.view.focus();
      },
      { signal },
    );

    // Apply button
    const applyButton = this.dom.getElement("buttonApply");
    if (applyButton) {
      applyButton.addEventListener(
        "click",
        () => {
          this.editor.dispatchEvent(new CustomEvent("apply_code"));
        },
        { signal },
      );
    }
  }

  setupEditorHandlers() {
    const { signal } = this.abortController;

    // Apply code event
    this.editor.addEventListener(
      "apply_code",
      () => {
        this.app.startChallenge(this.app.getCurrentChallengeIndex(), true);
      },
      { signal },
    );

    // User code error event
    this.boundHandlers.editorError = (e) => {
      presentCodeStatus(this.dom.getElement("codeStatus"), e.detail);
    };
    this.editor.addEventListener(
      "usercode_error",
      this.boundHandlers.editorError,
      { signal },
    );
  }

  setupworldManagerHandlers() {
    const { signal } = this.abortController;

    // World controller error handling
    this.boundHandlers.worldManagerError = (e) => {
      this.editor.dispatchEvent(
        new CustomEvent("usercode_error", { detail: e.detail }),
      );
    };
    this.app.worldManager.addEventListener(
      "usercode_error",
      this.boundHandlers.worldManagerError,
      { signal },
    );
  }

  setupLanguageHandler() {
    const { signal } = this.abortController;
    const languageSelect = this.dom.getElement("languageSelect");
    if (languageSelect) {
      // Check if WASM was previously unlocked by checking if current language is WASM
      if (this.editor.currentLanguage === 'wasm') {
        this.wasmUnlocked = true;
        this.addWasmToLanguageSelector();
      }
      
      languageSelect.value = this.editor.currentLanguage;

      this.boundHandlers.languageChange = async (e) => {
        const newLanguage = e.target.value;

        try {
          // Show loading state
          this.dom.showRuntimeLoading(
            true,
            `Loading ${newLanguage} runtime...`,
          );

          // Select the language in runtime manager
          await this.runtimeManager.selectLanguage(newLanguage);

          // Update editor language
          this.editor.setLanguage(newLanguage);

          // Clear status
          presentCodeStatus(this.dom.getElement("codeStatus"));
        } catch (error) {
          presentCodeStatus(this.dom.getElement("codeStatus"), error);
          // Revert language selector
          languageSelect.value = this.editor.currentLanguage;
        } finally {
          // Hide loading state
          this.dom.showRuntimeLoading(false);
        }
      };

      languageSelect.addEventListener(
        "change",
        this.boundHandlers.languageChange,
        { signal },
      );
    }
  }

  setupKonamiCodeHandler() {
    const { signal } = this.abortController;
    
    this.boundHandlers.konamiCode = () => {
      if (!this.wasmUnlocked) {
        this.wasmUnlocked = true;
        this.addWasmToLanguageSelector();
        console.log("🎮 Konami code activated! WASM runtime unlocked!");
      }
    };

    this.konamiDetector.addEventListener(
      'konamicode',
      this.boundHandlers.konamiCode,
      { signal }
    );
  }

  addWasmToLanguageSelector() {
    const languageSelect = this.dom.getElement("languageSelect");
    if (languageSelect && !languageSelect.querySelector('option[value="wasm"]')) {
      const wasmOption = document.createElement('option');
      wasmOption.value = 'wasm';
      wasmOption.textContent = 'WebAssembly';
      languageSelect.appendChild(wasmOption);
    }
  }

  cleanup() {
    // AbortController automatically removes all event listeners
    this.abortController.abort();

    // Clean up konami detector
    if (this.konamiDetector) {
      this.konamiDetector.dispose();
    }

    // Clear bound handlers for memory cleanup
    this.boundHandlers = {};
  }
}
