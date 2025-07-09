export class BaseRuntime {
  constructor(language) {
    this.language = language;
    this.loaded = false;
    this.loading = false;
    this.loadedCode = null;
  }

  async loadRuntime() {
    throw new Error("load() must be implemented by subclass");
  }

  async loadCode(code) {
    throw new Error("loadCode() must be implemented by subclass");
  }

  async execute(elevators, floors) {
    throw new Error("execute() must be implemented by subclass");
  }

  getDefaultTemplate() {
    throw new Error("getDefaultTemplate() must be implemented by subclass");
  }

  dispose() {
    this.loadedCode = null;
    // Override in subclass if cleanup is needed
  }
}
