export class CodeStatus extends HTMLElement {
  static get observedAttributes() {
    return ['error-message', 'has-error'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.dialog = null;
    this.eventHandlersSetup = false;
  }

  connectedCallback() {
    this.render();
    // Update dialog visibility after the component is fully connected
    setTimeout(() => {
      this.updateDialogVisibility();
    }, 0);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
      this.updateDialogVisibility();
    }
  }

  setError(error) {
    if (error) {
      console.error(error);
      let errorMessage = error;
      
      this.setAttribute('has-error', 'true');
      this.setAttribute('error-message', errorMessage);
    } else {
      this.setAttribute('has-error', 'false');
      this.removeAttribute('error-message');
    }
  }

  closeDialog() {
    if (this.dialog) {
      this.dialog.close();
    }
    this.setAttribute('has-error', 'false');
    this.removeAttribute('error-message');
  }

  updateDialogVisibility() {
    const hasError = this.getAttribute('has-error') === 'true';
    if (this.dialog && this.isConnected) {
      if (hasError) {
        try {
          this.dialog.showModal();
          // Focus the close button for accessibility
          const closeButton = /** @type {HTMLButtonElement | null} */ (this.shadowRoot.querySelector('.close-button'));
          if (closeButton) {
            closeButton.focus();
          }
        } catch (e) {
          // If showModal fails, we might not be connected yet
          console.warn('Failed to show modal:', e);
        }
      } else {
        this.dialog.close();
      }
    }
  }

  render() {
    const errorMessage = this.getAttribute('error-message') || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        dialog {
          border: none;
          border-radius: 8px;
          padding: 0;
          background: transparent;
          max-width: 600px;
          width: 90vw;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        dialog::backdrop {
          background-color: rgba(44, 44, 44, 0.7);
          backdrop-filter: blur(2px);
        }

        .modal-content {
          background-color: var(--bg-primary, #f2e5bc);
          border: 2px solid var(--error-color, #cc241d);
          border-radius: 8px;
          padding: 20px;
          position: relative;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--error-color, #cc241d);
        }

        .modal-title {
          display: flex;
          align-items: center;
          margin: 0;
          color: var(--error-color, #cc241d);
          font-size: 1.2em;
          font-weight: bold;
        }

        .warning-icon {
          display: inline-block;
          width: 1.2em;
          height: 1.2em;
          margin-right: 8px;
          flex-shrink: 0;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          font-weight: bold;
          color: var(--error-color, #cc241d);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background-color 0.2s ease;
          line-height: 1;
        }

        .close-button:hover {
          background-color: rgba(204, 36, 29, 0.1);
        }

        .error-content {
          color: var(--text-primary, #3c3836);
          line-height: 1.4;
          font-family: monospace;
          font-size: 0.9em;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 400px;
          overflow-y: auto;
          background-color: var(--bg-secondary, rgba(60, 56, 54, 0.05));
          padding: 12px;
          border-radius: 4px;
          border: 1px solid var(--text-tertiary, rgba(60, 56, 54, 0.2));
        }

        .console-note {
          font-size: 0.8em;
          color: var(--text-secondary, #7c6f64);
          margin-top: 8px;
        }

        .modal-footer {
          margin-top: 20px;
          text-align: right;
        }

        .dismiss-button {
          height: 32px;
          line-height: 18px;
          font-size: 14px;
          font-weight: bold;
          padding: 6px 16px;
          color: var(--button-text, #fbf1c7);
          background-color: var(--error-color, #cc241d);
          text-shadow: none;
          border: 1px solid var(--error-color, #9d0006);
          border-radius: 5px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .dismiss-button:hover {
          background-color: var(--error-color, #9d0006);
        }
      </style>
      
      <dialog>
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">
              <svg class="warning-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1.5 L1 14.5 h14 Z" fill="currentColor"/>
                <path d="M8 6 v4 M8 11.5 v0.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              Code Error
            </h3>
            <button class="close-button" type="button" aria-label="Close">&times;</button>
          </div>
          <div class="error-content" id="error-content"></div>
          <div class="console-note">See browser console for more details</div>
          <div class="modal-footer">
            <button class="dismiss-button close-button" type="button">Dismiss</button>
          </div>
        </div>
      </dialog>
    `;

    // Store reference to dialog
    this.dialog = this.shadowRoot.querySelector('dialog');

    // Set up event handlers after rendering (only once)
    if (!this.eventHandlersSetup) {
      this.setupEventHandlers();
      this.eventHandlersSetup = true;
    }

    // Set HTML content for error message to preserve formatting
    const errorContent = this.shadowRoot.querySelector('#error-content');
    if (errorContent && errorMessage) {
      errorContent.innerHTML = errorMessage;
    }

    // Show/hide dialog based on error state (defer to avoid connection issues)
    setTimeout(() => {
      this.updateDialogVisibility();
    }, 0);
  }

  setupEventHandlers() {
    // Handle close button click and dismiss button click
    this.shadowRoot.addEventListener('click', (e) => {
      const target = /** @type {Element} */ (e.target);
      if (target.classList.contains('close-button')) {
        this.closeDialog();
      }
    });

    // Handle dialog backdrop click (click outside modal content)
    this.shadowRoot.addEventListener('click', (e) => {
      const target = /** @type {Element} */ (e.target);
      if (target.tagName === 'DIALOG') {
        this.closeDialog();
      }
    });

    // Handle escape key globally for the dialog
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.dialog && this.dialog.open) {
        this.closeDialog();
      }
    });
  }
}

customElements.define('code-status', CodeStatus);