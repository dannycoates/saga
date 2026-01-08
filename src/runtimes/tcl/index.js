/**
 * Tcl runtime module.
 * Exports the runtime class, editor configuration, and metadata.
 */

import { TclRuntime } from "./TclRuntime.js";

// Re-export runtime class
export { TclRuntime };
export default TclRuntime;

/**
 * Editor configuration for CodeMirror.
 */
export const editorConfig = {
  /**
   * Gets the CodeMirror Tcl language extension.
   * @returns {Promise<import('@codemirror/state').Extension>}
   */
  async getLanguageExtension() {
    const { tcl } = await import("@sourcebot/codemirror-lang-tcl");
    return tcl();
  },

  /**
   * Gets the linter extension (Tcl has no linter currently).
   * @returns {Promise<null>}
   */
  async getLinter() {
    return null;
  },
};

/**
 * Static metadata for this runtime.
 */
export const metadata = {
  id: "tcl",
  displayName: "Tcl",
  fileExtension: ".tcl",
};
