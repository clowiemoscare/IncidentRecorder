import { normalizeTerms, uniqueExact } from "./text.js";

const EMPTY_ANALYSIS = Object.freeze({
  source: "",
  issueSummary: "",
  accountNumber: "",
  troubleshootingSteps: [],
  conditionalNextSteps: [],
  resolution: "",
  rootCause: "",
  resolved: false,
  cleanedNotes: ""
});

function text(value) {
  return String(value || "").trim();
}

function list(value) {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function key(value) {
  return normalizeTerms(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function changed(next, previous) {
  const a = text(next);
  const b = text(previous);
  return a && key(a) !== key(b) ? a : "";
}

export function normalizeSessionAnalysis(analysis = {}) {
  return {
    ...EMPTY_ANALYSIS,
    source: text(analysis.source),
    issueSummary: text(analysis.issueSummary),
    accountNumber: text(analysis.accountNumber).replace(/\D/g, ""),
    troubleshootingSteps: uniqueExact(list(analysis.troubleshootingSteps)),
    conditionalNextSteps: uniqueExact(list(analysis.conditionalNextSteps)),
    resolution: text(analysis.resolution),
    rootCause: text(analysis.rootCause),
    resolved: Boolean(analysis.resolved),
    cleanedNotes: text(analysis.cleanedNotes)
  };
}

export function createLiveSession(data = {}) {
  const snapshotNumber = Math.max(0, Number(data.snapshotNumber || 0) || 0);
  return {
    snapshotNumber,
    checkpointIndex: Math.max(0, Number(data.checkpointIndex || 0) || 0),
    snapshotRoughNotes: String(data.snapshotRoughNotes || ""),
    lastGeneratedAt: text(data.lastGeneratedAt),
    lastAnalysis: snapshotNumber ? normalizeSessionAnalysis(data.lastAnalysis || {}) : null,
    latestUpdate: String(data.latestUpdate || "")
  };
}

export function wordCount(value) {
  const words = String(value || "").trim().match(/\S+/g);
  return words ? words.length : 0;
}

function commonPrefixBoundary(previous, current) {
  const max = Math.min(previous.length, current.length);
  let index = 0;
  while (index < max && previous[index] === current[index]) index += 1;
  if (index === max) return index;
  const newline = current.lastIndexOf("\n", index);
  return newline >= 0 ? newline + 1 : 0;
}

export function notesSinceSnapshot(currentRoughNotes, session) {
  const current = String(currentRoughNotes || "");
  const live = createLiveSession(session);
  if (!live.snapshotNumber) return current.trim();

  const previous = live.snapshotRoughNotes;
  if (previous && current.startsWith(previous)) return current.slice(previous.length).trim();

  // If an earlier note was edited after the snapshot, include the changed trailing
  // section plus anything appended afterward so the previous structured analysis
  // can be reconciled without re-sending the whole transcript.
  const start = previous ? commonPrefixBoundary(previous, current) : Math.min(live.checkpointIndex, current.length);
  return current.slice(start).trim();
}

export function mergeIncrementalAnalysis(previousAnalysis, incrementalAnalysis) {
  const previous = normalizeSessionAnalysis(previousAnalysis || {});
  const incoming = normalizeSessionAnalysis(incrementalAnalysis || {});
  const previousIssueIsGeneric = !previous.issueSummary || /issue not identified/i.test(previous.issueSummary);
  return {
    source: incoming.source || previous.source,
    issueSummary: previousIssueIsGeneric ? (incoming.issueSummary || previous.issueSummary) : previous.issueSummary,
    accountNumber: previous.accountNumber || incoming.accountNumber,
    troubleshootingSteps: uniqueExact([...previous.troubleshootingSteps, ...incoming.troubleshootingSteps]),
    conditionalNextSteps: uniqueExact([...previous.conditionalNextSteps, ...incoming.conditionalNextSteps]),
    resolution: incoming.resolution || previous.resolution,
    rootCause: incoming.rootCause || previous.rootCause,
    resolved: Boolean(previous.resolved || incoming.resolved || incoming.resolution),
    cleanedNotes: [previous.cleanedNotes, incoming.cleanedNotes].filter(Boolean).join("\n")
  };
}

export function analysisDelta(previousAnalysis, nextAnalysis) {
  const previous = normalizeSessionAnalysis(previousAnalysis || {});
  const next = normalizeSessionAnalysis(nextAnalysis || {});
  const previousSteps = new Set(previous.troubleshootingSteps.map(key));
  const previousConditional = new Set(previous.conditionalNextSteps.map(key));

  return {
    source: next.source,
    issueSummary: next.issueSummary || previous.issueSummary,
    accountNumber: next.accountNumber || previous.accountNumber,
    troubleshootingSteps: next.troubleshootingSteps.filter((item) => !previousSteps.has(key(item))),
    conditionalNextSteps: next.conditionalNextSteps.filter((item) => !previousConditional.has(key(item))),
    resolution: changed(next.resolution, previous.resolution),
    rootCause: changed(next.rootCause, previous.rootCause),
    resolved: Boolean(next.resolved),
    cleanedNotes: ""
  };
}

export function advanceSnapshot(session, { roughNotes, analysis, latestUpdate = "", generatedAt = new Date().toISOString() } = {}) {
  const previous = createLiveSession(session);
  const snapshotRoughNotes = String(roughNotes || "");
  return {
    snapshotNumber: previous.snapshotNumber + 1,
    checkpointIndex: snapshotRoughNotes.length,
    snapshotRoughNotes,
    lastGeneratedAt: generatedAt,
    lastAnalysis: normalizeSessionAnalysis(analysis || {}),
    latestUpdate: String(latestUpdate || "")
  };
}
