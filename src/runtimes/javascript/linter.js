/**
 * JavaScript ESLint linter for CodeMirror.
 * Provides real-time linting with ESLint rules for the code editor.
 */

import { linter } from "@codemirror/lint";
import * as eslint from "eslint-linter-browserify";

/**
 * Creates an ESLint-based linter for JavaScript code in CodeMirror.
 * Falls back to basic syntax checking if ESLint fails.
 * @returns {import('@codemirror/state').Extension | null} Linter extension or null if creation fails
 */
export function createJavaScriptLinter() {
  try {
    const eslintLinter = new eslint.Linter();

    return linter((view) => {
      /** @type {import('@codemirror/lint').Diagnostic[]} */
      const diagnostics = [];
      const code = view.state.doc.toString();

      try {
        const messages = eslintLinter.verify(
          code,
          {
            // ESLint flat config format
            languageOptions: {
              ecmaVersion: 2022,
              sourceType: "module",
              globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                console: "readonly",
              },
            },
            rules: {
              // Error-level rules
              "no-undef": "error",
              "no-redeclare": "error",
              "no-unreachable": "error",
              "no-dupe-keys": "error",
              "no-dupe-args": "error",
              "valid-typeof": "error",
              "use-isnan": "error",
              "no-unexpected-multiline": "error",

              // Warning-level rules
              "no-unused-vars": "warn",
              "no-empty": "warn",
              "no-extra-semi": "warn",
            },
          },
          { filename: "elevator.js" },
        );

        // Convert ESLint messages to CodeMirror diagnostics
        messages.forEach((message) => {
          const doc = view.state.doc;
          const line = Math.max(1, Math.min(message.line || 1, doc.lines));
          const lineObj = doc.line(line);
          const column =
            Math.max(0, Math.min(message.column || 1, lineObj.length)) - 1;

          const from = lineObj.from + column;
          const to = Math.min(from + 5, lineObj.to); // Highlight a few characters

          diagnostics.push({
            from,
            to,
            severity: /** @type {"error" | "warning"} */ (
              message.severity === 2 ? "error" : "warning"
            ),
            message: message.message,
          });
        });
      } catch (eslintError) {
        console.warn("ESLint error:", eslintError);
        // Fall back to basic syntax checking
        try {
          new Function(code);
        } catch (syntaxError) {
          const doc = view.state.doc;
          diagnostics.push({
            from: 0,
            to: Math.min(10, doc.length),
            severity: "error",
            message: syntaxError.message,
          });
        }
      }

      return diagnostics;
    });
  } catch (error) {
    console.warn("Failed to create ESLint linter, linting disabled:", error);
    return null;
  }
}
