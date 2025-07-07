export class ElevatorCar extends HTMLElement {
  static get observedAttributes() {
    return ['width', 'x-position', 'y-position', 'current-floor', 'up-indicator', 'down-indicator'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._elevator = null;
    this._floorButtons = [];
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  disconnectedCallback() {
    if (this._elevator) {
      this._elevator.off('new_display_state', this._displayStateHandler);
      this._elevator.off('new_current_floor', this._currentFloorHandler);
      this._elevator.off('floor_buttons_changed', this._floorButtonsHandler);
      this._elevator.off('indicatorstate_change', this._indicatorHandler);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.updateDisplay(name, newValue);
    }
  }

  set elevator(elevator) {
    if (this._elevator) {
      this._elevator.off('new_display_state', this._displayStateHandler);
      this._elevator.off('new_current_floor', this._currentFloorHandler);
      this._elevator.off('floor_buttons_changed', this._floorButtonsHandler);
      this._elevator.off('indicatorstate_change', this._indicatorHandler);
    }

    this._elevator = elevator;
    
    if (elevator) {
      // Set initial attributes
      this.setAttribute('width', elevator.width);
      this._floorButtons = [...elevator.buttons];
      
      // Display state handler
      this._displayStateHandler = () => {
        this.setAttribute('x-position', elevator.worldX);
        this.setAttribute('y-position', elevator.worldY);
      };
      
      // Current floor handler
      this._currentFloorHandler = (floor) => {
        this.setAttribute('current-floor', floor);
      };
      
      // Floor buttons handler
      this._floorButtonsHandler = (states, indexChanged) => {
        this._floorButtons = [...states];
        this.updateFloorButton(indexChanged, states[indexChanged]);
      };
      
      // Indicator state handler
      this._indicatorHandler = (indicatorStates) => {
        this.setAttribute('up-indicator', indicatorStates.up);
        this.setAttribute('down-indicator', indicatorStates.down);
      };
      
      // Attach listeners
      elevator.on('new_display_state', this._displayStateHandler);
      elevator.on('new_current_floor', this._currentFloorHandler);
      elevator.on('floor_buttons_changed', this._floorButtonsHandler);
      elevator.on('indicatorstate_change', this._indicatorHandler);
      
      // Trigger initial updates
      elevator.trigger('new_state', elevator);
      elevator.trigger('new_display_state', elevator);
      elevator.trigger('new_current_floor', elevator.currentFloor);
    }
  }

  attachEventListeners() {
    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.classList.contains('buttonpress') && this._elevator) {
        const floorNum = parseInt(e.target.textContent);
        this._elevator.pressFloorButton(floorNum);
      }
    });
  }

  updateDisplay(name, value) {
    switch (name) {
      case 'x-position':
      case 'y-position':
        this.updatePosition();
        break;
      case 'current-floor':
        const floorIndicator = this.shadowRoot.querySelector('.floor-number');
        if (floorIndicator) {
          floorIndicator.textContent = value;
        }
        break;
      case 'up-indicator':
        const upIndicator = this.shadowRoot.querySelector('.directionindicatorup .up');
        if (upIndicator) {
          upIndicator.classList.toggle('activated', value === 'true');
        }
        break;
      case 'down-indicator':
        const downIndicator = this.shadowRoot.querySelector('.directionindicatordown .down');
        if (downIndicator) {
          downIndicator.classList.toggle('activated', value === 'true');
        }
        break;
    }
  }

  updatePosition() {
    const x = this.getAttribute('x-position') || '0';
    const y = this.getAttribute('y-position') || '0';
    const style = `translate(${x}px,${y}px) translateZ(0)`;
    this.style.transform = style;
    this.style['-ms-transform'] = style;
    this.style['-webkit-transform'] = style;
  }

  updateFloorButton(index, isActive) {
    const buttons = this.shadowRoot.querySelectorAll('.buttonpress');
    if (buttons[index]) {
      buttons[index].classList.toggle('activated', isActive);
    }
  }

  renderFloorButtons() {
    return this._floorButtons
      .map((isActive, i) => `<span class="buttonpress ${isActive ? 'activated' : ''}">${i}</span>`)
      .join('');
  }

  render() {
    const width = this.getAttribute('width') || '60';
    const currentFloor = this.getAttribute('current-floor') || '0';
    const upActive = this.getAttribute('up-indicator') === 'true';
    const downActive = this.getAttribute('down-indicator') === 'true';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 0;
          left: 0;
          display: block;
          background-color: #4f8686;
          border: 2px solid white;
          height: 46px;
          z-index: 1;
          width: ${width}px;
        }

        .directionindicator {
          position: absolute;
          font-size: 10px;
          top: 3px;
        }

        .directionindicator.directionindicatorup {
          left: 2px;
        }

        .directionindicator.directionindicatordown {
          right: 2px;
        }

        .directionindicator .fa {
          color: rgba(255, 255, 255, 0.2);
        }

        .directionindicator .fa.activated {
          color: #33ff44;
        }

        .floorindicator {
          display: inline-block;
          position: absolute;
          width: 100%;
          font-size: 15px;
          text-align: center;
          color: rgba(255, 255, 255, 0.3);
        }

        .buttonindicator {
          display: inline-block;
          position: absolute;
          top: 15px;
          width: 95%;
          text-align: center;
          font-size: 8px;
          line-height: 8px;
          color: rgba(255, 255, 255, 0.3);
        }

        .buttonpress {
          cursor: pointer;
          margin: 0;
          display: inline-block;
        }

        .buttonpress.activated {
          color: #33ff44;
        }
      </style>
      
      <span class="directionindicator directionindicatorup">
        <i class="fa fa-arrow-circle-up up ${upActive ? 'activated' : ''}"></i>
      </span>
      <span class="floorindicator">
        <span class="floor-number">${currentFloor}</span>
      </span>
      <span class="directionindicator directionindicatordown">
        <i class="fa fa-arrow-circle-down down ${downActive ? 'activated' : ''}"></i>
      </span>
      <span class="buttonindicator">
        ${this.renderFloorButtons()}
      </span>
    `;

    this.updatePosition();
  }
}

customElements.define('elevator-car', ElevatorCar);