import test from "node:test";
import assert from "node:assert/strict";
import { VoiceController } from "../src/recorder/voice.js";

test("browser speech preference does not call Deepgram", async () => {
  let deepgramStarts = 0;
  let browserStarts = 0;

  class FakeRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 1;
      this.lang = "";
    }
    start() { browserStarts += 1; this.onstart?.(); }
    stop() { this.onend?.(); }
  }

  global.window = {
    location: { protocol: "https:" },
    SpeechRecognition: FakeRecognition,
    webkitSpeechRecognition: null,
    IncidentRecorderDeepgram: {
      setTokenEndpoint: (value) => value,
      start: async () => { deepgramStarts += 1; },
      isActive: () => false,
      stop: async () => {},
      pause: async () => {},
      testTokenEndpoint: async () => ({ ok: true })
    }
  };

  const controller = new VoiceController({});
  controller.setTokenEndpoint("https://example.workers.dev/token");
  controller.setProviderPreference("browser");
  const provider = await controller.start();

  assert.equal(provider, "browser");
  assert.equal(browserStarts, 1);
  assert.equal(deepgramStarts, 0);
  await controller.stop();
  delete global.window;
});
