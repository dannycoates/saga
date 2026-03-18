const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Encodes an object to a base64url string (URL-safe, no padding).
 * @param {object} obj
 * @returns {string}
 */
function encode(obj) {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decodes a base64url string back to an object.
 * Also accepts standard base64 for backwards compatibility.
 * @param {string} str
 * @returns {any}
 */
function decode(str) {
  // Convert base64url to standard base64
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(b64));
}

/**
 * Waits for ICE gathering to complete on a peer connection.
 * @param {RTCPeerConnection} pc
 * @returns {Promise<void>}
 */
function waitForIceGathering(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        resolve();
      }
    });
    // Fallback timeout in case gathering stalls
    setTimeout(resolve, 5000);
  });
}

/**
 * WebRTC manual signaling for serverless P2P connections.
 * Produces base64-encoded offer/answer strings for copy-paste exchange.
 */
export class ManualSignaling {
  constructor() {
    /** @type {RTCPeerConnection | null} */
    this.pc = null;
    /** @type {RTCDataChannel | null} */
    this.dataChannel = null;
    /** @type {((channel: RTCDataChannel) => void) | null} */
    this._onDataChannel = null;
    /** @type {Promise<RTCDataChannel> | null} */
    this._dataChannelPromise = null;
    /** @type {((channel: RTCDataChannel) => void) | null} */
    this._resolveDataChannel = null;
    /** @type {((error: any) => void) | null} */
    this._rejectDataChannel = null;
  }

  /**
   * Creates an offer (host side).
   * @returns {Promise<string>} Base64-encoded offer string
   */
  async createOffer() {
    this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    this.dataChannel = this.pc.createDataChannel("yjs-sync", { ordered: true });

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceGathering(this.pc);

    return encode({
      sdp: this.pc.localDescription?.sdp,
      type: this.pc.localDescription?.type,
    });
  }

  /**
   * Accepts an offer and produces an answer (joiner side).
   * @param {string} offerString - Base64-encoded offer
   * @returns {Promise<string>} Base64-encoded answer string
   */
  async acceptOffer(offerString) {
    const { sdp, type } = decode(offerString);

    this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    // Listen for the data channel from the host
    this.pc.addEventListener("datachannel", (event) => {
      this.dataChannel = event.channel;
      if (this._onDataChannel) {
        this._onDataChannel(event.channel);
      }
    });

    await this.pc.setRemoteDescription({ sdp, type });
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await waitForIceGathering(this.pc);

    return encode({
      sdp: this.pc.localDescription?.sdp,
      type: this.pc.localDescription?.type,
    });
  }

  /**
   * Accepts an answer to complete the handshake (host side).
   * @param {string} answerString - Base64-encoded answer
   * @returns {Promise<void>}
   */
  async acceptAnswer(answerString) {
    if (!this.pc)
      throw new Error("No peer connection (call createOffer first)");
    const { sdp, type } = decode(answerString);
    await this.pc.setRemoteDescription({ sdp, type });
  }

  /**
   * Returns a promise that resolves when the data channel is open.
   * No timeout — the channel may take a while if humans are copy-pasting.
   * @returns {Promise<RTCDataChannel>}
   */
  waitForDataChannel() {
    if (this._dataChannelPromise) return this._dataChannelPromise;

    this._dataChannelPromise = new Promise((resolve, reject) => {
      this._resolveDataChannel = resolve;
      this._rejectDataChannel = reject;

      // Check if already available
      const channel = this.dataChannel;
      if (channel) {
        this._onChannelReady(channel);
        return;
      }

      // Joiner: data channel arrives via ondatachannel event
      this._onDataChannel = (ch) => this._onChannelReady(ch);
    });

    return this._dataChannelPromise;
  }

  /**
   * Handles a data channel becoming available.
   * @private
   * @param {RTCDataChannel} channel
   */
  _onChannelReady(channel) {
    if (channel.readyState === "open") {
      this._resolveDataChannel?.(channel);
    } else {
      channel.addEventListener(
        "open",
        () => this._resolveDataChannel?.(channel),
        { once: true },
      );
      channel.addEventListener("error", (e) => this._rejectDataChannel?.(e), {
        once: true,
      });
    }
  }

  /**
   * Closes the connection and cleans up.
   */
  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this._onDataChannel = null;
    this._dataChannelPromise = null;
    this._resolveDataChannel = null;
    this._rejectDataChannel = null;
  }
}
