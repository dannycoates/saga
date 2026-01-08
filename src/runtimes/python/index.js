/**
 * Python runtime module.
 * Exports the runtime class, editor configuration, and metadata.
 */

import { PythonRuntime } from "./PythonRuntime.js";

// Re-export runtime class
export { PythonRuntime };
export default PythonRuntime;

/**
 * Editor configuration for CodeMirror.
 */
export const editorConfig = {
  /**
   * Gets the CodeMirror Python language extension.
   * @returns {Promise<import('@codemirror/state').Extension>}
   */
  async getLanguageExtension() {
    const { python } = await import("@codemirror/lang-python");
    return python();
  },

  /**
   * Gets the linter extension (Python has no linter currently).
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
  id: "python",
  displayName: "Python",
  fileExtension: ".py",
};
