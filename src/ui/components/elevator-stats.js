export class ElevatorStats extends HTMLElement {
  static get observedAttributes() {
    return ['transported', 'elapsed-time', 'transported-per-sec', 
            'avg-wait-time', 'max-wait-time', 'move-count'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._world = null;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this._world) {
      this._world.off('stats_display_changed', this._updateHandler);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this.updateStat(name, newValue);
  }

  set world(world) {
    // Disconnect from previous world
    if (this._world) {
      this._world.off('stats_display_changed', this._updateHandler);
    }

    this._world = world;
    
    if (world) {
      this._updateHandler = () => this.updateFromWorld(world);
      world.on('stats_display_changed', this._updateHandler);
      world.trigger('stats_display_changed');
    }
  }

  updateFromWorld(world) {
    this.setAttribute('transported', world.transportedCounter);
    this.setAttribute('elapsed-time', world.elapsedTime.toFixed(0) + 's');
    this.setAttribute('transported-per-sec', world.transportedPerSec.toPrecision(3));
    this.setAttribute('avg-wait-time', world.avgWaitTime.toFixed(1) + 's');
    this.setAttribute('max-wait-time', world.maxWaitTime.toFixed(1) + 's');
    this.setAttribute('move-count', world.moveCount);
  }

  updateStat(name, value) {
    const elem = this.shadowRoot.querySelector(`[data-stat="${name}"]`);
    if (elem) {
      elem.textContent = value || '';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font: 12px Consolas, Monaco, monospace;
          line-height: 10px;
          color: #999;
          position: absolute;
          top: 0;
          right: 0px;
          width: 240px;
          height: 200px;
          padding: 20px;
          z-index: 1;
          box-sizing: content-box;
          display: block;
          pointer-events: none;
        }

        .stat {
          border-bottom: 1px solid #444;
          position: absolute;
          display: block;
          width: 240px;
          height: 10px;
        }

        .key {
          float: left;
        }

        .value {
          float: right;
          color: #fff;
        }
      </style>
      
      <div class="stat" style="top: 20px">
        <span class="key">Transported</span>
        <span class="value" data-stat="transported">${this.getAttribute('transported') || ''}</span>
      </div>
      <div class="stat" style="top: 40px">
        <span class="key">Elapsed time</span>
        <span class="value" data-stat="elapsed-time">${this.getAttribute('elapsed-time') || ''}</span>
      </div>
      <div class="stat" style="top: 60px">
        <span class="key">Transported/s</span>
        <span class="value" data-stat="transported-per-sec">${this.getAttribute('transported-per-sec') || ''}</span>
      </div>
      <div class="stat" style="top: 80px">
        <span class="key">Avg waiting time</span>
        <span class="value" data-stat="avg-wait-time">${this.getAttribute('avg-wait-time') || ''}</span>
      </div>
      <div class="stat" style="top: 100px">
        <span class="key">Max waiting time</span>
        <span class="value" data-stat="max-wait-time">${this.getAttribute('max-wait-time') || ''}</span>
      </div>
      <div class="stat" style="top: 120px">
        <span class="key" title="Number of floors that have been travelled by elevators">Moves</span>
        <span class="value" data-stat="move-count">${this.getAttribute('move-count') || ''}</span>
      </div>
    `;
  }
}

customElements.define('elevator-stats', ElevatorStats);