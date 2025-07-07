export class CodeStatus extends HTMLElement {
  static get observedAttributes() {
    return ['error-message', 'has-error'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  setError(error) {
    if (error) {
      console.log(error);
      let errorMessage = error;
      
      if (error.stack) {
        errorMessage = error.stack;
        errorMessage = errorMessage.replace(/\n/g, '<br>');
      }
      
      this.setAttribute('has-error', 'true');
      this.setAttribute('error-message', errorMessage);
    } else {
      this.setAttribute('has-error', 'false');
      this.removeAttribute('error-message');
    }
  }

  render() {
    const hasError = this.getAttribute('has-error') === 'true';
    const errorMessage = this.getAttribute('error-message') || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding-top: 10px;
        }

        h5 {
          margin-top: 0.4em;
          margin-bottom: 0.3em;
          color: #3c3836; /* Gruvbox dark fg */
          font-weight: normal;
          font-size: 1em;
        }

        .error {
          color: #cc241d; /* Gruvbox red */
          display: ${hasError ? 'block' : 'none'};
        }

        .error-color {
          color: #cc241d; /* Gruvbox red */
        }
        
        .warning-icon {
          display: inline-block;
          width: 1em;
          height: 1em;
          vertical-align: text-bottom;
          margin-right: 0.3em;
        }
      </style>
      
      <h5 class="error">
        <svg class="warning-icon error-color" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 1.5 L1 14.5 h14 Z" fill="currentColor"/>
          <path d="M8 6 v4 M8 11.5 v0.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        There is a problem with your code: <span id="error-content"></span>
      </h5>
    `;

    // Set HTML content for error message to preserve formatting
    const errorContent = this.shadowRoot.querySelector('#error-content');
    if (errorContent && errorMessage) {
      errorContent.innerHTML = errorMessage;
    }
  }
}

customElements.define('code-status', CodeStatus);