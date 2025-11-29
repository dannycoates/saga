import { Display } from "./Display.js";

/**
 * @typedef {Object} FloorState
 * @property {number} level - Floor number
 * @property {{up: boolean, down: boolean}} buttons - Call button states
 */

/**
 * Display representation of a floor.
 * Tracks button states and emits events on changes.
 *
 * @extends Display
 * @fires FloorDisplay#button_state_change - Emitted when call buttons change state
 */
export class FloorDisplay extends Display {
  /**
   * Creates a floor display.
   * @param {FloorState} floorState - Initial floor state
   * @param {number} yPosition - Y position in pixels
   */
  constructor(floorState, yPosition) {
    super();
    /** @type {FloorState} Current floor state */
    this.state = floorState;
    /** @type {number} Y position in pixels */
    this.yPosition = yPosition;
    /** @type {{up: boolean, down: boolean}} Previous button state for change detection */
    this._prevButtonState = { up: false, down: false };
  }

  /**
   * Floor number.
   * @type {number}
   * @readonly
   */
  get level() {
    return this.state ? this.state.level : 0;
  }

  /**
   * Current button states.
   * @type {{up: boolean, down: boolean}}
   * @readonly
   */
  get buttons() {
    return this.state ? this.state.buttons : { up: false, down: false };
  }

  /**
   * Current floor state (compatibility getter).
   * @type {FloorState}
   * @readonly
   */
  get floor() {
    return this.state;
  }

  /**
   * Checks for button state changes and emits event if changed.
   * @private
   * @returns {void}
   */
  checkButtonStateChange() {
    if (!this.state) return;

    if (
      this._prevButtonState.up !== this.state.buttons.up ||
      this._prevButtonState.down !== this.state.buttons.down
    ) {
      this._prevButtonState = { ...this.state.buttons };
      this.dispatchEvent(
        new CustomEvent("button_state_change", { detail: this.state.buttons }),
      );
    }
  }

  /**
   * Gets the Y position for spawning passengers on this floor.
   * @returns {number} Y position in pixels
   */
  getSpawnPosY() {
    return this.yPosition + 30;
  }

  /**
   * Updates display from new floor state.
   * @param {FloorState} floorState - New state
   * @returns {void}
   */
  updateFromState(floorState) {
    this.state = floorState;
    this.checkButtonStateChange();
  }

  /**
   * Updates display each animation frame.
   * @override
   * @param {number} dt - Time delta in seconds
   * @returns {void}
   */
  tick(dt) {
    // Animation tick if needed
  }
}
