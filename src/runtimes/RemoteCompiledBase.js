import { BaseRuntime } from "./base.js";

export class RemoteCompiledBase extends BaseRuntime {
  constructor(language) {
    super(language);
    this.wasmModule = null;
  }

  async loadRuntime() {
    // Base implementation - subclasses can override if needed
    this.loaded = true;
  }

  async loadCode(code) {
    this.loading = true;

    try {
      const response = await fetch("/compile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: this.language,
          code: code,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Compilation failed: ${response.status} ${response.statusText}`,
        );
      }

      const wasmBytes = await response.arrayBuffer();
      this.wasmModule = await WebAssembly.instantiate(wasmBytes);
      this.loadedCode = code;
    } finally {
      this.loading = false;
    }
  }

  async execute(elevators, floors) {
    // To be implemented by subclasses or later
    throw new Error("execute() must be implemented by subclass");
  }

  getDefaultTemplate() {
    throw new Error("getDefaultTemplate() must be implemented by subclass");
  }

  dispose() {
    super.dispose();
    this.wasmModule = null;
  }
}
