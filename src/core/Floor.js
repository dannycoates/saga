export class Floor extends EventTarget {
  constructor(floorLevel, yPosition) {
    super();

    this.level = floorLevel;
    this.yPosition = yPosition;
    this.buttons = { up: false, down: false };
  }

  // Helper method to safely trigger events with error handling
  trigger(event, ...args) {
    this.dispatchEvent(
      new CustomEvent(event, { detail: args.length === 1 ? args[0] : args }),
    );
  }

  pressUpButton() {
    const prev = this.buttons.up;
    this.buttons.up = true;
    if (prev !== this.buttons.up) {
      this.trigger("buttonstate_change", this.buttons);
      this.trigger("up_button_pressed", this);
    }
  }

  pressDownButton() {
    const prev = this.buttons.down;
    this.buttons.down = true;
    if (prev !== this.buttons.down) {
      this.trigger("buttonstate_change", this.buttons);
      this.trigger("down_button_pressed", this);
    }
  }

  elevatorAvailable(elevator) {
    if (elevator.goingUpIndicator && this.buttons.up) {
      this.buttons.up = false;
      this.trigger("buttonstate_change", this.buttons);
    }
    if (elevator.goingDownIndicator && this.buttons.down) {
      this.buttons.down = false;
      this.trigger("buttonstate_change", this.buttons);
    }
  }

  getSpawnPosY() {
    return this.yPosition + 30;
  }

  floorNum() {
    return this.level;
  }

  toAPI() {
    return {
      buttons: this.buttons,
      level: this.level,
    };
  }
}
