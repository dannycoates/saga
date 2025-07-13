import { Display } from "./Display.js";

export class FloorDisplay extends Display {
  constructor(model, yPosition) {
    super();
    this.floor = model;
    this.yPosition = yPosition;
    this._prevButtonState = { up: false, down: false };
  }

  get level() {
    return this.floor.level;
  }

  get buttons() {
    return this.floor.buttons;
  }

  checkButtonStateChange() {
    if (
      this._prevButtonState.up !== this.floor.buttons.up ||
      this._prevButtonState.down !== this.floor.buttons.down
    ) {
      this._prevButtonState = { ...this.floor.buttons };
      this.dispatchEvent(
        new CustomEvent("buttonstate_change", { detail: this.floor.buttons }),
      );
    }
  }

  getSpawnPosY() {
    return this.yPosition + 30;
  }

  tick(dt) {
    this.checkButtonStateChange();
  }
}
