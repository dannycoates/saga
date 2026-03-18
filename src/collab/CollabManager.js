import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import { Awareness } from "y-protocols/awareness";
import { ManualSignaling } from "./ManualSignaling.js";
import { YjsProvider } from "./YjsProvider.js";

/**
 * @typedef {import('../utils/EventBus.js').EventBus} EventBus
 * @typedef {import('../ui/CodeEditor.js').CodeEditor} CodeEditor
 */

const HOST_COLOR = { color: "#d79921", light: "#d7992133" };
const JOIN_COLOR = { color: "#458588", light: "#45858833" };

/**
 * Orchestrates collaborative editing via WebRTC + Yjs.
 */
export class CollabManager {
  /**
   * @param {EventBus} eventBus
   * @param {CodeEditor} editor
   */
  constructor(eventBus, editor) {
    this.eventBus = eventBus;
    this.editor = editor;

    /** @type {Y.Doc | null} */
    this.doc = null;
    /** @type {Awareness | null} */
    this.awareness = null;
    /** @type {ManualSignaling | null} */
    this.signaling = null;
    /** @type {YjsProvider | null} */
    this.provider = null;
    /** @type {boolean} */
    this.isHost = false;
    /** @type {boolean} */
    this.connected = false;
    /** @type {string} */
    this.peerName = "";
  }

  /**
   * Starts hosting a collab session.
   * Initializes Y.Doc with current editor content.
   * @param {string} userName
   * @returns {Promise<string>} Base64 offer string to share
   */
  async host(userName) {
    this.isHost = true;
    this._initDoc();

    // Initialize Y.Text with current editor content
    const ytext = /** @type {Y.Text} */ (this.doc?.getText("codemirror"));
    const currentCode = this.editor.getCode();
    if (ytext && currentCode) {
      ytext.insert(0, currentCode);
    }

    this._setAwareness(userName, HOST_COLOR);

    this.signaling = new ManualSignaling();
    const offerString = await this.signaling.createOffer();
    return offerString;
  }

  /**
   * Accepts an offer and produces an answer (joiner side).
   * @param {string} offerString - Base64 offer from host
   * @param {string} userName
   * @returns {Promise<string>} Base64 answer string to send back
   */
  async join(offerString, userName) {
    this.isHost = false;
    this._initDoc();
    this._setAwareness(userName, JOIN_COLOR);

    this.signaling = new ManualSignaling();
    const answerString = await this.signaling.acceptOffer(offerString);

    // Start waiting for data channel in the background.
    // No timeout — waits until host pastes the answer and connection opens.
    this._waitAndConnect().catch((err) => {
      console.error("Collab connection failed:", err);
      this.eventBus.emit("collab:disconnected");
    });

    return answerString;
  }

  /**
   * Accepts the answer string to complete the connection (host side).
   * @param {string} answerString
   * @returns {Promise<void>}
   */
  async acceptAnswer(answerString) {
    if (!this.signaling) throw new Error("Not hosting");
    await this.signaling.acceptAnswer(answerString);
    await this._waitAndConnect();
  }

  /**
   * Disconnects and cleans up everything.
   */
  disconnect() {
    if (this.provider) {
      this.provider.disconnect();
      this.provider = null;
    }
    if (this.signaling) {
      this.signaling.close();
      this.signaling = null;
    }

    // Remove collab extensions from editor
    this.editor.clearCollabExtensions();

    this.doc = null;
    this.awareness = null;
    this.connected = false;
    this.peerName = "";
    this.eventBus.emit("collab:disconnected");
  }

  /**
   * Initializes the Y.Doc and Awareness.
   * @private
   */
  _initDoc() {
    this.doc = new Y.Doc();
    this.awareness = new Awareness(this.doc);
  }

  /**
   * Sets the local awareness state.
   * @private
   * @param {string} name
   * @param {{ color: string, light: string }} colors
   */
  _setAwareness(name, colors) {
    if (!this.awareness) return;
    this.awareness.setLocalStateField("user", {
      name,
      color: colors.color,
      colorLight: colors.light,
    });
  }

  /**
   * Waits for the Yjs provider to complete initial sync.
   * @private
   * @returns {Promise<void>}
   */
  _waitForSync() {
    return new Promise((resolve) => {
      if (this.provider?.synced) {
        resolve();
        return;
      }
      const check = () => {
        if (this.provider?.synced) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      setTimeout(check, 50);
      // Timeout after 5 seconds
      setTimeout(resolve, 5000);
    });
  }

  /**
   * Waits for the data channel and connects the Yjs provider + editor.
   * @private
   * @returns {Promise<void>}
   */
  async _waitAndConnect() {
    if (!this.signaling || !this.doc || !this.awareness) return;

    const channel = await this.signaling.waitForDataChannel();

    // Set up Yjs provider
    this.provider = new YjsProvider(this.doc, this.awareness);
    this.provider.connect(channel);

    // Monitor for peer awareness to get their name
    this.awareness.on(
      "update",
      /** @param {{ added: number[], updated: number[], removed: number[] }} changes */
      (changes) => {
        for (const clientID of changes.added.concat(changes.updated)) {
          if (clientID !== this.doc?.clientID) {
            const state = this.awareness?.getStates().get(clientID);
            if (state?.user?.name && state.user.name !== this.peerName) {
              this.peerName = state.user.name;
              this.eventBus.emit("collab:peer_name", {
                peerName: this.peerName,
              });
            }
          }
        }
      },
    );

    // Wait for initial sync to complete (joiner needs host's content)
    if (!this.isHost) {
      await this._waitForSync();
    }

    // Inject collab extensions into the editor
    const ytext = this.doc.getText("codemirror");

    // Sync editor content with Y.Text before binding.
    // For host: Y.Text already matches editor.
    // For joiner: Y.Text has host's content after sync, so update editor.
    const ytextContent = ytext.toString();
    const editorContent = this.editor.getCode();
    if (ytextContent !== editorContent) {
      this.editor.setCode(ytextContent);
    }

    const extensions = yCollab(ytext, this.awareness);
    this.editor.setCollabExtensions(extensions);

    this.connected = true;
    this.eventBus.emit("collab:connected", { peerName: this.peerName });

    // Handle data channel close
    channel.addEventListener("close", () => {
      if (this.connected) {
        this.disconnect();
      }
    });
  }
}
