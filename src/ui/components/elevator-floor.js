export class ElevatorFloor extends HTMLElement {
  static get observedAttributes() {
    return ['floor-number', 'y-position', 'up-active', 'down-active', 'hide-up', 'hide-down'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._floor = null;
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  disconnectedCallback() {
    if (this._floor) {
      this._floor.removeEventListener('buttonstate_change', this._buttonStateHandler);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.updateDisplay(name, newValue);
    }
  }

  set floor(floor) {
    if (this._floor) {
      this._floor.removeEventListener('buttonstate_change', this._buttonStateHandler);
    }

    this._floor = floor;
    
    if (floor) {
      // Set initial attributes
      this.setAttribute('floor-number', floor.level);
      this.setAttribute('y-position', floor.yPosition);
      
      // Listen for button state changes
      this._buttonStateHandler = (event) => {
        const buttons = event.detail || event;
        this.setAttribute('up-active', buttons.up);
        this.setAttribute('down-active', buttons.down);
      };
      floor.addEventListener('buttonstate_change', this._buttonStateHandler);
    }
  }

  attachEventListeners() {
    const upButton = this.shadowRoot.querySelector('.up');
    const downButton = this.shadowRoot.querySelector('.down');

    upButton?.addEventListener('click', () => {
      if (this._floor) {
        this._floor.pressUpButton();
      }
    });

    downButton?.addEventListener('click', () => {
      if (this._floor) {
        this._floor.pressDownButton();
      }
    });
  }

  updateDisplay(name, value) {
    switch (name) {
      case 'y-position':
        this.style.top = value + 'px';
        break;
      case 'up-active':
        const upBtn = this.shadowRoot.querySelector('.up');
        if (upBtn) {
          upBtn.classList.toggle('activated', value === 'true');
        }
        break;
      case 'down-active':
        const downBtn = this.shadowRoot.querySelector('.down');
        if (downBtn) {
          downBtn.classList.toggle('activated', value === 'true');
        }
        break;
      case 'hide-up':
        const upBtnHide = this.shadowRoot.querySelector('.up');
        if (upBtnHide) {
          upBtnHide.classList.toggle('invisible', value === 'true');
        }
        break;
      case 'hide-down':
        const downBtnHide = this.shadowRoot.querySelector('.down');
        if (downBtnHide) {
          downBtnHide.classList.toggle('invisible', value === 'true');
        }
        break;
    }
  }

  render() {
    const floorNumber = this.getAttribute('floor-number') || '0';
    const yPosition = this.getAttribute('y-position') || '0';
    const upActive = this.getAttribute('up-active') === 'true';
    const downActive = this.getAttribute('down-active') === 'true';
    const hideUp = this.getAttribute('hide-up') === 'true';
    const hideDown = this.getAttribute('hide-down') === 'true';

    // Set position on host element
    this.style.top = yPosition + 'px';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: absolute;
          width: 100%;
          height: 49px;
          background-color: rgba(255, 255, 255, 0.1);
          background: linear-gradient(
            rgba(255, 255, 255, 0.1),
            rgba(255, 255, 255, 0.2),
            rgba(255, 255, 255, 0.24),
            rgba(255, 255, 255, 0.1)
          );
          border-bottom: 1px solid #333;
          display: block;
        }

        .floornumber {
          position: absolute;
          color: rgba(255, 255, 255, 0.15);
          font-size: 32px;
          line-height: 50px;
          padding-left: 10px;
        }

        .buttonindicator {
          cursor: pointer;
          line-height: 50px;
          padding-left: 50px;
          color: rgba(255, 255, 255, 0.2);
        }

        .buttonindicator svg {
          width: 22px;
          height: 22px;
          vertical-align: middle;
          margin: 0 2px;
          fill: currentColor;
        }

        .buttonindicator .activated {
          color: rgba(55, 255, 55, 1);
        }

        .invisible {
          visibility: hidden;
        }
      </style>
      
      <span class="floornumber">${floorNumber}</span>
      <span class="buttonindicator">
        <svg class="up ${upActive ? 'activated' : ''} ${hideUp ? 'invisible' : ''}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="7" fill="currentColor"/>
          <path d="M8 11 L8 5 M5 8 L8 5 L11 8" fill="none" stroke="#4e585f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg class="down ${downActive ? 'activated' : ''} ${hideDown ? 'invisible' : ''}" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="7" fill="currentColor"/>
          <path d="M8 5 L8 11 M5 8 L8 11 L11 8" fill="none" stroke="#4e585f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    `;
  }
}

customElements.define('elevator-floor', ElevatorFloor);