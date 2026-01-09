/**
 * OCaml runtime module.
 * Exports the runtime class, editor configuration, and metadata.
 */

import { OCamlRuntime } from "./OCamlRuntime.js";

// Re-export runtime class
export { OCamlRuntime };
export default OCamlRuntime;

/**
 * Editor configuration for CodeMirror.
 */
export const editorConfig = {
  /**
   * Gets the CodeMirror OCaml language extension.
   * Uses legacy mllike mode for OCaml syntax highlighting.
   * @returns {Promise<import('@codemirror/state').Extension>}
   */
  async getLanguageExtension() {
    const { StreamLanguage } = await import("@codemirror/language");
    const { oCaml } = await import("@codemirror/legacy-modes/mode/mllike");
    return StreamLanguage.define(oCaml);
  },

  /**
   * Gets the linter extension (OCaml has no linter currently).
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
  id: "ocaml",
  displayName: "OCaml",
  fileExtension: ".ml",
};
