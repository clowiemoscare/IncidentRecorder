(() => {
  "use strict";

  // Curated from the KeepStock glossary. Keep this list under Deepgram's keyterm limit.
  const DEFAULT_KEYTERMS = [
    "KeepStock",
    "KeepStock Web",
    "KSHD",
    "Grainger.com",
    "GCOM",
    "OSR",
    "OSS",
    "KSSC",
    "CribMaster",
    "Epro",
    "GVEND",
    "Crib ID",
    "Program ID",
    "MRF",
    "PRF",
    "Jaggaer",
    "Punch Out",
    "SKU",
    "Unit of Measure",
    "eConnections",
    "RoadNetID",
    "OMS",
    "Cradlepoint",
    "Molex",
    "Badge Reader",
    "RFID",
    "IMEI",
    "GFCI",
    "MAC Address",
    "Power Supply",
    "PSU",
    "Main Board",
    "VMC Circuit Board",
    "Firmware",
    "COM cable",
    "Power BI",
    "AdvantageWeb",
    "NRBA",
    "CMI",
    "VMI",
    "VMV",
    "OKTA",
    "ServiceNow",
    "Job Aid",
    "Microsoft Teams",
    "SNOW",
    "Coil Vending Unit",
    "Locker Vending Unit",
    "Carousel Vending Unit",
    "Drawer Vending Unit",
    "RFIDEAS",
    "ClearSpider",
    "NetCloud",
    "Drop Sensor",
    "Tray",
    "Stop Issue",
    "Stop Order",
    "Badge Only Mode",
    "LogMeIn Rescue",
    "MVE",
    "RPO",
    "Guided Put Away",
    "On Hand Balance",
    "OHB",
    "Storage Unit",
    "Storage Area",
    "Open Stock"
  ];

  let tokenEndpoint = "";
  let socket = null;
  let mediaStream = null;
  let mediaRecorder = null;
  let shouldRun = false;
  let paused = false;
  let connecting = false;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let callbacks = {};
  let recentFinals = [];
  let sessionId = 0;

  const safeCall = (name, ...args) => {
    try {
      if (typeof callbacks[name] === "function") callbacks[name](...args);
    } catch (error) {
      console.warn(`Deepgram callback ${name} failed`, error);
    }
  };

  function normalizeEndpoint(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed, window.location.href);
      if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return "";
      return url.toString();
    } catch (error) {
      return "";
    }
  }

  function setTokenEndpoint(value) {
    tokenEndpoint = normalizeEndpoint(value);
    return tokenEndpoint;
  }

  function getTokenEndpoint() {
    return tokenEndpoint;
  }

  function isConfigured() {
    return Boolean(tokenEndpoint);
  }

  function isActive() {
    return shouldRun || connecting || Boolean(socket) || Boolean(mediaRecorder);
  }

  async function fetchTemporaryToken() {
    if (!tokenEndpoint) throw new Error("Deepgram token endpoint is not configured.");
    const response = await fetch(tokenEndpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit"
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch (error) { /* handled below */ }
    if (!response.ok) throw new Error(payload.error || payload.message || `Token endpoint returned HTTP ${response.status}.`);
    const accessToken = payload.access_token || payload.token;
    if (!accessToken) throw new Error("Token endpoint did not return a Deepgram access token.");
    return accessToken;
  }

  async function testTokenEndpoint(endpoint = tokenEndpoint) {
    const prior = tokenEndpoint;
    if (endpoint) setTokenEndpoint(endpoint);
    try {
      await fetchTemporaryToken();
      return { ok: true };
    } finally {
      tokenEndpoint = prior || tokenEndpoint;
    }
  }

  function buildListenUrl() {
    const params = new URLSearchParams({
      model: "nova-3",
      language: "en-US",
      smart_format: "true",
      punctuate: "true",
      numerals: "true",
      interim_results: "true",
      vad_events: "true",
      endpointing: "300",
      utterance_end_ms: "1000"
    });
    DEFAULT_KEYTERMS.forEach((term) => params.append("keyterm", term));
    return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  }

  function selectMimeType() {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus"
    ];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  async function ensureMicrophone() {
    if (mediaStream && mediaStream.getTracks().some((track) => track.readyState === "live")) return mediaStream;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone capture is not supported in this browser.");
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    return mediaStream;
  }

  function stopMediaRecorder() {
    if (!mediaRecorder) return;
    const current = mediaRecorder;
    mediaRecorder = null;
    current.ondataavailable = null;
    current.onerror = null;
    try {
      if (current.state !== "inactive") current.stop();
    } catch (error) { /* recorder is already stopped */ }
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function flushCurrentAudio() {
    const current = mediaRecorder;
    if (!current || current.state !== "recording") return;
    try { current.requestData(); } catch (error) { /* ignored */ }
    // Give MediaRecorder time to emit its last chunk before detaching handlers.
    await wait(220);
  }

  function stopMicrophone() {
    stopMediaRecorder();
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        try { track.stop(); } catch (error) { /* ignored */ }
      });
    }
    mediaStream = null;
  }

  function startMediaRecorder(activeSessionId) {
    if (!shouldRun || paused || activeSessionId !== sessionId || !mediaStream) return;
    stopMediaRecorder();
    const mimeType = selectMimeType();
    const options = mimeType ? { mimeType, audioBitsPerSecond: 64000 } : { audioBitsPerSecond: 64000 };
    mediaRecorder = new MediaRecorder(mediaStream, options);
    mediaRecorder.ondataavailable = async (event) => {
      if (!event.data?.size || activeSessionId !== sessionId) return;
      const ws = socket;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(await event.data.arrayBuffer());
      } catch (error) {
        console.warn("Could not send microphone audio to Deepgram", error);
      }
    };
    mediaRecorder.onerror = (event) => {
      safeCall("onStatus", "Microphone recorder interrupted. Reconnecting…");
      console.warn("MediaRecorder error", event.error || event);
      if (shouldRun && !paused) scheduleReconnect("microphone recorder interrupted");
    };
    mediaRecorder.start(250);
  }

  function rememberFinal(text, message) {
    const key = `${message?.start ?? ""}|${message?.duration ?? ""}|${text}`;
    if (recentFinals.includes(key)) return false;
    recentFinals.push(key);
    if (recentFinals.length > 80) recentFinals = recentFinals.slice(-40);
    return true;
  }

  function handleMessage(event) {
    let message;
    try { message = JSON.parse(event.data); } catch (error) { return; }
    if (message.type === "Results") {
      const transcript = String(message.channel?.alternatives?.[0]?.transcript || "").trim();
      if (!transcript) return;
      if (message.is_final) {
        if (rememberFinal(transcript, message)) safeCall("onFinal", transcript, message);
        safeCall("onInterim", "");
      } else {
        safeCall("onInterim", transcript, message);
      }
      return;
    }
    if (message.type === "UtteranceEnd") safeCall("onInterim", "");
    if (message.type === "Metadata") safeCall("onMetadata", message);
  }

  function clearReconnectTimer() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function closeSocket({ final = false } = {}) {
    const ws = socket;
    socket = null;
    if (!ws) return;
    try {
      if (ws.readyState === WebSocket.OPEN && final) ws.send(JSON.stringify({ type: "CloseStream" }));
    } catch (error) { /* socket may already be closing */ }
    try { ws.close(1000, "client closing"); } catch (error) { /* ignored */ }
  }

  function scheduleReconnect(reason = "connection ended") {
    if (!shouldRun || paused) return;
    clearReconnectTimer();
    stopMediaRecorder();
    closeSocket();
    reconnectAttempts += 1;
    const delay = Math.min(500 + reconnectAttempts * 400, 4000);
    safeCall("onState", "reconnecting");
    safeCall("onStatus", `Deepgram reconnecting (${reason})…`);
    reconnectTimer = setTimeout(() => connect(sessionId), delay);
  }

  async function connect(activeSessionId) {
    if (!shouldRun || paused || connecting || activeSessionId !== sessionId) return;
    connecting = true;
    safeCall("onState", "reconnecting");
    safeCall("onStatus", reconnectAttempts ? "Reconnecting to Deepgram…" : "Connecting to Deepgram Nova-3…");
    try {
      await ensureMicrophone();
      const temporaryToken = await fetchTemporaryToken();
      if (!shouldRun || paused || activeSessionId !== sessionId) return;
      const ws = new WebSocket(buildListenUrl(), ["bearer", temporaryToken]);
      ws.binaryType = "arraybuffer";
      socket = ws;
      ws.onopen = () => {
        if (activeSessionId !== sessionId || !shouldRun || paused) {
          try { ws.close(); } catch (error) { /* ignored */ }
          return;
        }
        connecting = false;
        reconnectAttempts = 0;
        safeCall("onState", "listening");
        safeCall("onStatus", "Listening with Deepgram Nova-3. Voice notes stay active until you click Stop.");
        startMediaRecorder(activeSessionId);
      };
      ws.onmessage = handleMessage;
      ws.onerror = (event) => {
        console.warn("Deepgram WebSocket error", event);
        safeCall("onStatus", "Deepgram connection interrupted. Reconnecting…");
      };
      ws.onclose = (event) => {
        if (socket === ws) socket = null;
        connecting = false;
        stopMediaRecorder();
        if (shouldRun && !paused && activeSessionId === sessionId) scheduleReconnect(`connection closed ${event.code || ""}`.trim());
      };
    } catch (error) {
      connecting = false;
      safeCall("onError", error);
      if (shouldRun && !paused && activeSessionId === sessionId) scheduleReconnect(error.message || "connection failed");
      else throw error;
    }
  }

  async function start(options = {}) {
    callbacks = { ...options };
    if (!isConfigured()) throw new Error("Deepgram token endpoint is not configured.");
    if (!window.MediaRecorder) throw new Error("MediaRecorder is not supported in this browser.");
    clearReconnectTimer();
    shouldRun = true;
    paused = false;
    reconnectAttempts = 0;
    recentFinals = [];
    sessionId += 1;
    await connect(sessionId);
  }

  async function pause() {
    paused = true;
    shouldRun = false;
    clearReconnectTimer();
    // Flush while the recorder still belongs to the active session. Invalidating
    // sessionId first would cause ondataavailable to discard this final chunk.
    await flushCurrentAudio();
    sessionId += 1;
    stopMediaRecorder();
    const ws = socket;
    if (ws?.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "CloseStream" })); } catch (error) { /* ignored */ }
      await wait(250);
    }
    closeSocket();
    stopMicrophone();
    safeCall("onInterim", "");
    safeCall("onState", "paused");
    safeCall("onStatus", "Voice notes paused. Click Start voice notes to resume, or Stop to end the session.");
  }

  async function stop() {
    shouldRun = false;
    paused = false;
    clearReconnectTimer();
    // Flush before invalidating the active session so the last buffered audio
    // chunk is still accepted by ondataavailable.
    await flushCurrentAudio();
    sessionId += 1;
    stopMediaRecorder();
    const ws = socket;
    if (ws?.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "CloseStream" })); } catch (error) { /* ignored */ }
      // Allow Deepgram to return the final utterance before we close the socket.
      await wait(350);
    }
    closeSocket();
    stopMicrophone();
    connecting = false;
    reconnectAttempts = 0;
    safeCall("onInterim", "");
    safeCall("onState", "stopped");
    safeCall("onStatus", "Voice notes stopped.");
  }

  window.IncidentRecorderDeepgram = {
    setTokenEndpoint,
    getTokenEndpoint,
    isConfigured,
    isActive,
    start,
    pause,
    stop,
    testTokenEndpoint,
    buildListenUrl
  };
})();
