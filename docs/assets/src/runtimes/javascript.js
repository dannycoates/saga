import { __vitePreload } from '../core/utils.js';
import { BaseRuntime } from './base.js';

class JavaScriptRuntime extends BaseRuntime {
  constructor() {
    super();
    this.loaded = true; // JavaScript is always available
    this.loadedModule = null;
  }

  async load() {
    // No loading required for native JavaScript
    return;
  }

  async loadCode(code) {
    this.validateCode(code);
    
    // Import the user's code as an ES module
    this.loadedModule = await __vitePreload(() => import(
      /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(code.trim())}`
    ),true              ?[]:void 0,import.meta.url);
    
    if (typeof this.loadedModule.update !== 'function') {
      throw new Error('Code must export an update function');
    }
    
    this.loadedCode = code;
  }

  async execute(elevators, floors) {
    if (!this.loadedModule) {
      throw new Error('No code loaded. Call loadCode() first.');
    }

    // Call the user's update function
    return this.loadedModule.update(elevators, floors);
  }

  validateCode(code) {
    // Basic validation - could be enhanced with more checks
    if (!code || code.trim().length === 0) {
      throw new Error('Code cannot be empty');
    }
    
    if (!code.includes('export') || !code.includes('update')) {
      throw new Error('Code must export an update function');
    }
  }

  getDefaultTemplate() {
    return `export function update(elevators, floors) {
    // Your elevator control logic here
    
    const elevator = elevators[0]; // Let's work with the first elevator
    
    // Whenever someone presses the button on a floor, tell elevator to go there
    floors.forEach(floor => {
        floor.on('buttonPressed', () => {
            elevator.goToFloor(floor.level);
        });
    });
    
    // When the elevator is idle (has no more queued destinations), 
    // go to all the floors that have passengers waiting
    elevator.on('idle', () => {
        floors.forEach(floor => {
            if (floor.buttons.up || floor.buttons.down) {
                elevator.goToFloor(floor.level);
            }
        });
    });
}`;
  }

  getLanguage() {
    return 'javascript';
  }

  dispose() {
    this.loadedModule = null;
    this.loadedCode = null;
  }
}

export { JavaScriptRuntime };