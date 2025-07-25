export class GameFeedback extends HTMLElement {
  static get observedAttributes() {
    return ["title", "message", "next-url"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.linkClickHandler = null;
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  disconnectedCallback() {
    this.removeEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
      this.attachEventListeners();
    }
  }

  removeEventListeners() {
    const link = this.shadowRoot.querySelector('a');
    if (link && this.linkClickHandler) {
      link.removeEventListener('click', this.linkClickHandler);
      this.linkClickHandler = null;
    }
  }

  attachEventListeners() {
    this.removeEventListeners(); // Remove any existing listeners first
    
    const link = this.shadowRoot.querySelector('a');
    if (link) {
      this.linkClickHandler = (e) => {
        e.preventDefault();
        const nextUrl = this.getAttribute('next-url');
        if (nextUrl) {
          // Update the URL hash to trigger the app to load the next challenge
          window.location.hash = nextUrl.replace('#', '');
          // The hashchange event will trigger loadFromUrl() automatically
        }
      };
      link.addEventListener('click', this.linkClickHandler);
    }
  }

  render() {
    const title = this.getAttribute("title") || "";
    const message = this.getAttribute("message") || "";
    const nextUrl = this.getAttribute("next-url") || "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          pointer-events: auto;
        }

        .feedback {
          position: absolute;
          width: 100%;
          height: 100%;
          padding-top: 20px;
          line-height: 20px;
          text-align: center;
          background-color: rgba(44, 44, 44, 0.6);
          z-index: 5;
          overflow: hidden;
          box-sizing: border-box;
        }

        h2, p {
          color: #f1f2d8;
          text-shadow: 0 2px 0.4pt #555;
          margin-top: 0.4em;
          margin-bottom: 0.3em;
          font-weight: normal;
        }

        h2 {
          font-size: 2em;
        }

        a {
          color: #f1f2d8;
          text-shadow: 0 2px 0.4pt #555;
          font-weight: bold;
          text-decoration: none;
        }

        a:hover {
          text-decoration: underline;
        }

        .blink {
          animation: blink 0.5s steps(3, start) infinite;
          -webkit-animation: blink 0.5s steps(3, start) infinite;
        }

        @keyframes blink {
          to {
            visibility: hidden;
          }
        }

        @-webkit-keyframes blink {
          to {
            visibility: hidden;
          }
        }
      </style>

      <div class="feedback">
        <h2>${title}</h2>
        <p>${message}</p>
        ${
          nextUrl
            ? `
          <a href="${nextUrl}">Next challenge <svg class="blink" style="width: 1em; height: 1em; vertical-align: middle; margin-left: 0.2em;" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 3 L11 8 L6 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg></a>
        `
            : ""
        }
      </div>
    `;
  }
}

customElements.define("game-feedback", GameFeedback);
