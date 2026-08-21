import { cleanNotes, normalizeTerms, sentence, splitTranscript, stripIssuePrefix, uniqueExact } from "./text.js";

const CHATTER_PATTERNS = [
  /\bhow can i help you\b/i,
  /\b(?:first and last name|confirm your .*id|what(?:'s| is) the account number|who was the contact|what email address|what user id do you use)\b/i,
  /\b(?:bear with me|just a second|just a moment|let me look (?:you|this) up|let me look this up real quick|you hear me|can you hear me)\b/i,
  /\bdo you have any other questions\b/i,
  /^(?:hi|hello|hey|thanks|thank you|awesome|great|perfect|okay|ok|sure|gotcha|all right|alright|yeah|yep|bye|bye-bye)\b[.!]?$/i,
  /^(?:thank you|thanks).*(?:day|bye)/i
];

const ACTION_VERBS = /\b(?:check(?:ed|ing)?|confirm(?:ed|ing)?|verif(?:y|ied|ying)|review(?:ed|ing)?|look(?:ed)?\s+up|pull(?:ed)?\s+up|open(?:ed|ing)?|navigate(?:d|ing)?|go\s+to|click(?:ed|ing)?|select(?:ed|ing)?|search(?:ed|ing)?|edit(?:ed|ing)?|update(?:d|ing)?|change(?:d|ing)?|set(?:ting)?|assign(?:ed|ing)?|add(?:ed|ing)?|remove(?:d|ing)?|save(?:d|ing)?|reset(?:ting)?|restart(?:ed|ing)?|reboot(?:ed|ing)?|power\s+cycl(?:e|ed|ing)|reseat(?:ed|ing)?|reconnect(?:ed|ing)?|disconnect(?:ed|ing)?|replace(?:d|ing)?|enable(?:d|ing)?|disable(?:d|ing)?|test(?:ed|ing)?|retest(?:ed|ing)?|ping(?:ed|ing)?|scan(?:ned|ning)?|identify|identified|found|determin(?:e|ed)|advise(?:d|ing)?|instruct(?:ed|ing)?|guide(?:d|ing)?|train(?:ed|ing)?|explain(?:ed|ing)?|sent|shared|provided|emailed|messaged|log(?:ged)?\s+(?:in|out)|sign(?:ed)?\s+(?:in|out))\b/i;

const FINDING_TERMS = /\b(?:error|failed|unable|offline|online|conflict|not assigned|guest user|admin user|no power|has power|packet loss|prompt|access|limit|dispensing|communication|connected|disconnected|returned to the login screen)\b/i;

const CONDITIONAL_PREFIX = /^(?:if\b|if it\b|if he\b|if she\b|if they\b|if the\b|if that\b|if this\b|then if\b|in case\b)/i;

function isChatter(line) {
  return CHATTER_PATTERNS.some((pattern) => pattern.test(line));
}

function isMeaningfulAction(line) {
  const text = normalizeTerms(line);
  if (!text || isChatter(text)) return false;
  return ACTION_VERBS.test(text) || FINDING_TERMS.test(text);
}

function splitCompoundActions(line) {
  const text = normalizeTerms(line);
  if (!text) return [];
  const clauses = text
    .split(/\b(?:and then|after that|then|after confirming|after checking|after power cycling)\b|,(?=\s*(?:we|i|you|the|customer|rep)\b)/i)
    .map((part) => normalizeTerms(part))
    .filter(Boolean);
  return clauses.length > 1 ? clauses : [text];
}

function canonicalizeAction(line) {
  let text = normalizeTerms(line)
    .replace(/^(?:so|and|then|after that|after confirming|after checking|after power cycling)\s+/i, "")
    .replace(/\bwe(?:'re| are)\b/gi, "")
    .replace(/\bi(?:'m| am)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/\bmake sure\b.*\b(?:both )?machines?\b.*\bpower\b/i.test(text) || /\bconfirm(?:ed)?\b.*\b(?:both )?machines?\b.*\bpower\b/i.test(text)) {
    return "Confirmed both machines had power";
  }
  if (/\b(?:serial|molex)\b.*\bcable\b/i.test(text) && /\b(?:check|reseat|connection)/i.test(text)) {
    return "Checked and reseated the serial/Molex cable connections";
  }
  if (/\bpower\s+cycl/i.test(text) && /\bpc\b/i.test(text)) return "Power cycled the PC";
  if (/\bback to the login screen\b/i.test(text)) return "Confirmed the PC returned to the login screen";
  if (/\bguest user\b/i.test(text)) return "Confirmed the user was configured as a Guest user";
  if (/\bupdate\b.*\brole\b.*\badmin\b/i.test(text)) return "Updated the user's role to Admin";
  if (/\bvending and inventory management\b/i.test(text) && /\b(?:system|access|give|needs?)\b/i.test(text)) return "Granted Vending and Inventory Management access";
  if (/\bkeepstock web admin\b/i.test(text)) return "Granted KeepStock Web Admin access";
  if (/\blog out\b.*\blog back in\b/i.test(text)) return "Instructed the customer to log out and back into Grainger.com and open KeepStock to verify access";
  if (/\bpart number\b/i.test(text)) return text.replace(/^and\s+/i, "");
  if (/\bsent\b.*\blink\b.*\bteams\b/i.test(text) || /\blink\b.*\bteams\b/i.test(text)) return "Sent the requested link via Teams";
  return text;
}

function inferIssue(lines) {
  const joined = lines.join(" ");
  if (/ordering|order.*new tray harness|new tray harness/i.test(joined)) return "Ordering new tray harness";
  if (/initialization[^.]{0,120}(?:fail|failed)/i.test(joined) && /unable to communicate/i.test(joined)) return "Machine initialization failed - unable to communicate";
  if (/guest user|unable to access|keepstock user id and password|keepstock web/i.test(joined) && /admin|access/i.test(joined)) return "Unable to access KeepStock Web";
  if (/password reset/i.test(joined)) return "KeepStock password reset";
  const candidate = lines.find((line) => !isChatter(line) && !/^account number\b/i.test(line));
  return stripIssuePrefix(candidate || "Issue not identified from rough notes");
}

function partsResolution(rawNotes, steps) {
  const combined = `${rawNotes}\n${steps.join("\n")}`;
  const partsContext = /\b(?:parts? assistance|parts? request|mrf|tray harness|part number|replacement part)\b/i.test(combined);
  if (!partsContext) return "";
  const linkDone = /\b(?:sent|shared|provided|emailed|messaged)\b[^.\n]{0,100}\b(?:link|form|request)\b/i.test(combined)
    || /\b(?:link|form)\b[^.\n]{0,100}\b(?:sent|shared|provided)\b/i.test(combined);
  const match = rawNotes.match(/\bpart\s*(?:number|#|no\.?)\s*(?:for\s+(?:the\s+)?)?([A-Za-z][A-Za-z0-9 /_-]{1,60}?)\s+(?:is|was)\s+([A-Z0-9-]{3,})\b/i);
  const partName = match?.[1]?.trim().replace(/^(?:a|an|the)\s+/i, "") || "";
  const partNumber = match?.[2]?.trim() || (combined.match(/\b([A-Z]{1,6}[A-Z0-9-]*\d[A-Z0-9-]*)\b/)?.[1] || "");
  if (!linkDone && !partNumber) return "";
  const pieces = [];
  if (linkDone) pieces.push(`Provided the parts-request link${/\bteams\b/i.test(combined) ? " via Teams" : ""}`);
  if (partNumber) pieces.push(`supplied ${partName ? `${partName} ` : ""}part number ${partNumber}`);
  return sentence(pieces.join(" and "));
}

function inferResolution(rawNotes, steps, conditionalNextSteps) {
  const joined = `${rawNotes}\n${steps.join("\n")}`;
  const parts = partsResolution(rawNotes, steps);
  if (parts) return parts;
  if (/\bupdated\b.*\brole\b.*\badmin\b/i.test(joined) && /\bkeepstock web admin\b/i.test(joined)) {
    return "Updated the user's role to Admin and granted the required Vending and Inventory Management and KeepStock Web Admin access.";
  }
  if (/\bpower\s+cycl/i.test(joined) && /\b(?:reseat|cable)/i.test(joined) && /\b(?:resolved|communication.*restored|confirm.*resolved)/i.test(joined)) {
    return "Resolved the machine communication issue by reseating the cable connections and power cycling the PC; access was verified afterward.";
  }
  if (/\btrained\b|\bguided\b|\binstructed\b/i.test(joined) && /\b(?:create user|assign.*program|program management)/i.test(joined)) {
    return "Provided the requested KeepStock Web training and guidance.";
  }
  const explicit = splitTranscript(rawNotes).find((line) => /\b(?:resolved|fixed|working now|successful|restored|confirmed.*access)\b/i.test(line) && !CONDITIONAL_PREFIX.test(line));
  if (explicit) return sentence(explicit);
  if (conditionalNextSteps.length && !/\b(?:completed|successful|resolved|fixed|provided|sent|updated|trained|guided)\b/i.test(joined)) return "";
  return "";
}

export function analyzeLocally(rawNotes) {
  const cleaned = cleanNotes(rawNotes);
  const lines = cleaned.split(/\n+/).filter(Boolean);
  const steps = [];
  const conditionalNextSteps = [];

  for (const line of lines) {
    const normalized = normalizeTerms(line);
    if (!normalized || isChatter(normalized)) continue;
    if (CONDITIONAL_PREFIX.test(normalized)) {
      if (ACTION_VERBS.test(normalized) || FINDING_TERMS.test(normalized)) conditionalNextSteps.push(sentence(normalized));
      continue;
    }
    if (!isMeaningfulAction(normalized)) continue;
    for (const clause of splitCompoundActions(normalized)) {
      if (!isMeaningfulAction(clause)) continue;
      steps.push(sentence(canonicalizeAction(clause)));
    }
  }

  const uniqueSteps = uniqueExact(steps);
  const uniqueConditional = uniqueExact(conditionalNextSteps);
  const resolution = inferResolution(rawNotes, uniqueSteps, uniqueConditional);
  return {
    source: "local",
    issueSummary: inferIssue(lines),
    troubleshootingSteps: uniqueSteps,
    resolution,
    conditionalNextSteps: uniqueConditional,
    resolved: Boolean(resolution),
    cleanedNotes: cleaned
  };
}
