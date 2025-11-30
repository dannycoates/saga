/**
 * Event bus for application-wide event communication.
 * Uses namespaced event names (e.g., "simulation:state_changed").
 * @extends EventTarget
 */
export class EventBus extends EventTarget {
  /**
   * Emits an event on the bus.
   * @param {string} eventName - Namespaced event name
   * @param {any} [detail] - Event detail data
   */
  emit(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  /**
   * Subscribes to an event.
   * @param {string} eventName - Namespaced event name
   * @param {(event: CustomEvent) => void} handler - Event handler
   * @param {{ signal?: AbortSignal }} [options] - Options with AbortSignal
   */
  on(eventName, handler, options) {
    this.addEventListener(eventName, handler, options);
  }

  /**
   * Removes an event listener.
   * @param {string} eventName - Namespaced event name
   * @param {(event: CustomEvent) => void} handler - Handler to remove
   */
  off(eventName, handler) {
    this.removeEventListener(eventName, handler);
  }
}
