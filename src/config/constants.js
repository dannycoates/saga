/**
 * Application configuration constants.
 * Central location for all magic numbers and strings.
 * @type {Object}
 */
export const APP_CONSTANTS = {
  // Frame rate and timing
  FRAME_RATE: 1.0 / 60.0,
  DEFAULT_TIME_SCALE: 2.0,
  
  // Storage keys
  STORAGE_KEY: "develevate_code",
  BACKUP_CODE_PREFIX: "develevateBackupCode_",
  TIME_SCALE_KEY: "elevatorTimeScale",
  
  // Default language
  DEFAULT_LANGUAGE: "javascript",
  
  // Auto-save throttle delay (ms)
  AUTO_SAVE_DELAY: 1000,
  
  // DOM selectors
  SELECTORS: {
    INNER_WORLD: ".innerworld",
    STATS_CONTAINER: ".statscontainer", 
    FEEDBACK_CONTAINER: ".feedbackcontainer",
    CHALLENGE: ".challenge",
    CODE_STATUS: ".codestatus",
    HEADER: ".header",
    CODE_AREA: "code",
    SAVE_MESSAGE: "save_message",
    RUNTIME_LOADING: "runtime-loading",
    LANGUAGE_SELECT: "language-select",
    BUTTON_RESET: "button_reset",
    BUTTON_RESET_UNDO: "button_resetundo",
    BUTTON_APPLY: "button_apply",
    LOADING_TEXT: ".loading-text",
    CHALLENGE_CONTROLS: "challenge-control",
    START_STOP_BUTTON: ".startstop"
  },
  
  // Messages
  MESSAGES: {
    RESET_CONFIRM: "Do you really want to reset to the default implementation?",
    RESET_UNDO_CONFIRM: "Do you want to bring back the code as before the last reset?",
    NO_BACKUP_FOUND: "No backup found for current language",
    RUNTIME_LOADING: "Runtime is still loading, please wait...",
    SUCCESS_TITLE: "Success!",
    SUCCESS_MESSAGE: "Challenge completed",
    FAILURE_TITLE: "Challenge failed",
    FAILURE_MESSAGE: "Maybe your program needs an improvement?"
  }
};