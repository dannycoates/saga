export class ElevatorUser extends HTMLElement {
  static get observedAttributes() {
    return ['user-type', 'x-position', 'y-position', 'state'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this._user) {
      this._user.off('new_display_state', this._displayStateHandler);
      this._user.off('removed', this._removedHandler);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.updateDisplay(name, newValue);
    }
  }

  set user(user) {
    if (this._user) {
      this._user.off('new_display_state', this._displayStateHandler);
      this._user.off('removed', this._removedHandler);
    }

    this._user = user;
    
    if (user) {
      // Set initial attributes
      this.setAttribute('user-type', user.displayType);
      this.setAttribute('state', user.done ? 'leaving' : '');
      
      // Display state handler
      this._displayStateHandler = () => {
        this.setAttribute('x-position', user.worldX);
        this.setAttribute('y-position', user.worldY);
        if (user.done) {
          this.setAttribute('state', 'leaving');
        }
      };
      
      // Removed handler
      this._removedHandler = () => {
        this.remove();
      };
      
      // Attach listeners
      user.on('new_display_state', this._displayStateHandler);
      user.on('removed', this._removedHandler);
      
      // Update initial position
      this._displayStateHandler();
    }
  }

  updateDisplay(name, value) {
    switch (name) {
      case 'x-position':
      case 'y-position':
        this.updatePosition();
        break;
      case 'state':
        const icon = this.shadowRoot.querySelector('.user-icon');
        if (icon) {
          icon.classList.toggle('leaving', value === 'leaving');
        }
        break;
      case 'user-type':
        const userIcon = this.shadowRoot.querySelector('.user-icon');
        if (userIcon) {
          // Update the Font Awesome class
          userIcon.className = `user-icon fa fa-${value} ${this.getAttribute('state') || ''}`;
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

  getUserSvg(userType) {
    const svgMap = {
      male: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="7" r="4"/>
        <path d="M12 14c-4 0-7 2-7 5v2h14v-2c0-3-3-5-7-5z"/>
      </svg>`,
      female: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="7" r="4"/>
        <path d="M12 14c-4 0-7 2-7 5v2h14v-2c0-3-3-5-7-5z"/>
        <path d="M9 3c0-1 1-2 3-2s3 1 3 2c0 .5-1 4-1 4h-4s-1-3.5-1-4z"/>
      </svg>`,
      child: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="3"/>
        <path d="M12 13c-3 0-5 1.5-5 3.5v1.5h10v-1.5c0-2-2-3.5-5-3.5z"/>
      </svg>`
    };
    return svgMap[userType] || svgMap.male;
  }

  render() {
    const userType = this.getAttribute('user-type') || 'male';
    const state = this.getAttribute('state') || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 0;
          left: 0;
          display: block;
          z-index: 2;
        }

        .user-icon {
          display: block;
          width: 24px;
          height: 24px;
        }

        .user-icon svg {
          width: 100%;
          height: 100%;
          fill: white;
          filter: drop-shadow(0 1px 3px black);
        }

        .user-icon.happy svg {
          /* Future state */
        }

        .user-icon.frustrated svg {
          fill: yellow;
        }

        .user-icon.disappointed svg {
          fill: red;
        }

        .user-icon.leaving svg {
          fill: #eee;
        }
      </style>
      <span class="user-icon ${state}">
        ${this.getUserSvg(userType)}
      </span>
    `;

    this.updatePosition();
  }
}

customElements.define('elevator-user', ElevatorUser);