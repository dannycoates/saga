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
          color: #555;
          font-weight: normal;
          font-size: 1em;
        }

        .error {
          color: #d54;
          display: ${hasError ? 'block' : 'none'};
        }

        .error-color {
          color: #d54;
        }
      </style>
      
      <h5 class="error">
        <i class="fa fa-warning error-color"></i> 
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