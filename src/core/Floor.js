/**
 * Represents a floor in the building with up/down call buttons.
 */
export class Floor {
  /**
   * Creates a new floor instance.
   * @param {number} floorLevel - Floor number (0-indexed)
   */
  constructor(floorLevel) {
    /** @type {number} Floor level number */
    this.level = floorLevel;
    /** @type {{up: boolean, down: boolean}} Button states */
    this.buttons = { up: false, down: false };
  }

  /**
   * Activates a call button on this floor.
   * @param {'up' | 'down'} direction - Button direction to press
   * @returns {void}
   */
  pressButton(direction) {
    this.buttons[direction] = true;
  }

  /**
   * Deactivates a call button on this floor.
   * @param {'up' | 'down'} direction - Button direction to clear
   * @returns {void}
   */
  clearButton(direction) {
    this.buttons[direction] = false;
  }

  /**
   * Serializes floor state for simulation snapshots.
   * @returns {{level: number, buttons: {up: boolean, down: boolean}}}
   */
  toJSON() {
    return {
      level: this.level,
      buttons: { ...this.buttons }
    };
  }
}
