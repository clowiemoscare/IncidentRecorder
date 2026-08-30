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
  assert.match(worker, /analysis_version:\s*4/);
});
