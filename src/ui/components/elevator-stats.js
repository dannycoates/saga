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
      this._world.removeEventListener("stats_changed", this._updateHandler);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.updateStat(name, newValue);
  }

  set world(world) {
    // Disconnect from previous world
    if (this._world) {
      this._world.removeEventListener("stats_changed", this._updateHandler);
    }

    this._world = world;

    if (world) {
      this._updateHandler = (e) => this.updateFromWorld(e.detail);
      world.addEventListener("stats_changed", this._updateHandler);
      this.updateFromWorld(world.stats);
    }
  }

  updateFromWorld(stats) {
    this.setAttribute("transported", stats.transportedCounter);
    this.setAttribute("elapsed-time", stats.elapsedTime.toFixed(0) + "s");
    this.setAttribute(
      "transported-per-sec",
      stats.transportedPerSec.toFixed(3),
    );
    this.setAttribute("avg-wait-time", stats.avgWaitTime.toFixed(1) + "s");
    this.setAttribute("max-wait-time", stats.maxWaitTime.toFixed(1) + "s");
    this.setAttribute("move-count", stats.moveCount);
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
          flex-direction: row;
          justify-content: end;
          gap: 1rem;
          font: 12px Consolas, Monaco, monospace;
          color: #999;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          pointer-events: none;
        }

        .stat {
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
