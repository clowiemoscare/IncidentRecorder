import { limitSentences, sentence, stripIssuePrefix, uniqueExact } from "./text.js";
import { templateFamilyFor } from "../config/ticket-routing.js";
import { renderDetailedDescription } from "./templates.js";

function cleanIssue(issue) {
  const value = stripIssuePrefix(issue || "Issue not identified from rough notes");
  if (!value) return "Issue not identified from rough notes";
  return value[0].toUpperCase() + value.slice(1);
}

const ACCOUNT_SHORT_DESCRIPTION_CATEGORIES = new Set([
  "keepstock_onsite",
  "keepstock_canada_onsite"
]);

export function buildShortDescription({ accountNumber, cribProgramId, issueSummary, categoryId = "" }) {
  const issue = cleanIssue(issueSummary);
  if (ACCOUNT_SHORT_DESCRIPTION_CATEGORIES.has(categoryId)) {
    const account = String(accountNumber || "").trim();
    return `Acct #: ${account} | ${issue}`.slice(0, 180);
  }
  const crib = String(cribProgramId || "").trim();
  return `Crib #: ${crib} | ${issue}`.slice(0, 180);
}

function documentedSteps(analysis) {
  const steps = uniqueExact((analysis?.troubleshootingSteps || []).map(sentence).filter(Boolean));
  const conditional = uniqueExact((analysis?.conditionalNextSteps || []).map(sentence).filter(Boolean));
  const documented = [...steps];
  for (const step of conditional) documented.push(`Conditional next step: ${step}`);
  return documented;
}

export function buildStandardWorkNotes({ issueLabel, analysis }) {
  const stepText = documentedSteps(analysis).map((item) => `- ${item}`).join("\n");
  const resolution = limitSentences(analysis?.resolution || "", 2);
  return `Issue:\n${analysis?.issueSummary ? cleanIssue(analysis.issueSummary) : issueLabel}\n\nTroubleshooting Steps:\n${stepText}\n\nResolution:\n${resolution}\n\nReason for Escalation:\n`;
}

export function buildGen2WorkNotes({ analysis, fields = {} }) {
  const stepText = documentedSteps(analysis).map((item) => `- ${item}`).join("\n");
  const issue = cleanIssue(analysis?.issueSummary);
  const resolution = limitSentences(analysis?.resolution || "", 2);
  const rootCause = String(fields?.rootCause || analysis?.rootCause || "").trim();
  const issueType = String(fields?.issueType || "").trim() || "(Data Load Failure, Data Maintenance, Knowledge Gap, System, Hardware)";
  const whyDataChanges = String(fields?.whyDataChanges || "").trim();
  return `Issue: ${issue}\n\nTroubleshooting:${stepText ? `\n${stepText}` : ""}\n\nResolution: ${resolution}\n\nRoot Cause: ${rootCause}\n\nIssue Type: ${issueType}\n\nWhy are we making changes to the data: ${whyDataChanges}`;
}

export function buildWorkNotes({ categoryId = "", issueLabel, analysis, fields = {} }) {
  return templateFamilyFor(categoryId) === "gen2"
    ? buildGen2WorkNotes({ analysis, fields })
    : buildStandardWorkNotes({ issueLabel, analysis });
}

export function renderTicketText(ticket) {
  return `Short Description:\n${ticket.shortDescription}\n\nDetailed Description:\n${ticket.detailedDescription}\n\nWork Notes:\n${ticket.workNotes}`;
}

export function generateTicketModel({
  categoryId,
  subcategoryId,
  subcategoryLabel,
  fields,
  analysis,
  overrides = {}
}) {
  const accountNumber = String(fields?.accountNumber || analysis?.accountNumber || "").trim();
  const cribProgramId = String(fields?.cribProgramId || "").trim();
  const resolvedFields = { ...fields, accountNumber, cribProgramId };
  const generated = {
    shortDescription: buildShortDescription({ accountNumber, cribProgramId, issueSummary: analysis?.issueSummary, categoryId }),
    detailedDescription: renderDetailedDescription({ categoryId, subcategoryId, fields: resolvedFields, analysis }),
    workNotes: buildWorkNotes({ categoryId, issueLabel: subcategoryLabel, analysis, fields: resolvedFields })
  };
  const ticket = {
    shortDescription: overrides.shortDescription ?? generated.shortDescription,
    detailedDescription: overrides.detailedDescription ?? generated.detailedDescription,
    workNotes: overrides.workNotes ?? generated.workNotes,
    fields: resolvedFields,
    analysis,
    categoryId,
    subcategoryId
  };
  ticket.fullText = renderTicketText(ticket);
  return ticket;
}
export function generateTicketUpdateModel({
  categoryId,
  subcategoryLabel,
  fields,
  analysis
}) {
  const workNotes = buildWorkNotes({ categoryId, issueLabel: subcategoryLabel, analysis, fields });
  return {
    workNotes,
    fullText: `Work Notes:\n${workNotes}`,
    categoryId,
    analysis
  };
}

