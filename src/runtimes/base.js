export class BaseRuntime {
  constructor() {
    this.loaded = false;
    this.loading = false;
    this.loadedCode = null;
  }

  async load() {
    throw new Error('load() must be implemented by subclass');
  }

  async loadCode(code) {
    throw new Error('loadCode() must be implemented by subclass');
  }

  async execute(elevators, floors) {
    throw new Error('execute() must be implemented by subclass');
  }

  validateCode(code) {
    throw new Error('validateCode() must be implemented by subclass');
  }

  getDefaultTemplate() {
    throw new Error('getDefaultTemplate() must be implemented by subclass');
  }

  getLanguage() {
    throw new Error('getLanguage() must be implemented by subclass');
  }

  dispose() {
    this.loadedCode = null;
    // Override in subclass if cleanup is needed
  }
}