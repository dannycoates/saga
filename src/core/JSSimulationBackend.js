import { SimulationBackend } from "./SimulationBackend.js";
import { SimulationCore } from "./SimulationCore.js";

/**
 * JavaScript implementation of the simulation backend
 */
export class JSSimulationBackend extends SimulationBackend {
  constructor() {
    super();
    this.simulation = null;
  }

  initialize(config) {
    // Dispose of any existing simulation
    if (this.simulation) {
      this.simulation.dispose();
    }

    // Create new simulation core
    this.simulation = new SimulationCore(config);

    // Forward events from simulation core
    this.simulation.addEventListener("state_changed", (e) => {
      this.dispatchEvent(new CustomEvent("state_changed", { detail: e.detail }));
    });

    this.simulation.addEventListener("stats_changed", (e) => {
      this.dispatchEvent(new CustomEvent("stats_changed", { detail: e.detail }));
    });

    this.simulation.addEventListener("passenger_spawned", (e) => {
      this.dispatchEvent(new CustomEvent("passenger_spawned", { detail: e.detail }));
    });

    this.simulation.addEventListener("passengers_exited", (e) => {
      this.dispatchEvent(new CustomEvent("passengers_exited", { detail: e.detail }));
    });

    this.simulation.addEventListener("passengers_boarded", (e) => {
      this.dispatchEvent(new CustomEvent("passengers_boarded", { detail: e.detail }));
    });
  }

  tick(dt) {
    if (!this.simulation) {
      throw new Error("Simulation not initialized. Call initialize() first.");
    }
    this.simulation.tick(dt);
  }

  getState() {
    if (!this.simulation) {
      throw new Error("Simulation not initialized. Call initialize() first.");
    }
    return this.simulation.getState();
  }

  async callUserCode(codeObj) {
    if (!this.simulation) {
      throw new Error("Simulation not initialized. Call initialize() first.");
    }
    try {
      await this.simulation.callUserCode(codeObj);
    } catch (error) {
      this.dispatchEvent(new CustomEvent("usercode_error", { detail: error }));
      throw error;
    }
  }

  getStats() {
    if (!this.simulation) {
      throw new Error("Simulation not initialized. Call initialize() first.");
    }
    return this.simulation.getStats();
  }

  hasEnded() {
    if (!this.simulation) {
      return true;
    }
    return this.simulation.challengeEnded;
  }

  dispose() {
    if (this.simulation) {
      this.simulation.dispose();
      this.simulation = null;
    }
  }
}