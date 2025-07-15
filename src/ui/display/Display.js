export class Display extends EventTarget {
  constructor() {
    super();
  }

  tick(dt) {}

  syncUIComponent() {
    this.dispatchEvent(new CustomEvent("new_display_state"));
  }
}
