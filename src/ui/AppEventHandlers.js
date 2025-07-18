import { APP_CONSTANTS } from "../config/constants.js";
import { presentCodeStatus, presentFeedback } from "./presenters.js";

export class AppEventHandlers {
  constructor(app, dom, editor, runtimeManager, worldManager, urlManager) {
    this.app = app;
    this.dom = dom;
    this.editor = editor;
    this.runtimeManager = runtimeManager;
    this.worldManager = worldManager;
    this.urlManager = urlManager;
    this.abortController = new AbortController();
    this.boundHandlers = {};
  }

  setupAllHandlers() {
    this.setupButtonHandlers();
    this.setupEditorHandlers();
    this.setupLanguageHandler();
    this.setupChallengeEndedHandler();
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
        this.app.startChallenge();
      },
      { signal },
    );

    // User code error event
    this.boundHandlers.editorError = (e) => {
      presentCodeStatus(this.dom.getElement("codeStatus"), e.detail);
    };
    this.app.addEventListener(
      "usercode_error",
      this.boundHandlers.editorError,
      { signal },
    );
  }

  setupLanguageHandler() {
    const { signal } = this.abortController;
    const languageSelect = this.dom.getElement("languageSelect");
    if (languageSelect) {
      languageSelect.value = this.editor.currentLanguage;

      this.boundHandlers.languageChange = async (e) => {
        const newLanguage = e.target.value;

        try {
          // Show loading state
          this.dom.showRuntimeStatus(true, `Loading ${newLanguage} runtime...`);
          // Update editor language
          this.editor.setLanguage(newLanguage);
          // Select the language in runtime manager
          // Note: not using withStatusIfSlow because pyodide blocks the event loop
          await this.runtimeManager.selectLanguage(newLanguage);

          // Clear status
          presentCodeStatus(this.dom.getElement("codeStatus"));
        } catch (error) {
          presentCodeStatus(this.dom.getElement("codeStatus"), error);
          // Revert language selector
          languageSelect.value = this.editor.currentLanguage;
        } finally {
          // Hide loading state
          this.dom.showRuntimeStatus(false);
        }
      };

      languageSelect.addEventListener(
        "change",
        this.boundHandlers.languageChange,
        { signal },
      );
    }
  }

  setupChallengeEndedHandler() {
    const { signal } = this.abortController;
    this.boundHandlers.challenge_ended = (e) => {
      const succeeded = e.detail;
      if (succeeded) {
        presentFeedback(
          this.dom.getElement("feedback"),
          APP_CONSTANTS.MESSAGES.SUCCESS_TITLE,
          APP_CONSTANTS.MESSAGES.SUCCESS_MESSAGE,
          this.urlManager.createParamsUrl({
            challenge: this.app.currentChallenge.id + 2,
          }),
        );
      } else {
        presentFeedback(
          this.dom.getElement("feedback"),
          APP_CONSTANTS.MESSAGES.FAILURE_TITLE,
          APP_CONSTANTS.MESSAGES.FAILURE_MESSAGE,
          "",
        );
      }
    };
    this.worldManager.addEventListener(
      "challenge_ended",
      this.boundHandlers.challenge_ended,
      { signal },
    );
  }

  cleanup() {
    // AbortController automatically removes all event listeners
    this.abortController.abort();

    // Clear bound handlers for memory cleanup
    this.boundHandlers = {};
  }
}
