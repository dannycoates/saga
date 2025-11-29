import { ViewModel } from "./ViewModel.js";

export class NullViewModel extends ViewModel {
  constructor() {
    super();
  }

  tick(dt) {}
}
