/**
 * Rust runtime module.
 * Exports the runtime class, editor configuration, and metadata.
 */

import { RustRuntime } from "./RustRuntime.js";

// Re-export runtime class
export { RustRuntime };
export default RustRuntime;

/**
 * Editor configuration for CodeMirror.
 */
export const editorConfig = {
  /**
   * Gets the CodeMirror Rust language extension.
   * @returns {Promise<import('@codemirror/state').Extension>}
   */
  async getLanguageExtension() {
    const { rust } = await import("@codemirror/lang-rust");
    return rust();
  },

  /**
   * Gets the linter extension (Rust has no linter currently).
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
  id: "rust",
  displayName: "Rust",
  fileExtension: ".rs",
};
