/**
 * Zig runtime module.
 * Exports the runtime class, editor configuration, and metadata.
 */

import { ZigRuntime } from "./ZigRuntime.js";

// Re-export runtime class
export { ZigRuntime };
export default ZigRuntime;

/**
 * Editor configuration for CodeMirror.
 */
export const editorConfig = {
  /**
   * Gets the CodeMirror Zig language extension.
   * @returns {Promise<import('@codemirror/state').Extension>}
   */
  async getLanguageExtension() {
    const { zig } = await import("codemirror-lang-zig");
    return zig();
  },

  /**
   * Gets the linter extension (Zig has no linter currently).
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
  id: "zig",
  displayName: "Zig",
  fileExtension: ".zig",
};
