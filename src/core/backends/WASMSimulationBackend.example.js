import { SimulationBackend } from "../SimulationBackend.js";

/**
 * Example WebAssembly simulation backend implementation
 * This shows how to implement a new backend that could run the simulation in WASM
 */
export class WASMSimulationBackend extends SimulationBackend {
  constructor() {
    super();
    this.wasmModule = null;
    this.memory = null;
    this.initialized = false;
  }

  async initialize(config) {
    // Load WASM module
    const response = await fetch("/simulation.wasm");
    const bytes = await response.arrayBuffer();

    // Initialize WASM with shared memory
    this.memory = new WebAssembly.Memory({
      initial: 256,
      maximum: 512,
      shared: true,
    });

    const importObject = {
      env: {
        memory: this.memory,
        // Callbacks for events
        onStateChanged: (ptr, len) => this.handleStateChanged(ptr, len),
        onPassengerSpawned: (ptr, len) => this.handlePassengerSpawned(ptr, len),
        onStatsChanged: (ptr, len) => this.handleStatsChanged(ptr, len),
        // Math functions WASM might need
        random: () => Math.random(),
        floor: Math.floor,
        ceil: Math.ceil,
      },
    };

    const wasmModule = await WebAssembly.instantiate(bytes, importObject);
    this.wasmModule = wasmModule.instance;

    // Initialize simulation in WASM
    this.wasmModule.exports.initializeSimulation(
      config.floorCount,
      config.elevatorCount,
      config.spawnRate,
      config.speedFloorsPerSec,
    );

    // Set capacities
    if (config.elevatorCapacities) {
      const capacitiesPtr = this.wasmModule.exports.allocateArray(
        config.elevatorCapacities.length,
      );
      const capacitiesArray = new Uint32Array(
        this.memory.buffer,
        capacitiesPtr,
        config.elevatorCapacities.length,
      );
      capacitiesArray.set(config.elevatorCapacities);
      this.wasmModule.exports.setElevatorCapacities(
        capacitiesPtr,
        config.elevatorCapacities.length,
      );
    }

    this.initialized = true;
  }

  tick(dt) {
    if (!this.initialized) {
      throw new Error("WASM simulation not initialized");
    }

    // Call WASM tick function
    this.wasmModule.exports.tick(dt);
  }

  getState() {
    if (!this.initialized) {
      throw new Error("WASM simulation not initialized");
    }

    // Get state from WASM memory
    const statePtr = this.wasmModule.exports.getState();
    const stateLen = this.wasmModule.exports.getStateLength();

    // Deserialize state from WASM memory
    const stateBytes = new Uint8Array(this.memory.buffer, statePtr, stateLen);
    const stateJson = new TextDecoder().decode(stateBytes);

    return JSON.parse(stateJson);
  }

  async callUserCode(codeObj) {
    if (!this.initialized) {
      throw new Error("WASM simulation not initialized");
    }

    // Get current state for user code
    const state = this.getState();

    // Create elevator and floor APIs
    const elevatorAPIs = state.elevators.map((elevator) => ({
      currentFloor: elevator.currentFloor,
      destinationFloor: elevator.destinationFloor,
      pressedFloorButtons: elevator.buttons
        .map((pressed, floor) => (pressed ? floor : null))
        .filter((floor) => floor !== null),
      percentFull: elevator.percentFull,
      goToFloor: (floor) => {
        // Call WASM function to set elevator destination
        this.wasmModule.exports.setElevatorDestination(elevator.index, floor);
      },
    }));

    const floorAPIs = state.floors.map((floor) => ({
      buttons: { ...floor.buttons },
      level: floor.level,
    }));

    // Execute user code
    await codeObj.tick(elevatorAPIs, floorAPIs);
  }

  getStats() {
    if (!this.initialized) {
      throw new Error("WASM simulation not initialized");
    }

    return {
      transportedCount: this.wasmModule.exports.getTransportedCount(),
      transportedPerSec: this.wasmModule.exports.getTransportedPerSec(),
      avgWaitTime: this.wasmModule.exports.getAvgWaitTime(),
      maxWaitTime: this.wasmModule.exports.getMaxWaitTime(),
      moveCount: this.wasmModule.exports.getMoveCount(),
      elapsedTime: this.wasmModule.exports.getElapsedTime(),
    };
  }

  hasEnded() {
    if (!this.initialized) {
      return true;
    }

    return this.wasmModule.exports.hasEnded() === 1;
  }

  cleanup() {
    if (this.initialized && this.wasmModule) {
      this.wasmModule.exports.cleanup();
      this.wasmModule = null;
      this.memory = null;
      this.initialized = false;
    }
  }

  // Helper methods to handle WASM callbacks
  handleStateChanged(ptr, len) {
    const stateBytes = new Uint8Array(this.memory.buffer, ptr, len);
    const stateJson = new TextDecoder().decode(stateBytes);
    const state = JSON.parse(stateJson);

    this.dispatchEvent(new CustomEvent("state_changed", { detail: state }));
  }

  handlePassengerSpawned(ptr, len) {
    const passengerBytes = new Uint8Array(this.memory.buffer, ptr, len);
    const passengerJson = new TextDecoder().decode(passengerBytes);
    const passenger = JSON.parse(passengerJson);

    this.dispatchEvent(
      new CustomEvent("passenger_spawned", { detail: { passenger } }),
    );
  }

  handleStatsChanged(ptr, len) {
    const statsBytes = new Uint8Array(this.memory.buffer, ptr, len);
    const statsJson = new TextDecoder().decode(statsBytes);
    const stats = JSON.parse(statsJson);

    this.dispatchEvent(new CustomEvent("stats_changed", { detail: stats }));
  }
}

/**
 * Example of how to use different backends:
 *
 * // Use JavaScript backend (default)
 * const jsBackend = new JSSimulationBackend();
 *
 * // Use WebAssembly backend
 * const wasmBackend = new WASMSimulationBackend();
 *
 * // Use Web Worker backend (future)
 * const workerBackend = new WorkerSimulationBackend();
 *
 * // All backends implement the same interface
 * backend.initialize(config);
 * backend.tick(dt);
 * const state = backend.getState();
 */
