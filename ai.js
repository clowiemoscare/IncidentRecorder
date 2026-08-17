const WEBLLM_CDN = "https://esm.run/@mlc-ai/web-llm@0.2.84";
const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const SETTINGS_KEY = "incidentRecorderLocalAiV1";

let webllmPromise = null;
let engine = null;
let engineModelId = "";
let enginePromise = null;

const AI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    issue_summary: { type: "string" },
    troubleshooting_steps: { type: "array", items: { type: "string" } },
    resolution: { type: "string" },
    fields: {
      type: "object",
      additionalProperties: false,
      properties: {
        cribProgramId: { type: "string" },
        programName: { type: "string" },
        companyName: { type: "string" },
        siteId: { type: "string" },
        accountNumber: { type: "string" }
      },
      required: ["cribProgramId", "programName", "companyName", "siteId", "accountNumber"]
    }
  },
  required: ["issue_summary", "troubleshooting_steps", "resolution", "fields"]
};

function $(id) { return document.getElementById(id); }

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}

function saveSettings() {
  const settings = {
    enabled: $("useLocalAi")?.checked !== false,
    model: $("localAiModel")?.value || DEFAULT_MODEL
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function setStatus(text, state = "") {
  const status = $("localAiStatus");
  const card = $("localAiCard");
  if (status) status.textContent = text;
  if (card) {
    card.classList.toggle("ai-ready", state === "ready");
    card.classList.toggle("ai-error", state === "error");
  }
}

function setProgress(progress, show = true) {
  const wrap = $("localAiProgress");
  const bar = $("localAiProgressBar");
  if (!wrap || !bar) return;
  wrap.hidden = !show;
  const pct = Math.max(0, Math.min(100, Number(progress || 0) * 100));
  bar.style.width = `${pct}%`;
}

function selectedModel() {
  return $("localAiModel")?.value || DEFAULT_MODEL;
}

function friendlyModelName(modelId) {
  if (modelId.includes("3B")) return "Llama 3.2 3B";
  return "Llama 3.2 1B";
}

async function loadWebLLM() {
  if (!webllmPromise) webllmPromise = import(WEBLLM_CDN);
  return webllmPromise;
}

async function ensureWebGPU() {
  if (!navigator.gpu) throw new Error("WebGPU is unavailable in this browser.");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No compatible WebGPU adapter was found.");
  return adapter;
}

async function loadEngine(modelId = selectedModel()) {
  if (engine && engineModelId === modelId) return engine;
  if (enginePromise && engineModelId === modelId) return enginePromise;

  engineModelId = modelId;
  enginePromise = (async () => {
    try {
      await ensureWebGPU();
      setStatus(`Loading ${friendlyModelName(modelId)} locally...`);
      setProgress(0, true);
      const webllm = await loadWebLLM();

      if (engine && typeof engine.unload === "function") {
        try { await engine.unload(); } catch { /* safe to recreate */ }
      }

      engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback(report) {
          const progress = typeof report?.progress === "number" ? report.progress : 0;
          setProgress(progress, true);
          const label = report?.text ? String(report.text).replace(/\s+/g, " ").trim() : `Loading ${friendlyModelName(modelId)}...`;
          setStatus(label);
        },
        logLevel: "WARN"
      });

      setProgress(1, false);
      setStatus(`${friendlyModelName(modelId)} ready · local`, "ready");
      return engine;
    } catch (error) {
      engine = null;
      setProgress(0, false);
      setStatus(error?.message || "Local AI failed to load.", "error");
      throw error;
    } finally {
      enginePromise = null;
    }
  })();
  return enginePromise;
}

function buildSystemPrompt() {
  return `You document technical support incidents from a one-sided call transcript.

IMPORTANT CONTEXT:
- The microphone records ONLY the support agent Chloe. The caller is NOT transcribed.
- Chloe may repeat or paraphrase information the caller gives her. Treat that repeated information as call evidence.
- The purpose is to minimize documentation time while remaining accurate.

DOCUMENTATION RULES:
1. Do not invent facts, values, troubleshooting, outcomes, confirmations, or caller statements.
2. Remove greetings, identity verification, hold/filler phrases, and closing pleasantries.
3. Capture EVERY meaningful troubleshooting action Chloe performed or instructed during the call, in chronological order.
4. Troubleshooting includes: what Chloe looked up, checked, confirmed, compared, diagnosed, explained, navigated to, changed, recommended, trained the rep on, asked the rep to do, and any retest/verification instructions.
5. Combine fragmented speech into concise professional steps, but do not omit distinct actions.
6. The resolution must directly address the main issue. If the call was training/education, say exactly what the rep was trained on. If only a recommendation was given and success was not confirmed, do NOT claim it was fixed.
7. issue_summary should describe the caller's actual need/problem, not Chloe's greeting or a troubleshooting step.
8. For extracted fields, return an exact spoken value only when supported. Preserve leading zeros. Otherwise return an empty string.
9. Never replace a manual field with an inferred value; field suggestions are used only when the page field is blank.
10. Return JSON only and follow the provided schema.`;
}

function buildUserPrompt(context, transcript=context.rawNotes || "", chunkLabel="") {
  const manual = context.manualFields || {};
  return `Selected Category: ${context.category || ""}
Selected Subcategory: ${context.subcategory || ""}
Agent: ${context.agentName || "Chloe"}
Transcript source: agent voice only${chunkLabel ? `\nTranscript segment: ${chunkLabel}` : ""}

MANUALLY ENTERED / ALREADY EXTRACTED VALUES (do not contradict these):
Crib/Program id: ${manual.cribProgramId || ""}
Program name: ${manual.programName || ""}
Company name: ${manual.companyName || ""}
Site ID: ${manual.siteId || ""}
Acct #: ${manual.accountNumber || ""}

ROUGH NOTES — preserve the meaning of every troubleshooting action:
${transcript}

Produce:
- issue_summary: one concise sentence describing the actual support need.
- troubleshooting_steps: a complete chronological list of meaningful actions/instructions from Chloe's side of the call.
- resolution: the outcome, training provided, or accurate next step that addresses the main issue.
- fields: only exact values heard in the notes for cribProgramId, programName, companyName, siteId, accountNumber; use "" when unknown.`;
}

function sanitizeResult(result) {
  if (!result || typeof result !== "object") throw new Error("Local AI returned an invalid result.");
  const fields = result.fields && typeof result.fields === "object" ? result.fields : {};
  return {
    issue_summary: String(result.issue_summary || "").trim(),
    troubleshooting_steps: Array.isArray(result.troubleshooting_steps)
      ? result.troubleshooting_steps.map((step) => String(step || "").trim()).filter(Boolean)
      : [],
    resolution: String(result.resolution || "").trim(),
    fields: {
      cribProgramId: String(fields.cribProgramId || "").trim(),
      programName: String(fields.programName || "").trim(),
      companyName: String(fields.companyName || "").trim(),
      siteId: String(fields.siteId || "").trim(),
      accountNumber: String(fields.accountNumber || "").trim()
    }
  };
}

function splitTranscript(raw, maxChars = 5200) {
  const lines = String(raw || "").replace(/\r/g, "\n").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [""];
  const chunks = [];
  let current = "";
  for (const line of lines) {
    const parts = line.length > maxChars ? line.match(new RegExp(`.{1,${maxChars}}(?:\\s|$)`, "g")) || [line] : [line];
    for (const partRaw of parts) {
      const part = partRaw.trim();
      if (current && current.length + part.length + 1 > maxChars) {
        chunks.push(current);
        current = part;
      } else {
        current = current ? `${current}\n${part}` : part;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function mergeLocalAiResults(results) {
  const merged = {
    issue_summary: "",
    troubleshooting_steps: [],
    resolution: "",
    fields: { cribProgramId:"", programName:"", companyName:"", siteId:"", accountNumber:"" }
  };
  const seen = new Set();
  for (const result of results) {
    if (!merged.issue_summary && result.issue_summary) merged.issue_summary = result.issue_summary;
    if (result.resolution) merged.resolution = result.resolution;
    for (const step of result.troubleshooting_steps || []) {
      const key = step.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (key && !seen.has(key)) { seen.add(key); merged.troubleshooting_steps.push(step); }
    }
    for (const key of Object.keys(merged.fields)) {
      if (!merged.fields[key] && result.fields?.[key]) merged.fields[key] = result.fields[key];
    }
  }
  return merged;
}

async function runStructuredGeneration(localEngine, context, transcript, chunkIndex, chunkCount) {
  const chunked = chunkCount > 1;
  const chunkLabel = chunked ? `${chunkIndex + 1} of ${chunkCount}. This is one sequential part of the same call. Do not assume the call ended in this segment.` : "";
  const chunkInstruction = chunked
    ? `\nCHUNK RULE: For resolution, return an empty string unless THIS segment explicitly contains a resolution, training outcome, recommendation, or next step. Keep every troubleshooting action from this segment.`
    : "";
  const response = await localEngine.chat.completions.create({
    messages: [
      { role: "system", content: buildSystemPrompt() + chunkInstruction },
      { role: "user", content: buildUserPrompt(context, transcript, chunkLabel) }
    ],
    temperature: 0.1,
    top_p: 0.9,
    max_tokens: chunked ? 900 : 1400,
    stream: false,
    response_format: {
      type: "json_object",
      schema: JSON.stringify(AI_SCHEMA)
    }
  });
  const raw = response?.choices?.[0]?.message?.content || "";
  return sanitizeResult(JSON.parse(raw));
}

async function generateTicket(context) {
  const modelId = selectedModel();
  const localEngine = await loadEngine(modelId);
  const chunks = splitTranscript(context.rawNotes || "");

  try {
    const results = [];
    for (let index = 0; index < chunks.length; index += 1) {
      setStatus(chunks.length > 1
        ? `Local AI is reviewing call notes · part ${index + 1} of ${chunks.length}`
        : "Local AI is reviewing the call notes...");
      results.push(await runStructuredGeneration(localEngine, context, chunks[index], index, chunks.length));
    }
    const result = mergeLocalAiResults(results);
    if (!result.troubleshooting_steps.length && (context.rawNotes || "").split(/\s+/).length > 35) {
      throw new Error("Local AI did not return troubleshooting steps.");
    }
    setStatus(`${friendlyModelName(modelId)} ready · last ticket generated locally`, "ready");
    return result;
  } catch (error) {
    setStatus(`AI generation failed · rule-based fallback available`, "error");
    throw error;
  }
}

async function handleLoadClick() {
  const button = $("loadLocalAiBtn");
  if (button) button.disabled = true;
  try { await loadEngine(selectedModel()); }
  catch (error) { console.warn("Local AI load failed", error); }
  finally { if (button) button.disabled = false; }
}

function restoreSettings() {
  const settings = loadSettings();
  const useAi = $("useLocalAi");
  const model = $("localAiModel");
  if (useAi && typeof settings.enabled === "boolean") useAi.checked = settings.enabled;
  if (model && settings.model && [...model.options].some((option) => option.value === settings.model)) model.value = settings.model;
}

function initializeLocalAiUi() {
  const useAi = $("useLocalAi");
  const model = $("localAiModel");
  const load = $("loadLocalAiBtn");

  restoreSettings();

  if (!navigator.gpu) {
    if (useAi) useAi.checked = false;
    setStatus("WebGPU unavailable · rule-based generator will be used", "error");
    if (load) load.disabled = true;
  } else {
    setStatus("Not loaded yet · loads on first AI generate");
  }

  useAi?.addEventListener("change", () => {
    saveSettings();
    if (!useAi.checked) setStatus("Local AI off · rule-based generator active");
    else if (engine) setStatus(`${friendlyModelName(engineModelId)} ready · local`, "ready");
    else setStatus("Not loaded yet · loads on first AI generate");
  });

  model?.addEventListener("change", () => {
    saveSettings();
    if (engineModelId && engineModelId !== model.value) setStatus("Model changed · load the new model or generate a ticket");
  });

  load?.addEventListener("click", handleLoadClick);
}

window.IncidentRecorderAI = {
  generateTicket,
  loadEngine,
  isSupported: () => Boolean(navigator.gpu),
  getModelId: selectedModel,
  restoreSettings
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeLocalAiUi);
else initializeLocalAiUi();
