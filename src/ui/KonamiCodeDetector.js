/**
 * Konami Code detector utility
 * Detects the classic konami code: ↑↑↓↓←→←→BA
 */
export class KonamiCodeDetector extends EventTarget {
  constructor() {
    super();
    this.sequence = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "KeyB",
      "KeyA",
    ];
    this.userInput = [];
    this.timeoutDuration = 2000;
    this.timeout = null;

    this.boundKeyHandler = this.handleKeyPress.bind(this);
    this.startListening();
  }

  startListening() {
    document.addEventListener("keydown", this.boundKeyHandler);
  }

  stopListening() {
    document.removeEventListener("keydown", this.boundKeyHandler);
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
  }

  handleKeyPress(event) {
    // Clear previous timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    // Add the key to user input
    this.userInput.push(event.code);

    // Check if we've exceeded the sequence length
    if (this.userInput.length > this.sequence.length) {
      this.userInput = this.userInput.slice(-this.sequence.length);
    }

    // Check if current input matches the sequence so far
    const isValidSequence = this.userInput.every(
      (key, index) => key === this.sequence[index],
    );

    if (!isValidSequence) {
      // Reset if the sequence doesn't match
      this.userInput = [event.code];
      // Check if the first key is valid
      if (event.code !== this.sequence[0]) {
        this.userInput = [];
      }
    } else if (this.userInput.length === this.sequence.length) {
      // Complete sequence detected!
      this.dispatchEvent(
        new CustomEvent("konamicode", {
          detail: { sequence: [...this.userInput] },
        }),
      );
      this.userInput = [];
      return;
    }

    // Set timeout to reset sequence
    this.timeout = setTimeout(() => {
      this.userInput = [];
    }, this.timeoutDuration);
  }

  dispose() {
    this.stopListening();
  }
}
