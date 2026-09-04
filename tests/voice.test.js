import test from "node:test";
import assert from "node:assert/strict";
import { VoiceController } from "../src/recorder/voice.js";

test("browser speech is the default and does not call Deepgram", async () => {
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
  assert.equal(controller.getProviderPreference(), "browser");
  const provider = await controller.start();

  assert.equal(provider, "browser");
  assert.equal(browserStarts, 1);
  assert.equal(deepgramStarts, 0);
  await controller.stop();
  delete global.window;
});

test("explicit Deepgram selection does not silently fall back to browser speech", async () => {
  let browserStarts = 0;
  class FakeRecognition { start() { browserStarts += 1; } stop() {} }
  global.window = {
    location: { protocol: "https:" },
    SpeechRecognition: FakeRecognition,
    webkitSpeechRecognition: null,
    IncidentRecorderDeepgram: {
      setTokenEndpoint: () => "",
      start: async () => {},
      isActive: () => false,
      stop: async () => {},
      pause: async () => {}
    }
  };
  const controller = new VoiceController({});
  controller.setProviderPreference("deepgram");
  await assert.rejects(() => controller.start(), /Deepgram is selected but not configured/i);
  assert.equal(browserStarts, 0);
  delete global.window;
});
