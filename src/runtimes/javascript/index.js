/**
 * JavaScript runtime module.
 * Exports the runtime class, editor configuration, and metadata.
 */

import { JavaScriptRuntime } from "./JavaScriptRuntime.js";

// Re-export runtime class
export { JavaScriptRuntime };
export default JavaScriptRuntime;

/**
 * Editor configuration for CodeMirror.
 */
export const editorConfig = {
  /**
   * Gets the CodeMirror JavaScript language extension.
   * @returns {Promise<import('@codemirror/state').Extension>}
   */
  async getLanguageExtension() {
    const { javascript } = await import("@codemirror/lang-javascript");
    return javascript();
  },

  /**
   * Gets the ESLint-based linter extension.
   * @returns {Promise<import('@codemirror/state').Extension | null>}
   */
  async getLinter() {
    const { createJavaScriptLinter } = await import("./linter.js");
    return createJavaScriptLinter();
  },
};

/**
 * Static metadata for this runtime.
 */
export const metadata = {
  id: "javascript",
  displayName: "JavaScript",
  fileExtension: ".js",
};
