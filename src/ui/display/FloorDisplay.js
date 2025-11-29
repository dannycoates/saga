import { Display } from "./Display.js";

export class FloorDisplay extends Display {
  constructor(floorState, yPosition) {
    super();
    this.state = floorState;
    this.yPosition = yPosition;
    this._prevButtonState = { up: false, down: false };
  }

  get level() {
    return this.state ? this.state.level : 0;
  }

  get buttons() {
    return this.state ? this.state.buttons : { up: false, down: false };
  }

  get floor() {
    // Compatibility getter
    return this.state;
  }

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

  getSpawnPosY() {
    return this.yPosition + 30;
  }

  updateFromState(floorState) {
    this.state = floorState;
    this.checkButtonStateChange();
  }

  tick(dt) {
    // Animation tick if needed
  }
}
