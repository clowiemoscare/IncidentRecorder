import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../cloudflare/worker.mjs", import.meta.url), "utf8");

test("Worker structured output includes a root_cause field", () => {
  assert.match(worker, /root_cause:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(worker, /required:\s*\[[^\]]*"root_cause"/s);
});

test("Worker root-cause prompt is evidence constrained and versioned", () => {
  assert.match(worker, /Infer one concise possible root cause from the documented troubleshooting findings and completed resolution only/i);
  assert.match(worker, /If the troubleshooting and resolution do not support a meaningful root cause, return an empty string/i);
  assert.match(worker, /analysis_version:\s*7/);
});


test("Worker update mode combines previous structured analysis with only new Rough Notes", () => {
  assert.match(worker, /analysis_mode/);
  assert.match(worker, /previous_analysis/);
  assert.match(worker, /NEW ROUGH NOTES SINCE THE LAST TICKET SNAPSHOT/);
  assert.match(worker, /Return the COMPLETE updated structured analysis/i);
  assert.match(worker, /Previous analysis is required for an update/);
});

test("Worker classifies caller role without assuming every caller is a customer", () => {
  assert.match(worker, /caller_role:\s*\{\s*type:\s*"string"[^}]*enum:\s*\["rep",\s*"customer",\s*"caller"\]/s);
  assert.match(worker, /Never assume customer simply because this is a support call/i);
  assert.match(worker, /guide the customer/i);
  assert.match(worker, /When caller_role is rep/i);
  assert.match(worker, /Do not assume that a named affected user is the caller/i);
  assert.match(worker, /third person/i);
});

test("Worker requires a high-recall coverage pass and receives local coverage candidates", () => {
  assert.match(worker, /A multi-step walkthrough must remain multiple troubleshooting steps/i);
  assert.match(worker, /Do not replace a documented navigation sequence with a vague summary/i);
  assert.match(worker, /perform a coverage pass over the Rough Notes from beginning to end/i);
  assert.match(worker, /coverage_candidates/);
  assert.match(worker, /LOCAL COVERAGE CANDIDATES/);
  assert.match(worker, /max_tokens:\s*4500/);
});

test("Worker keeps unconfirmed future outcomes out of Resolution", () => {
  assert.match(worker, /will receive/);
  assert.match(worker, /will be able to/);
  assert.match(worker, /place unconfirmed future guidance in conditional_next_steps/i);
  assert.match(worker, /even when the future\/conditional clause appears in the middle of a longer sentence/i);
});


test("Worker includes glossary-informed role and terminology guidance", () => {
  assert.match(worker, /KEEPSTOCK DOMAIN GLOSSARY/);
  assert.match(worker, /OSR: On Site Representative/);
  assert.match(worker, /MRF: Maintenance Request Form/);
  assert.match(worker, /PRF: Parts Request Form/);
  assert.match(worker, /Cradlepoint/);
  assert.match(worker, /On Hand Balance \/ OHB/);
  assert.match(worker, /Do not interpret the ordinary verb "am" as the AM role/i);
  assert.match(worker, /knowledge_version: KNOWLEDGE_VERSION/);
});

test("Worker uses de-identified historical ServiceNow patterns only as style guidance", () => {
  assert.match(worker, /HISTORICAL SERVICENOW REFERENCE PATTERNS/);
  assert.match(worker, /NEVER copy facts from these examples into the current incident/i);
  assert.match(worker, /ipconfig/);
  assert.match(worker, /COM connections/);
  assert.match(worker, /MRF or PRF link/);
  assert.match(worker, /Current Rough Notes remain the only evidence/i);
});

test("Worker keeps planned rep and OSR actions out of completed resolution", () => {
  assert.match(worker, /"rep to"/i);
  assert.match(worker, /"OSR to"/i);
  assert.match(worker, /"will mass assign"/i);
  assert.match(worker, /future guidance only in conditional_next_steps/i);
});
