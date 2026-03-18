import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

/**
 * Minimal Yjs provider that syncs a Y.Doc over an RTCDataChannel.
 */
export class YjsProvider {
  /**
   * @param {Y.Doc} doc
   * @param {Awareness} awareness
   */
  constructor(doc, awareness) {
    /** @type {Y.Doc} */
    this.doc = doc;
    /** @type {Awareness} */
    this.awareness = awareness;
    /** @type {RTCDataChannel | null} */
    this.channel = null;
    /** @type {boolean} */
    this.synced = false;

    this._docUpdateHandler = this._onDocUpdate.bind(this);
    this._awarenessUpdateHandler = this._onAwarenessUpdate.bind(this);
  }

  /**
   * Connects the provider to an open data channel.
   * @param {RTCDataChannel} channel
   */
  connect(channel) {
    this.channel = channel;
    channel.binaryType = "arraybuffer";

    channel.addEventListener("message", (event) => {
      this._onMessage(new Uint8Array(event.data));
    });

    channel.addEventListener("close", () => {
      this.disconnect();
    });

    // Listen for local doc updates
    this.doc.on("update", this._docUpdateHandler);

    // Listen for awareness changes
    this.awareness.on("update", this._awarenessUpdateHandler);

    // Initiate sync: send our state vector
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this._send(encoding.toUint8Array(encoder));

    // Send initial awareness state
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
    const update = encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
    encoding.writeVarUint8Array(awarenessEncoder, update);
    this._send(encoding.toUint8Array(awarenessEncoder));
  }

  /**
   * Disconnects and cleans up.
   */
  disconnect() {
    this.doc.off("update", this._docUpdateHandler);
    this.awareness.off("update", this._awarenessUpdateHandler);
    // Remove remote awareness states
    removeAwarenessStates(
      this.awareness,
      Array.from(this.awareness.getStates().keys()).filter(
        (id) => id !== this.doc.clientID,
      ),
      this,
    );
    this.channel = null;
    this.synced = false;
  }

  /**
   * Handles incoming messages.
   * @private
   * @param {Uint8Array} data
   */
  _onMessage(data) {
    if (data.length === 0) return;
    const decoder = decoding.createDecoder(data);
    const msgType = decoding.readVarUint(decoder);

    switch (msgType) {
      case MSG_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        const syncMessageType = syncProtocol.readSyncMessage(
          decoder,
          encoder,
          this.doc,
          this,
        );
        // If readSyncMessage produced a reply (syncStep2), send it
        if (encoding.length(encoder) > 1) {
          this._send(encoding.toUint8Array(encoder));
        }
        if (
          syncMessageType === syncProtocol.messageYjsSyncStep2 &&
          !this.synced
        ) {
          this.synced = true;
        }
        break;
      }
      case MSG_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder);
        applyAwarenessUpdate(this.awareness, update, this);
        break;
      }
    }
  }

  /**
   * Called when the local doc is updated.
   * @private
   * @param {Uint8Array} update
   * @param {any} origin
   */
  _onDocUpdate(update, origin) {
    if (origin === this) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this._send(encoding.toUint8Array(encoder));
  }

  /**
   * Called when local awareness state changes.
   * @private
   * @param {{ added: number[], updated: number[], removed: number[] }} changes
   * @param {any} origin
   */
  _onAwarenessUpdate({ added, updated, removed }, origin) {
    if (origin === this) return;
    const changedClients = added.concat(updated).concat(removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    const update = encodeAwarenessUpdate(this.awareness, changedClients);
    encoding.writeVarUint8Array(encoder, update);
    this._send(encoding.toUint8Array(encoder));
  }

  /**
   * Sends raw bytes over the data channel.
   * @private
   * @param {Uint8Array} data
   */
  _send(data) {
    if (this.channel && this.channel.readyState === "open") {
      this.channel.send(/** @type {ArrayBuffer} */ (data.buffer));
    }
  }
}

export { Awareness };
