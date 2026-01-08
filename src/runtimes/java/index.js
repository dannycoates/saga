/**
 * Java runtime module.
 * Exports the runtime class, editor configuration, and metadata.
 */

import { JavaRuntime } from "./JavaRuntime.js";

// Re-export runtime class
export { JavaRuntime };
export default JavaRuntime;

/**
 * Editor configuration for CodeMirror.
 */
export const editorConfig = {
  /**
   * Gets the CodeMirror Java language extension.
   * @returns {Promise<import('@codemirror/state').Extension>}
   */
  async getLanguageExtension() {
    const { java } = await import("@codemirror/lang-java");
    return java();
  },

  /**
   * Gets the linter extension (Java has no linter currently).
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
  id: "java",
  displayName: "Java",
  fileExtension: ".java",
};
