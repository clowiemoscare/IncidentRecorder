import { normalizeTerms, uniqueExact } from "./text.js";

const EMPTY_ANALYSIS = Object.freeze({
  source: "",
  issueSummary: "",
  accountNumber: "",
  callerRole: "caller",
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
    callerRole: ["rep", "customer", "caller"].includes(text(analysis.callerRole).toLowerCase()) ? text(analysis.callerRole).toLowerCase() : "caller",
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
    snapshotCategoryId: text(data.snapshotCategoryId),
    snapshotSubcategoryId: text(data.snapshotSubcategoryId),
    lastGeneratedAt: text(data.lastGeneratedAt),
    lastTicketType: ["initial", "final"].includes(data.lastTicketType) ? data.lastTicketType : "",
    lastAnalysis: snapshotNumber ? normalizeSessionAnalysis(data.lastAnalysis || {}) : null,
    latestUpdate: String(data.latestUpdate || "")
  };
}

export function wordCount(value) {
  const words = String(value || "").trim().match(/\S+/g);
  return words ? words.length : 0;
}

export function snapshotCompatibility(currentRoughNotes, session, categoryId = "", subcategoryId = "") {
  const current = String(currentRoughNotes || "");
  const live = createLiveSession(session);
  if (!live.snapshotNumber || !live.lastAnalysis) return { compatible: false, reason: "no_snapshot" };
  // Older drafts did not store the route used by the snapshot. Force one full
  // reanalysis rather than combining analysis from an unknown route.
  if (!live.snapshotCategoryId || !live.snapshotSubcategoryId) return { compatible: false, reason: "legacy_snapshot" };
  if (text(categoryId) !== live.snapshotCategoryId || text(subcategoryId) !== live.snapshotSubcategoryId) {
    return { compatible: false, reason: "routing_changed" };
  }
  if (!live.snapshotRoughNotes || !current.startsWith(live.snapshotRoughNotes)) {
    return { compatible: false, reason: "earlier_notes_changed" };
  }
  return { compatible: true, reason: "append_only" };
}

export function notesSinceSnapshot(currentRoughNotes, session) {
  const current = String(currentRoughNotes || "");
  const live = createLiveSession(session);
  if (!live.snapshotNumber) return current.trim();
  const previous = live.snapshotRoughNotes;
  if (previous && current.startsWith(previous)) return current.slice(previous.length).trim();
  // Earlier notes were edited/deleted. Returning the complete current notes is
  // safer than returning a partial suffix that cannot remove stale AI facts.
  return current.trim();
}

export function mergeIncrementalAnalysis(previousAnalysis, incrementalAnalysis) {
  const previous = normalizeSessionAnalysis(previousAnalysis || {});
  const incoming = normalizeSessionAnalysis(incrementalAnalysis || {});
  const previousIssueIsGeneric = !previous.issueSummary || /issue not identified/i.test(previous.issueSummary);
  return {
    source: incoming.source || previous.source,
    issueSummary: previousIssueIsGeneric ? (incoming.issueSummary || previous.issueSummary) : previous.issueSummary,
    accountNumber: previous.accountNumber || incoming.accountNumber,
    callerRole: incoming.callerRole !== "caller" ? incoming.callerRole : previous.callerRole,
    troubleshootingSteps: uniqueExact([...previous.troubleshootingSteps, ...incoming.troubleshootingSteps]),
    conditionalNextSteps: uniqueExact([...previous.conditionalNextSteps, ...incoming.conditionalNextSteps]),
    resolution: incoming.resolution || previous.resolution,
    rootCause: incoming.rootCause || previous.rootCause,
    resolved: Boolean(previous.resolved || incoming.resolved),
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
    callerRole: next.callerRole || previous.callerRole,
    troubleshootingSteps: next.troubleshootingSteps.filter((item) => !previousSteps.has(key(item))),
    conditionalNextSteps: next.conditionalNextSteps.filter((item) => !previousConditional.has(key(item))),
    resolution: changed(next.resolution, previous.resolution),
    rootCause: changed(next.rootCause, previous.rootCause),
    resolved: Boolean(next.resolved),
    cleanedNotes: ""
  };
}

export function advanceSnapshot(session, { roughNotes, analysis, categoryId = "", subcategoryId = "", latestUpdate = "", generatedAt = new Date().toISOString(), ticketType = "" } = {}) {
  const previous = createLiveSession(session);
  const snapshotRoughNotes = String(roughNotes || "");
  return {
    snapshotNumber: previous.snapshotNumber + 1,
    checkpointIndex: snapshotRoughNotes.length,
    snapshotRoughNotes,
    snapshotCategoryId: text(categoryId),
    snapshotSubcategoryId: text(subcategoryId),
    lastGeneratedAt: generatedAt,
    lastTicketType: ["initial", "final"].includes(ticketType) ? ticketType : previous.lastTicketType,
    lastAnalysis: normalizeSessionAnalysis(analysis || {}),
    latestUpdate: String(latestUpdate || "")
  };
}
