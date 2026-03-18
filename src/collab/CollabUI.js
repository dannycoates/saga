/**
 * @typedef {import('./CollabManager.js').CollabManager} CollabManager
 */

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

/**
 * Web component for collaborative editing UI.
 * Hidden by default, activated by Konami code or collab=join URL param.
 * @extends HTMLElement
 */
export class CollabPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    /** @type {HTMLDialogElement | null} */
    this.dialog = null;
    /** @type {CollabManager | null} */
    this.collabManager = null;
    /** @type {number[]} */
    this._konamiIndex = [0];
    /** @type {string} */
    this._state = "initial"; // initial | hosting | joining | connected
    /** @type {string} */
    this._offerString = "";
    /** @type {string} */
    this._answerString = "";
    /** @type {string} */
    this._error = "";
    /** @type {string} */
    this._userName = "";
    /** @type {string} */
    this._pendingOffer = "";
    /** @type {HTMLElement | null} */
    this._statusEl = null;
    /** @type {boolean} */
    this._revealed = false;
    /** @type {AbortController | null} */
    this._handlersAC = null;

    this._keyHandler = this._onKeyDown.bind(this);
  }

  connectedCallback() {
    this._render();
    this._createStatusIndicator();
    document.addEventListener("keydown", this._keyHandler);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._keyHandler);
    this._statusEl?.remove();
  }

  /**
   * @param {CollabManager} manager
   */
  setCollabManager(manager) {
    this.collabManager = manager;
    manager.eventBus.on("collab:disconnected", () => {
      this._state = "initial";
      this._error = "";
      this._offerString = "";
      this._answerString = "";
      this._render();
      this._updateStatusIndicator();
    });
    manager.eventBus.on("collab:connected", () => {
      this._updateStatusIndicator();
    });
    manager.eventBus.on("collab:peer_name", () => {
      this._updateStatusIndicator();
      if (this._state === "connected") {
        this._render();
        if (this.dialog?.open) this.dialog.showModal();
      }
    });
  }

  /**
   * Opens the modal dialog.
   */
  open() {
    this._render();
    if (this.dialog && !this.dialog.open) {
      this.dialog.showModal();
    }
  }

  /**
   * Opens the modal with a pre-filled offer, ready to join.
   * The interviewee enters their name and gets the answer immediately.
   * @param {string} offer - Base64 offer string from URL
   */
  openWithOffer(offer) {
    this._pendingOffer = offer;
    this._state = "join-from-link";
    this._revealed = true;
    this._updateStatusIndicator();
    this._render();
    if (this.dialog && !this.dialog.open) {
      this.dialog.showModal();
    }
  }

  /**
   * @private
   * @param {KeyboardEvent} e
   */
  _onKeyDown(e) {
    if (e.key === KONAMI[this._konamiIndex[0]]) {
      this._konamiIndex[0]++;
      if (this._konamiIndex[0] === KONAMI.length) {
        this._konamiIndex[0] = 0;
        this.reveal();
      }
    } else {
      this._konamiIndex[0] = e.key === KONAMI[0] ? 1 : 0;
    }
  }

  /**
   * @private
   */
  _render() {
    const sr = /** @type {ShadowRoot} */ (this.shadowRoot);
    sr.innerHTML = `
      <style>
        :host { display: block; }

        dialog {
          border: none;
          border-radius: 8px;
          padding: 0;
          background: transparent;
          max-width: 550px;
          width: 90vw;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        dialog::backdrop {
          background-color: rgba(44, 44, 44, 0.7);
          backdrop-filter: blur(2px);
        }

        .modal-content {
          background-color: var(--bg-primary, #f2e5bc);
          border: 2px solid var(--accent-color, #d79921);
          border-radius: 8px;
          padding: 20px;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--accent-color, #d79921);
        }

        .modal-title {
          margin: 0;
          color: var(--accent-color, #d79921);
          font-size: 1.2em;
          font-weight: bold;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          font-weight: bold;
          color: var(--text-secondary, #7c6f64);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          line-height: 1;
        }

        .close-btn:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        button.primary {
          height: 36px;
          font-size: 14px;
          font-weight: bold;
          padding: 6px 20px;
          color: var(--button-text, #fbf1c7);
          background-color: var(--accent-color, #d79921);
          border: 1px solid var(--accent-color, #b57614);
          border-radius: 5px;
          cursor: pointer;
        }

        button.primary:hover {
          opacity: 0.9;
        }

        button.danger {
          height: 36px;
          font-size: 14px;
          font-weight: bold;
          padding: 6px 20px;
          color: var(--button-text, #fbf1c7);
          background-color: var(--error-color, #cc241d);
          border: 1px solid var(--error-color, #9d0006);
          border-radius: 5px;
          cursor: pointer;
        }

        label {
          display: block;
          margin-bottom: 4px;
          font-weight: bold;
          color: var(--text-primary, #3c3836);
          font-size: 0.9em;
        }

        input, textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 8px;
          border: 1px solid var(--text-tertiary, rgba(60, 56, 54, 0.3));
          border-radius: 4px;
          background: var(--bg-secondary, rgba(60, 56, 54, 0.05));
          color: var(--text-primary, #3c3836);
          font-family: monospace;
          font-size: 0.85em;
        }

        textarea {
          height: 80px;
          resize: vertical;
        }

        .field {
          margin-bottom: 12px;
        }

        .copy-row {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .copy-row textarea {
          flex: 1;
        }

        .copy-btn {
          height: 36px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: bold;
          background: var(--bg-secondary, #ebdbb2);
          border: 1px solid var(--text-tertiary, rgba(60, 56, 54, 0.3));
          border-radius: 4px;
          cursor: pointer;
          white-space: nowrap;
          color: var(--text-primary, #3c3836);
        }

        .copy-btn:hover {
          background: var(--text-tertiary, rgba(60, 56, 54, 0.15));
        }

        .status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 12px 0;
          font-size: 1em;
          color: var(--text-primary, #3c3836);
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #98971a;
          display: inline-block;
        }

        .error {
          color: var(--error-color, #cc241d);
          font-size: 0.9em;
          margin-top: 8px;
        }

        .hint {
          font-size: 0.8em;
          color: var(--text-secondary, #7c6f64);
          margin-top: 4px;
        }

        button.primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid var(--button-text, #fbf1c7);
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          vertical-align: middle;
          margin-right: 6px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>

      <dialog>
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Collaborative Session</h3>
            <button class="close-btn" type="button" aria-label="Close">&times;</button>
          </div>
          ${this._renderBody()}
        </div>
      </dialog>
    `;

    this.dialog = sr.querySelector("dialog");
    this._setupHandlers();
  }

  /**
   * @private
   * @returns {string}
   */
  _renderBody() {
    switch (this._state) {
      case "initial":
        return `
          <form data-form="host">
            <div class="field">
              <label for="collab-name">Your Name</label>
              <input id="collab-name" type="text" placeholder="Enter your name" value="" />
            </div>
            <div class="actions">
              <button class="primary" type="submit" data-action="host">Host Session</button>
            </div>
          </form>
        `;

      case "hosting": {
        const link = this._buildCollabLink(this._offerString);
        return `
          <div class="field">
            <label>Send this link to your partner:</label>
            <div class="copy-row">
              <input readonly id="collab-link" type="text" value="${link}" />
              <button class="copy-btn" data-action="copy-link">Copy Link</button>
            </div>
            <p class="hint">Your partner clicks this link and gets an answer to send back.</p>
          </div>
          <div class="field">
            <label for="answer-input">Paste answer from partner:</label>
            <textarea id="answer-input" placeholder="Paste answer here..."></textarea>
          </div>
          <div class="actions">
            <button class="primary" data-action="accept-answer">Connect</button>
          </div>
          ${this._error ? `<div class="error">${this._error}</div>` : ""}
        `;
      }

      case "joining":
        if (!this._answerString) {
          return `
            <div class="field">
              <label for="offer-input">Paste the host's offer:</label>
              <textarea id="offer-input" placeholder="Paste offer here..."></textarea>
            </div>
            <div class="actions">
              <button class="primary" data-action="accept-offer">Generate Answer</button>
            </div>
            ${this._error ? `<div class="error">${this._error}</div>` : ""}
          `;
        }
        return `
          <div class="field">
            <label>Send this answer back to the host:</label>
            <div class="copy-row">
              <textarea readonly id="answer-text">${this._answerString}</textarea>
              <button class="copy-btn" data-action="copy-answer">Copy</button>
            </div>
            <p class="hint">Send this to the host via chat. Connection will establish automatically.</p>
          </div>
          ${this._error ? `<div class="error">${this._error}</div>` : ""}
        `;

      case "join-from-link":
        return `
          <form data-form="join-from-link">
            <div class="field">
              <label for="collab-name">Enter your name to join:</label>
              <input id="collab-name" type="text" placeholder="Your name" value="" />
            </div>
            <div class="actions">
              <button class="primary" type="submit" data-action="join-from-link">Join Session</button>
            </div>
            ${this._error ? `<div class="error">${this._error}</div>` : ""}
          </form>
        `;

      case "connected":
        return `
          <div class="status">
            <span class="dot"></span>
            Connected to <strong>${this.collabManager?.peerName || "partner"}</strong>
          </div>
          <div class="actions">
            <button class="danger" data-action="disconnect">Disconnect</button>
          </div>
        `;

      default:
        return "";
    }
  }

  /**
   * @private
   */
  _setupHandlers() {
    // Abort previous listeners to prevent duplicates across re-renders
    this._handlersAC?.abort();
    this._handlersAC = new AbortController();
    const { signal } = this._handlersAC;

    const sr = /** @type {ShadowRoot} */ (this.shadowRoot);

    // Close button
    sr.querySelector(".close-btn")?.addEventListener(
      "click",
      () => {
        this.dialog?.close();
      },
      { signal },
    );

    // Backdrop click
    this.dialog?.addEventListener(
      "click",
      (e) => {
        if (e.target === this.dialog) {
          this.dialog?.close();
        }
      },
      { signal },
    );

    // Form submit (Enter key or button click)
    sr.addEventListener(
      "submit",
      async (e) => {
        e.preventDefault();
        const form = /** @type {HTMLFormElement} */ (e.target);
        const action = form.dataset?.form;
        if (!action || !this.collabManager) return;

        try {
          switch (action) {
            case "host": {
              this._userName =
                /** @type {HTMLInputElement} */ (
                  sr.querySelector("#collab-name")
                )?.value || "Host";
              this._offerString = await this.collabManager.host(this._userName);
              this._state = "hosting";
              this._render();
              if (this.dialog) this.dialog.showModal();
              break;
            }

            case "join-from-link": {
              this._userName =
                /** @type {HTMLInputElement} */ (
                  sr.querySelector("#collab-name")
                )?.value || "Guest";
              const joinBtn = /** @type {HTMLButtonElement} */ (
                form.querySelector("button[type=submit]")
              );
              if (joinBtn) {
                joinBtn.disabled = true;
                joinBtn.innerHTML =
                  '<span class="spinner"></span>Generating\u2026';
              }
              try {
                this._answerString = await this.collabManager.join(
                  this._pendingOffer,
                  this._userName,
                );
                this._pendingOffer = "";
                this._state = "joining";
                this._render();
                if (this.dialog) this.dialog.showModal();
                this._waitForConnection();
                this._clearCollabFromHash();
              } catch (joinErr) {
                if (joinBtn) {
                  joinBtn.disabled = false;
                  joinBtn.textContent = "Join Session";
                }
                throw joinErr;
              }
              break;
            }
          }
        } catch (err) {
          this._error = /** @type {Error} */ (err).message;
          this._render();
          if (this.dialog) this.dialog.showModal();
        }
      },
      { signal },
    );

    // Action buttons
    sr.addEventListener(
      "click",
      async (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const action = target.dataset?.action;
        if (!action || !this.collabManager) return;

        try {
          switch (action) {
            case "copy-link": {
              const link = this._buildCollabLink(this._offerString);
              await navigator.clipboard.writeText(link);
              target.textContent = "Copied!";
              setTimeout(() => {
                target.textContent = "Copy Link";
              }, 1500);
              break;
            }

            case "accept-answer": {
              const answer = /** @type {HTMLTextAreaElement} */ (
                sr.querySelector("#answer-input")
              )?.value?.trim();
              if (!answer) return;
              await this.collabManager.acceptAnswer(answer);
              this._state = "connected";
              this._render();
              if (this.dialog) this.dialog.showModal();
              break;
            }

            case "start-join": {
              this._userName =
                /** @type {HTMLInputElement} */ (
                  sr.querySelector("#collab-name")
                )?.value || "Guest";
              this._state = "joining";
              this._answerString = "";
              this._render();
              if (this.dialog) this.dialog.showModal();
              break;
            }

            case "accept-offer": {
              const offer = /** @type {HTMLTextAreaElement} */ (
                sr.querySelector("#offer-input")
              )?.value?.trim();
              if (!offer) return;
              this._answerString = await this.collabManager.join(
                offer,
                this._userName,
              );
              this._state = "joining";
              this._render();
              if (this.dialog) this.dialog.showModal();
              // Wait for connection to establish
              this._waitForConnection();
              break;
            }

            case "copy-answer": {
              await navigator.clipboard.writeText(this._answerString);
              target.textContent = "Copied!";
              setTimeout(() => {
                target.textContent = "Copy";
              }, 1500);
              break;
            }

            case "disconnect": {
              this.collabManager.disconnect();
              break;
            }
          }
        } catch (err) {
          this._error = /** @type {Error} */ (err).message;
          this._render();
          if (this.dialog) this.dialog.showModal();
        }
      },
      { signal },
    );
  }

  /**
   * Builds a shareable link with the offer embedded in the URL hash.
   * @private
   * @param {string} offer - Base64 offer string
   * @returns {string}
   */
  _buildCollabLink(offer) {
    const url = new URL(window.location.href);
    // Preserve existing hash params, replace/add collab
    const hash = url.hash.replace(/^#/, "");
    const params = Object.fromEntries(
      hash
        .split(",")
        .filter((p) => p.includes("="))
        .map((p) => {
          const i = p.indexOf("=");
          return [p.slice(0, i), p.slice(i + 1)];
        }),
    );
    params.collab = offer;
    if (this.collabManager?.editor?.currentLanguage) {
      params.lang = this.collabManager.editor.currentLanguage;
    }
    url.hash =
      "#" +
      Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(",");
    return url.toString();
  }

  /**
   * Removes the collab param from the URL hash to clean up.
   * @private
   */
  _clearCollabFromHash() {
    const hash = window.location.hash.replace(/^#/, "");
    const parts = hash.split(",").filter((p) => !p.startsWith("collab="));
    window.location.hash = parts.length ? "#" + parts.join(",") : "";
  }

  /**
   * Creates the header status indicator element.
   * @private
   */
  _createStatusIndicator() {
    const el = document.createElement("div");
    el.className = "collab-status";
    el.style.cssText =
      "display:none;align-items:center;gap:6px;font-size:13px;font-weight:bold;color:var(--text-primary,#3c3836);";
    const headerControls = document.querySelector(".header-controls");
    if (headerControls) {
      headerControls.prepend(el);
    }
    this._statusEl = el;
    this._updateStatusIndicator();
  }

  /**
   * Shows the header status indicator (called by Konami code or link).
   */
  reveal() {
    this._revealed = true;
    this._updateStatusIndicator();
  }

  /**
   * Updates the header status indicator based on connection and reveal state.
   * @private
   */
  _updateStatusIndicator() {
    if (!this._statusEl) return;
    if (this.collabManager?.connected) {
      const name = this.collabManager.peerName || "partner";
      this._statusEl.innerHTML = `
        <span style="width:8px;height:8px;border-radius:50%;background:#98971a;display:inline-block;"></span>
        <span>${name}</span>
        <button class="layout-toggle-btn" title="Disconnect" style="color:var(--error-color,#cc241d);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
            <line x1="23" y1="1" x2="1" y2="23"></line>
          </svg>
        </button>
      `;
      this._statusEl
        .querySelector(".layout-toggle-btn")
        ?.addEventListener("click", () => this.collabManager?.disconnect());
      this._statusEl.style.display = "flex";
    } else if (this._revealed) {
      this._statusEl.innerHTML = `
        <button class="layout-toggle-btn" title="Collaborate">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </button>
      `;
      this._statusEl
        .querySelector(".layout-toggle-btn")
        ?.addEventListener("click", () => this.open());
      this._statusEl.style.display = "flex";
    } else {
      this._statusEl.style.display = "none";
    }
  }

  /**
   * Polls for connection and switches to connected state.
   * @private
   */
  _waitForConnection() {
    const check = () => {
      if (this.collabManager?.connected) {
        this._state = "connected";
        this._render();
        if (this.dialog) this.dialog.showModal();
      } else if (this._state === "joining") {
        setTimeout(check, 500);
      }
    };
    setTimeout(check, 1000);
  }
}

customElements.define("collab-panel", CollabPanel);
