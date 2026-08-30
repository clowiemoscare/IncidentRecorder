import test from "node:test";
import assert from "node:assert/strict";
import { checkWorkersAiHealth, healthEndpoint, normalizeAiAnalysis, workersAiEndpoint } from "../src/ticket/ai-client.js";

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
    troubleshooting_steps: ["Reviewed the site task assignment"],
    conditional_next_steps: [],
    resolution: "Assigned the task to the site",
    root_cause: "Likely task-to-site assignment was missing",
    resolved: true
  }, {});

  assert.equal(normalized.rootCause, "Likely task-to-site assignment was missing");
  assert.equal(normalized.accountNumber, "001234");
});
