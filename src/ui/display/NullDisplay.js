import { Display } from "./Display.js";

export class NullDisplay extends Display {
  constructor() {
    super();
  }

  tick(dt) {}
}
