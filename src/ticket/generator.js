import { sentence, stripIssuePrefix, uniqueExact } from "./text.js";
import { renderDetailedDescription } from "./templates.js";

function cleanIssue(issue) {
  const value = stripIssuePrefix(issue || "Issue not identified from rough notes");
  if (!value) return "Issue not identified from rough notes";
  return value[0].toUpperCase() + value.slice(1);
}

export function buildShortDescription({ accountNumber, issueSummary }) {
  const account = String(accountNumber || "").trim();
  const issue = cleanIssue(issueSummary);
  return `Acct #: ${account} | issue - ${issue}`.slice(0, 180);
}

export function buildWorkNotes({ issueLabel, analysis }) {
  const steps = uniqueExact((analysis?.troubleshootingSteps || []).map(sentence).filter(Boolean));
  const conditional = uniqueExact((analysis?.conditionalNextSteps || []).map(sentence).filter(Boolean));
  const documented = [...steps];
  for (const step of conditional) documented.push(`Conditional next step: ${step}`);
  const stepText = documented.map((item) => `- ${item}`).join("\n");
  const resolution = sentence(analysis?.resolution || "");
  return `Issue:\n${issueLabel || cleanIssue(analysis?.issueSummary)}\n\nTroubleshooting Steps:\n${stepText}\n\nResolution:\n${resolution}\n\nReason for Escalation:\n`;
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
  const resolvedFields = { ...fields, accountNumber };
  const generated = {
    shortDescription: buildShortDescription({ accountNumber, issueSummary: analysis?.issueSummary }),
    detailedDescription: renderDetailedDescription({ categoryId, subcategoryId, fields: resolvedFields }),
    workNotes: buildWorkNotes({ issueLabel: subcategoryLabel, analysis })
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
