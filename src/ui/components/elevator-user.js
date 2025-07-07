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
          color: white;
          text-shadow: 0 1px 3px black;
        }

        .user-icon.happy {
          /* Future state */
        }

        .user-icon.frustrated {
          color: yellow;
        }

        .user-icon.disappointed {
          color: red;
        }

        .user-icon.leaving {
          color: #eee;
        }
      </style>
      
      <i class="user-icon fa fa-${userType} ${state}"></i>
    `;

    this.updatePosition();
  }
}

customElements.define('elevator-user', ElevatorUser);