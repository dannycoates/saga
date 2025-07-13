export class Display extends EventTarget {
  constructor() {
    super();
  }

  tick(dt) {}

  updateDisplayPosition() {
    this.dispatchEvent(new CustomEvent("new_display_state"));
  }
}
