export class VoiceController {
  constructor({ onFinal, onInterim, onStatus, onState, onError }) {
    this.callbacks = { onFinal, onInterim, onStatus, onState, onError };
    this.recognition = null;
    this.shouldRestart = false;
    this.paused = false;
    this.starting = false;
    this.listening = false;
    this.fatal = false;
    this.restartTimer = null;
    this.restartAttempts = 0;
    this.pendingInterim = "";
    this.tokenEndpoint = "";
    this.providerPreference = "";
    this.activeProvider = "";
  }

  deepgram() { return window.IncidentRecorderDeepgram || null; }

  setTokenEndpoint(endpoint) {
    this.tokenEndpoint = String(endpoint || "").trim();
    return this.deepgram()?.setTokenEndpoint(this.tokenEndpoint) || "";
  }

  setProviderPreference(preference = "") {
    const normalized = ["browser", "deepgram"].includes(preference) ? preference : "";
    this.providerPreference = normalized;
    return normalized;
  }

  getProviderPreference() { return this.providerPreference; }
  getActiveProvider() { return this.activeProvider; }

  isDeepgramConfigured() {
    const dg = this.deepgram();
    return Boolean(dg && this.tokenEndpoint && dg.setTokenEndpoint(this.tokenEndpoint));
  }

  isBrowserAvailable() {
    return Boolean((window.SpeechRecognition || window.webkitSpeechRecognition) && !this.isLocalFile());
  }

  isLocalFile() { return window.location.protocol === "file:"; }

  emit(name, ...args) {
    try { this.callbacks[name]?.(...args); } catch (error) { console.warn(`Voice callback ${name} failed`, error); }
  }

  async testDeepgram(endpoint = this.tokenEndpoint) {
    const normalized = this.setTokenEndpoint(endpoint);
    if (!normalized) throw new Error("Enter a valid HTTPS Deepgram token endpoint.");
    return this.deepgram().testTokenEndpoint(normalized);
  }

  clearRestartTimer() {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }

  deepgramCallbacks() {
    return {
      onFinal: (text) => { if (text) this.emit("onFinal", text); this.pendingInterim = ""; },
      onInterim: (text) => { this.pendingInterim = String(text || "").trim(); this.emit("onInterim", this.pendingInterim); },
      onStatus: (text) => this.emit("onStatus", text),
      onState: (state) => {
        this.listening = state === "listening";
        this.starting = state === "reconnecting";
        this.emit("onState", state);
      },
      onError: (error) => this.emit("onError", error)
    };
  }

  scheduleBrowserRestart(reason = "session ended") {
    if (!this.shouldRestart || this.paused || this.fatal || !this.recognition) return;
    this.clearRestartTimer();
    const delay = Math.min(250 + (this.restartAttempts * 250), 1500);
    this.emit("onState", "reconnecting");
    this.emit("onStatus", `Browser speech recognition reconnecting (${reason}). Only Stop ends voice notes.`);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.shouldRestart || this.paused || this.fatal || this.listening || this.starting) return;
      try {
        this.starting = true;
        this.restartAttempts += 1;
        this.recognition.start();
      } catch {
        this.starting = false;
        this.scheduleBrowserRestart("retrying microphone");
      }
    }, delay);
  }

  initBrowserRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || this.isLocalFile()) return false;
    if (this.recognition) return true;
    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = "en-US";
    this.recognition.onstart = () => {
      this.activeProvider = "browser";
      this.starting = false;
      this.listening = true;
      this.restartAttempts = 0;
      this.emit("onState", "listening");
      this.emit("onStatus", "Listening with browser speech recognition (no Deepgram). It reconnects automatically until you click Stop.");
    };
    this.recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) finalText += `${text}\n`;
        else interim += `${text} `;
      }
      if (finalText.trim()) this.emit("onFinal", finalText.trim());
      this.pendingInterim = interim.trim();
      this.emit("onInterim", this.pendingInterim);
    };
    this.recognition.onerror = (event) => {
      this.starting = false;
      const fatal = ["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error);
      if (fatal) {
        this.fatal = true;
        this.shouldRestart = false;
        this.clearRestartTimer();
        this.emit("onState", "stopped");
        this.emit("onStatus", "Microphone access was blocked or unavailable. Allow microphone access, then click Start again.");
        return;
      }
      if (this.shouldRestart && !this.paused) this.emit("onStatus", `Browser speech recognition paused briefly (${event.error}). Reconnecting automatically…`);
    };
    this.recognition.onend = () => {
      this.starting = false;
      this.listening = false;
      if (this.pendingInterim) this.emit("onFinal", this.pendingInterim);
      this.pendingInterim = "";
      this.emit("onInterim", "");
      if (this.shouldRestart && !this.paused && !this.fatal) this.scheduleBrowserRestart("browser session ended");
      else this.emit("onState", this.paused ? "paused" : "stopped");
    };
    return true;
  }

  async startBrowser() {
    if (!this.initBrowserRecognition()) throw new Error("Browser speech recognition is unavailable in this browser.");
    if (this.listening || this.starting) return "browser";
    this.activeProvider = "browser";
    this.starting = true;
    this.emit("onState", "reconnecting");
    this.emit("onStatus", "Starting browser speech recognition (no Deepgram)…");
    this.recognition.start();
    return "browser";
  }

  async start() {
    if (this.isLocalFile()) throw new Error("Voice notes require HTTPS or localhost.");
    if (!this.providerPreference) throw new Error("Select a transcription method before starting voice notes.");

    this.fatal = false;
    this.paused = false;
    this.shouldRestart = true;
    this.clearRestartTimer();

    // Browser mode never requests a Deepgram token or opens a Deepgram socket.
    if (this.providerPreference === "browser") return this.startBrowser();

    if (!this.isDeepgramConfigured()) {
      this.shouldRestart = false;
      throw new Error("Deepgram is selected but not configured. Configure the Worker endpoint or choose Browser speech.");
    }

    try {
      this.activeProvider = "deepgram";
      this.starting = true;
      this.emit("onState", "reconnecting");
      this.emit("onStatus", "Starting Deepgram Nova-3…");
      await this.deepgram().start(this.deepgramCallbacks());
      return "deepgram";
    } catch (error) {
      this.starting = false;
      this.shouldRestart = false;
      this.activeProvider = "";
      this.emit("onError", error);
      this.emit("onState", "stopped");
      this.emit("onStatus", "Deepgram could not start. Choose Browser speech if you want to record without Deepgram.");
      throw new Error(`Deepgram could not start: ${error?.message || "connection error"}`);
    }
  }

  async pause() {
    this.paused = true;
    this.shouldRestart = false;
    this.clearRestartTimer();
    if (this.activeProvider === "deepgram" && this.deepgram()?.isActive?.()) {
      await this.deepgram().pause();
      this.pendingInterim = "";
      return;
    }
    if (this.pendingInterim) this.emit("onFinal", this.pendingInterim);
    this.pendingInterim = "";
    if (this.recognition && (this.listening || this.starting)) {
      try { this.recognition.stop(); } catch { /* already stopped */ }
    }
    this.listening = false;
    this.starting = false;
    this.emit("onState", "paused");
    this.emit("onStatus", "Voice notes paused. Click Start to resume, or Stop to end the session.");
  }

  async stop() {
    this.shouldRestart = false;
    this.paused = false;
    this.fatal = false;
    this.clearRestartTimer();
    if (this.activeProvider === "deepgram" && this.deepgram()?.isActive?.()) await this.deepgram().stop();
    if (this.pendingInterim && this.activeProvider === "browser") this.emit("onFinal", this.pendingInterim);
    this.pendingInterim = "";
    if (this.recognition && (this.listening || this.starting)) {
      try { this.recognition.stop(); } catch { /* already stopped */ }
    }
    this.listening = false;
    this.starting = false;
    this.restartAttempts = 0;
    this.activeProvider = "";
    this.emit("onInterim", "");
    this.emit("onState", "stopped");
    this.emit("onStatus", "Voice notes stopped.");
  }
}
