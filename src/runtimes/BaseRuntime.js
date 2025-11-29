export class BaseRuntime {
  constructor(language) {
    this.language = language;
    this.isLoaded = false;
    this.isLoading = false;
    this.loadedCode = null;
  }

  async loadRuntime() {
    throw new Error("load() must be implemented by subclass");
  }

  async start() {
    // do nothing by default
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

  cleanup() {
    this.loadedCode = null;
    // Override in subclass if cleanup is needed
  }
}
