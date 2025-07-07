
export class Floor extends EventTarget {
  constructor(floorLevel, yPosition, errorHandler) {
    super();

    this.level = floorLevel;
    this.yPosition = yPosition;
    this.buttons = { up: false, down: false };
    this.errorHandler = errorHandler;
  }

  // Helper method to safely trigger events with error handling
  tryTrigger(event, ...args) {
    try {
      this.dispatchEvent(new CustomEvent(event, { detail: args.length === 1 ? args[0] : args }));
    } catch (e) {
      this.errorHandler(e);
    }
  }

  pressUpButton() {
    const prev = this.buttons.up;
    this.buttons.up = true;
    if (prev !== this.buttons.up) {
      this.tryTrigger("buttonstate_change", this.buttons);
      this.tryTrigger("up_button_pressed", this);
    }
  }

  pressDownButton() {
    const prev = this.buttons.down;
    this.buttons.down = true;
    if (prev !== this.buttons.down) {
      this.tryTrigger("buttonstate_change", this.buttons);
      this.tryTrigger("down_button_pressed", this);
    }
  }

  elevatorAvailable(elevator) {
    if (elevator.goingUpIndicator && this.buttons.up) {
      this.buttons.up = false;
      this.tryTrigger("buttonstate_change", this.buttons);
    }
    if (elevator.goingDownIndicator && this.buttons.down) {
      this.buttons.down = false;
      this.tryTrigger("buttonstate_change", this.buttons);
    }
  }

  getSpawnPosY() {
    return this.yPosition + 30;
  }

  floorNum() {
    return this.level;
  }
}
