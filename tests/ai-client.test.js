import test from "node:test";
import assert from "node:assert/strict";
import { analyzeWithWorkersAi, checkWorkersAiHealth, healthEndpoint, normalizeAiAnalysis, workersAiEndpoint } from "../src/ticket/ai-client.js";

test("AI endpoints are derived from the configured Worker token endpoint", () => {
  const token = "https://incident.example.workers.dev/token";
  assert.equal(workersAiEndpoint(token), "https://incident.example.workers.dev/analyze");
  assert.equal(healthEndpoint(token), "https://incident.example.workers.dev/health");
});

test("missing Worker endpoint reports AI as not configured without a network request", async () => {
  let calls = 0;
  global.fetch = async () => { calls += 1; throw new Error("should not be called"); };
  const health = await checkWorkersAiHealth({ tokenEndpoint: "" });
  assert.equal(health.workersAiConfigured, false);
  assert.equal(health.reason, "endpoint_not_configured");
  assert.equal(calls, 0);
  delete global.fetch;
});

test("health check surfaces Workers AI binding readiness", async () => {
  global.fetch = async () => new Response(JSON.stringify({ ok: true, workersAiConfigured: true, deepgramConfigured: true, model: "test-model" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
  const health = await checkWorkersAiHealth({ tokenEndpoint: "https://incident.example.workers.dev/token" });
  assert.equal(health.reachable, true);
  assert.equal(health.workersAiConfigured, true);
  assert.equal(health.model, "test-model");
  delete global.fetch;
});


test("AI normalization carries the structured possible root cause into the ticket analysis model", () => {
  const normalized = normalizeAiAnalysis({
    issue_summary: "onsite app task unavailable",
    account_number: "001234",
    caller_role: "rep",
    troubleshooting_steps: ["Reviewed the site task assignment"],
    conditional_next_steps: [],
    resolution: "Assigned the task to the site",
    root_cause: "Likely task-to-site assignment was missing",
    resolved: true
  }, {});

  assert.equal(normalized.rootCause, "Likely task-to-site assignment was missing");
  assert.equal(normalized.accountNumber, "001234");
  assert.equal(normalized.callerRole, "rep");
});


test("ticket update sends only new Rough Notes plus the previous structured analysis", async () => {
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      analysis: {
        issue_summary: "Machine not communicating",
        account_number: "001234",
        caller_role: "caller",
        troubleshooting_steps: ["Confirmed machine had power.", "Power cycled the PC."],
        conditional_next_steps: [],
        resolution: "Communication restored.",
        root_cause: "",
        resolved: true
      },
      model: "test-model"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await analyzeWithWorkersAi({
    tokenEndpoint: "https://incident.example.workers.dev/token",
    roughNotes: "Power cycled the PC and confirmed communication was restored.",
    category: "Keepstock - Seaga / CM",
    subcategory: "Hardware issue: - Main harness",
    mode: "update",
    previousAnalysis: {
      issueSummary: "Machine not communicating",
      accountNumber: "001234",
      callerRole: "rep",
      troubleshootingSteps: ["Confirmed machine had power."],
      conditionalNextSteps: [],
      resolution: "",
      rootCause: "",
      resolved: false
    },
    coverageCandidates: ["Power cycled the PC.", "Confirmed communication was restored."],
    callerRoleHint: "rep"
  });

  assert.equal(requestBody.analysis_mode, "update");
  assert.equal(requestBody.rough_notes, "Power cycled the PC and confirmed communication was restored.");
  assert.equal(requestBody.previous_analysis.issue_summary, "Machine not communicating");
  assert.deepEqual(requestBody.previous_analysis.troubleshooting_steps, ["Confirmed machine had power."]);
  assert.equal(requestBody.previous_analysis.caller_role, "rep");
  assert.deepEqual(requestBody.coverage_candidates, ["Power cycled the PC.", "Confirmed communication was restored."]);
  assert.equal(requestBody.caller_role_hint, "rep");
  delete global.fetch;
});

test("AI client normalizes glossary terminology before sending Rough Notes without changing stored notes", async () => {
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      analysis: {
        issue_summary: "GVEND network issue",
        account_number: "",
        caller_role: "rep",
        troubleshooting_steps: [],
        conditional_next_steps: [],
        resolution: "",
        root_cause: "",
        resolved: false
      },
      model: "test-model"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const raw = "OSR checked g vend and cradle point, then opened service now.";
  await analyzeWithWorkersAi({
    tokenEndpoint: "https://incident.example.workers.dev/token",
    roughNotes: raw,
    category: "KeepStock",
    subcategory: "Network"
  });

  assert.match(requestBody.rough_notes, /GVEND/);
  assert.match(requestBody.rough_notes, /Cradlepoint/);
  assert.match(requestBody.rough_notes, /ServiceNow/);
  assert.equal(raw, "OSR checked g vend and cradle point, then opened service now.");
  delete global.fetch;
});
