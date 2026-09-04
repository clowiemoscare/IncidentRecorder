import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceSnapshot,
  analysisDelta,
  createLiveSession,
  mergeIncrementalAnalysis,
  notesSinceSnapshot,
  wordCount
} from "../src/ticket/session.js";

test("initial live session treats all Rough Notes as unprocessed", () => {
  const session = createLiveSession();
  assert.equal(session.snapshotNumber, 0);
  assert.equal(notesSinceSnapshot("Checked power.\nChecked cable.", session), "Checked power.\nChecked cable.");
});

test("snapshot checkpoint returns only notes appended after the captured Rough Notes", () => {
  const analysis = {
    issueSummary: "Machine not communicating",
    troubleshootingSteps: ["Confirmed machine had power."],
    conditionalNextSteps: [],
    resolution: "",
    rootCause: "",
    resolved: false
  };
  const session = advanceSnapshot(createLiveSession(), {
    roughNotes: "Confirmed machine had power.",
    analysis,
    generatedAt: "2026-09-02T18:00:00.000Z",
    ticketType: "initial"
  });
  const current = "Confirmed machine had power.\nReseated the Molex cable.\nPower cycled the PC.";
  assert.equal(session.snapshotNumber, 1);
  assert.equal(session.lastTicketType, "initial");
  assert.equal(session.checkpointIndex, "Confirmed machine had power.".length);
  assert.equal(notesSinceSnapshot(current, session), "Reseated the Molex cable.\nPower cycled the PC.");
  assert.equal(wordCount(notesSinceSnapshot(current, session)), 8);
});

test("incremental local analysis preserves previous context and appends new actions", () => {
  const previous = {
    issueSummary: "Machine not communicating",
    accountNumber: "001234",
    troubleshootingSteps: ["Confirmed machine had power."],
    conditionalNextSteps: [],
    resolution: "",
    rootCause: "",
    resolved: false
  };
  const incremental = {
    issueSummary: "Power cycled the PC",
    troubleshootingSteps: ["Power cycled the PC.", "Confirmed communication was restored."],
    conditionalNextSteps: [],
    resolution: "Communication was restored.",
    resolved: true
  };
  const merged = mergeIncrementalAnalysis(previous, incremental);
  assert.equal(merged.issueSummary, "Machine not communicating");
  assert.equal(merged.accountNumber, "001234");
  assert.deepEqual(merged.troubleshootingSteps, [
    "Confirmed machine had power.",
    "Power cycled the PC.",
    "Confirmed communication was restored."
  ]);
  assert.equal(merged.resolution, "Communication was restored.");
});

test("analysis delta contains only new troubleshooting and changed outcome", () => {
  const previous = {
    issueSummary: "Machine not communicating",
    troubleshootingSteps: ["Confirmed machine had power."],
    conditionalNextSteps: ["Replace the cable if communication remains offline."],
    resolution: "",
    rootCause: "",
    resolved: false
  };
  const next = {
    issueSummary: "Machine not communicating",
    troubleshootingSteps: ["Confirmed machine had power.", "Reseated the Molex cable.", "Power cycled the PC."],
    conditionalNextSteps: ["Replace the cable if communication remains offline."],
    resolution: "Communication was restored after the power cycle.",
    rootCause: "Likely loose cable connection",
    resolved: true
  };
  const delta = analysisDelta(previous, next);
  assert.deepEqual(delta.troubleshootingSteps, ["Reseated the Molex cable.", "Power cycled the PC."]);
  assert.deepEqual(delta.conditionalNextSteps, []);
  assert.equal(delta.resolution, "Communication was restored after the power cycle.");
  assert.equal(delta.rootCause, "Likely loose cable connection");
});

test("live-session updates preserve a detected rep role when the incremental fallback is neutral", () => {
  const previous = {
    issueSummary: "Pending order approval issue",
    callerRole: "rep",
    troubleshootingSteps: ["Guided the rep to open the Punch Out account."],
    conditionalNextSteps: [],
    resolution: "",
    resolved: false
  };
  const incremental = {
    callerRole: "caller",
    troubleshootingSteps: ["Confirmed the pending order summary opened."],
    conditionalNextSteps: [],
    resolution: "Guided the rep through the approval process.",
    resolved: true
  };
  const merged = mergeIncrementalAnalysis(previous, incremental);
  assert.equal(merged.callerRole, "rep");
});
