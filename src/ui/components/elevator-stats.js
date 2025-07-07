export class ElevatorStats extends HTMLElement {
  static get observedAttributes() {
    return [
      "transported",
      "elapsed-time",
      "transported-per-sec",
      "avg-wait-time",
      "max-wait-time",
      "move-count",
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._world = null;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this._world) {
      this._world.removeEventListener("stats_display_changed", this._updateHandler);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.updateStat(name, newValue);
  }

  set world(world) {
    // Disconnect from previous world
    if (this._world) {
      this._world.removeEventListener("stats_display_changed", this._updateHandler);
    }

    this._world = world;

    if (world) {
      this._updateHandler = () => this.updateFromWorld(world);
      world.addEventListener("stats_display_changed", this._updateHandler);
      world.dispatchEvent(new CustomEvent("stats_display_changed"));
    }
  }

  updateFromWorld(world) {
    this.setAttribute("transported", world.transportedCounter);
    this.setAttribute("elapsed-time", world.elapsedTime.toFixed(0) + "s");
    this.setAttribute(
      "transported-per-sec",
      world.transportedPerSec.toPrecision(3),
    );
    this.setAttribute("avg-wait-time", world.avgWaitTime.toFixed(1) + "s");
    this.setAttribute("max-wait-time", world.maxWaitTime.toFixed(1) + "s");
    this.setAttribute("move-count", world.moveCount);
  }

  updateStat(name, value) {
    const elem = this.shadowRoot.querySelector(`[data-stat="${name}"]`);
    if (elem) {
      elem.textContent = value || "";
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font: 12px Consolas, Monaco, monospace;
          color: #999;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          pointer-events: none;
        }

        .stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #504945; /* Gruvbox gray */
        }

        .key {
          color: #928374; /* Gruvbox gray */
        }

        .value {
          color: #ebdbb2; /* Gruvbox light1 */
        }
      </style>

      <div class="stat">
        <span class="key">Transported</span>
        <span class="value" data-stat="transported">${this.getAttribute("transported") || ""}</span>
      </div>
      <div class="stat">
        <span class="key">Elapsed time</span>
        <span class="value" data-stat="elapsed-time">${this.getAttribute("elapsed-time") || ""}</span>
      </div>
      <div class="stat">
        <span class="key">Transported/s</span>
        <span class="value" data-stat="transported-per-sec">${this.getAttribute("transported-per-sec") || ""}</span>
      </div>
      <div class="stat">
        <span class="key">Avg waiting time</span>
        <span class="value" data-stat="avg-wait-time">${this.getAttribute("avg-wait-time") || ""}</span>
      </div>
      <div class="stat">
        <span class="key">Max waiting time</span>
        <span class="value" data-stat="max-wait-time">${this.getAttribute("max-wait-time") || ""}</span>
      </div>
      <div class="stat">
        <span class="key" title="Number of floors that have been travelled by elevators">Moves</span>
        <span class="value" data-stat="move-count">${this.getAttribute("move-count") || ""}</span>
      </div>
    `;
  }
}

customElements.define("elevator-stats", ElevatorStats);
