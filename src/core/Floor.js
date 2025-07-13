export class Floor {
  constructor(floorLevel) {
    this.level = floorLevel;
    this.buttons = { up: false, down: false };
  }

  pressButton(direction) {
    this.buttons[direction] = true;
  }

  clearButton(direction) {
    this.buttons[direction] = false;
  }
}
