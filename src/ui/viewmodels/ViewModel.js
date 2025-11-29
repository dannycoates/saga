/**
 * Base class for all view model objects.
 * Provides event dispatching for UI updates.
 *
 * @extends EventTarget
 * @fires ViewModel#new_display_state - Emitted when display state changes
 */
export class ViewModel extends EventTarget {
  constructor() {
    super();
  }

  /**
   * Updates the display for one animation frame.
   * Override in subclasses to implement animation logic.
   * @param {number} dt - Time delta in seconds
   * @returns {void}
   */
  tick(dt) {}

  /**
   * Notifies UI components that display state has changed.
   * Emits new_display_state event for UI components to react to.
   * @returns {void}
   */
  syncUIComponent() {
    this.dispatchEvent(new CustomEvent("new_display_state"));
  }
}
