import { cleanNotes, normalizeTerms, sentence, splitTranscript, stripIssuePrefix, uniqueExact } from "./text.js";

const CHATTER_PATTERNS = [
  /\bhow can i help you\b/i,
  /\b(?:first and last name|confirm your .*id|what(?:'s| is) the account number|who was the contact|what email address|what user id do you use)\b/i,
  /\b(?:bear with me|just a second|just a moment|let me look (?:you|this) up|let me look this up real quick|you hear me|can you hear me)\b/i,
  /^caller\s+(?:is|was)\s+(?:an?\s+)?(?:OSR|OSS|KSSC|MOS|DSM|On Site Representative|On Site Specialist|Account Manager)\b/i,
  /^(?:OSR|OSS|KSSC|MOS|DSM|rep|caller|customer)\s+(?:needs?|needed|wants?|wanted|is trying|cannot|can't|unable)\b/i,
  /\bdo you have any other questions\b/i,
  /^(?:hi|hello|hey|thanks|thank you|awesome|great|perfect|okay|ok|sure|gotcha|all right|alright|yeah|yep|bye|bye-bye)\b[.!]?$/i,
  /^(?:thank you|thanks).*(?:day|bye)/i
];

const ACTION_VERBS = /\b(?:check(?:ed|ing)?|confirm(?:ed|ing)?|verif(?:y|ied|ying)|review(?:ed|ing)?|look(?:ed)?\s+up|pull(?:ed)?\s+up|open(?:ed|ing)?|navigate(?:d|ing)?|go\s+to|click(?:ed|ing)?|select(?:ed|ing)?|search(?:ed|ing)?|edit(?:ed|ing)?|update(?:d|ing)?|change(?:d|ing)?|set(?:ting)?|assign(?:ed|ing)?|add(?:ed|ing)?|remove(?:d|ing)?|delet(?:e|ed|ing)|save(?:d|ing)?|reset(?:ting)?|restart(?:ed|ing)?|reboot(?:ed|ing)?|power\s+cycl(?:e|ed|ing)|reseat(?:ed|ing)?|reconnect(?:ed|ing)?|disconnect(?:ed|ing)?|replace(?:d|ing)?|enable(?:d|ing)?|disable(?:d|ing)?|test(?:ed|ing)?|retest(?:ed|ing)?|ping(?:ed|ing)?|scan(?:ned|ning)?|run|ran|move(?:d|ing)?|swap(?:ped|ping)?|install(?:ed|ing)?|uninstall(?:ed|ing)?|reinstall(?:ed|ing)?|configur(?:e|ed|ing)|sync(?:ed|ing)?|load(?:ed|ing)?|attempt(?:ed|ing)?|direct(?:ed|ing)?|contact(?:ed|ing)?|call(?:ed|ing)?|reach(?:ed)?\s+out|submit(?:ted|ting)?|attach(?:ed|ing)?|download(?:ed|ing)?|identify|identified|found|determin(?:e|ed)|advise(?:d|ing)?|instruct(?:ed|ing)?|guide(?:d|ing)?|train(?:ed|ing)?|explain(?:ed|ing)?|sent|shared|provided|emailed|messaged|log(?:ged)?\s+(?:in|out)|sign(?:ed)?\s+(?:in|out))\b/i;

const FINDING_TERMS = /\b(?:error|failed|failure|unable|offline|online|conflict|not assigned|guest user|admin user|no power|has power|packet loss|prompt|access|limit|dispensing|communication|connected|disconnected|returned to the login screen|device id|rack id|no password|password is blank|initialization|initialized|destination host unreachable|valid ip configuration|dhcp|mac address error|driver|drivers|hardware changes|auto detection|com port|test connection|network configuration|green|red|no activity)\b/i;

const CONDITIONAL_PREFIX = /^(?:if\b|if it\b|if he\b|if she\b|if they\b|if the\b|if that\b|if this\b|then if\b|in case\b|(?:rep|osr|oss|caller|customer)\s+(?:to|will)\b)/i;

export function inferCallerRole(rawNotes) {
  const text = normalizeTerms(rawNotes);
  if (!text) return "caller";

  const repEvidence = [
    /\b(?:guide|help|assist)\s+(?:the\s+)?customer\b/i,
    /\b(?:your|the)\s+customer\b[^.\n]{0,160}\b(?:call us|guide|help|assist|navigate|approve)\b/i,
    /\byou\s+guys\b[^.\n]{0,180}\b(?:customer|call us|guide|help|assist)\b/i,
    /\b(?:guided|trained|instructed|advised)\s+(?:the\s+)?rep\b/i,
    /\bcaller\s+(?:is|was)\s+(?:an?\s+)?(?:OSR|OSS|KSSC|MOS|DSM|On Site Representative|On Site Specialist|Account Manager)\b/i,
    /\b(?:OSR|OSS|KSSC|MOS|DSM)\b[^.\n]{0,90}\b(?:need(?:s|ed)?|called|asked|reported|wants?|trying|cannot|can't|unable)\b/i,
    /\b(?:On Site Representative|On Site Specialist|Account Manager)\b[^.\n]{0,90}\b(?:need(?:s|ed)?|called|asked|reported|wants?|trying|cannot|can't|unable)\b/i
  ];
  if (repEvidence.some((pattern) => pattern.test(text))) return "rep";

  const customerEvidence = [
    /\b(?:you are|you're)\s+(?:the\s+)?(?:customer|site contact|customer admin)\b/i,
    /\b(?:speaking with|talking to)\s+(?:the\s+)?customer\b/i,
    /\bcaller\s+(?:is|was)\s+(?:the\s+)?(?:customer|customer admin|site contact)\b/i,
    /\bcust(?:omer)?\s+caller\b/i
  ];
  if (customerEvidence.some((pattern) => pattern.test(text))) return "customer";
  return "caller";
}

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

function canonicalizeAction(line, callerRole = "caller") {
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
  if (/\blog out\b.*\blog back in\b/i.test(text)) {
    const audience = callerRole === "rep" ? "rep" : callerRole === "customer" ? "customer" : "caller";
    return `Instructed the ${audience} to log out and back into Grainger.com and open KeepStock to verify access`;
  }
  if (/\bpart number\b/i.test(text)) return text.replace(/^and\s+/i, "");
  if (/\bsent\b.*\blink\b.*\bteams\b/i.test(text) || /\blink\b.*\bteams\b/i.test(text)) return "Sent the requested link via Teams";
  return text;
}

function inferIssue(lines) {
  const joined = lines.join(" ");
  if (/\bnew tray harness\b|\b(?:order|ordering|replace|replacement)\b[^.]{0,80}\btray harness\b/i.test(joined)) return "Ordering new tray harness";
  if (/\b(?:Punch Out|Jaggaer)\b/i.test(joined) && /\b(?:pending order|approve|approval)\b/i.test(joined)) return "Unable to approve KeepStock pending order";
  if (/initialization[^.]{0,120}(?:fail|failed)/i.test(joined) && /unable to communicate/i.test(joined)) return "Machine initialization failed - unable to communicate";
  if (/guest user|unable to access|keepstock user id and password|keepstock web/i.test(joined) && /admin|access/i.test(joined)) return "Unable to access KeepStock Web";
  if (/password reset/i.test(joined)) return "KeepStock password reset";
  const candidate = lines.find((line) => !isChatter(line) && !/^account number\b/i.test(line));
  return stripIssuePrefix(candidate || "Issue not identified from rough notes");
}

function partsResolution(rawNotes, steps) {
  const combined = `${rawNotes}\n${steps.join("\n")}`;
  const partsContext = /\b(?:parts? assistance|parts? request|mrf|maintenance request form|prf|parts request form|tray harness|part number|replacement part)\b/i.test(combined);
  if (!partsContext) return "";
  const linkDone = /\b(?:sent|shared|provided|emailed|messaged)\b[^.\n]{0,100}\b(?:link|form|request|url)\b/i.test(combined)
    || /\b(?:link|form|url)\b[^.\n]{0,100}\b(?:sent|shared|provided)\b/i.test(combined);
  const mrfContext = /\b(?:MRF|Maintenance Request Form)\b/i.test(combined);
  const prfContext = /\b(?:PRF|Parts Request Form)\b/i.test(combined);
  const formCompleted = /\b(?:completed|submitted)\b[^.\n]{0,60}\b(?:MRF|Maintenance Request Form|PRF|Parts Request Form|form)\b/i.test(combined)
    || /\b(?:MRF|Maintenance Request Form|PRF|Parts Request Form|form)\b[^.\n]{0,60}\b(?:completed|submitted)\b/i.test(combined);
  const match = rawNotes.match(/\bpart\s*(?:number|#|no\.?)\s*(?:for\s+(?:the\s+)?)?([A-Za-z][A-Za-z0-9 /_-]{1,60}?)\s+(?:is|was)\s+([A-Z0-9-]{3,})\b/i);
  const partName = match?.[1]?.trim().replace(/^(?:a|an|the)\s+/i, "") || "";
  const partNumber = match?.[2]?.trim() || (combined.match(/\b([A-Z]{1,6}[A-Z0-9-]*\d[A-Z0-9-]*)\b/)?.[1] || "");
  if (!linkDone && !partNumber && !formCompleted) return "";
  const pieces = [];
  if (linkDone) {
    if (mrfContext) pieces.push("Provided the Maintenance Request Form (MRF) link");
    else if (prfContext) pieces.push("Provided the Parts Request Form (PRF) link");
    else pieces.push(`Provided the parts-request link${/\bteams\b/i.test(combined) ? " via Teams" : ""}`);
  }
  if (formCompleted) {
    if (mrfContext) pieces.push("confirmed the MRF was completed");
    else if (prfContext) pieces.push("confirmed the PRF was completed");
  }
  if (partNumber) pieces.push(`supplied ${partName ? `${partName} ` : ""}part number ${partNumber}`);
  return sentence(pieces.join(" and "));
}

function inferResolution(rawNotes, steps, conditionalNextSteps, callerRole = "caller") {
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
  if (/\b(?:Punch Out|Jaggaer)\b/i.test(joined) && /\b(?:pending order|approve|approval)\b/i.test(joined) && /\b(?:guide|guided|explain|explained|instruct|instructed|navigate)\b/i.test(joined)) {
    const audience = callerRole === "rep" ? "rep" : callerRole === "customer" ? "customer" : "caller";
    return `Guided the ${audience} through accessing and approving KeepStock pending orders through Punch Out and clarified that the order should not be accessed directly through Grainger.com.`;
  }
  if (/\bempty locations?\b/i.test(joined) && /\bdelet(?:e|ed|ing)\b/i.test(joined) && /\b(?:reboot(?:ed|ing)?|restart(?:ed|ing)?)\b/i.test(joined) && /\bwithout error\b/i.test(joined)) {
    return "Removed the EMPTY locations, rebooted the application, and verified items could be added without error.";
  }
  if (/\bmobile cast\b/i.test(joined) && /\bsign\s*in\b/i.test(joined) && /\bsuccessful(?:ly)?\b/i.test(joined)) {
    const audience = callerRole === "rep" ? "rep" : callerRole === "customer" ? "customer" : "caller";
    return `${audience[0].toUpperCase()}${audience.slice(1)} signed into Mobile Cast successfully.`;
  }
  const explicit = splitTranscript(rawNotes).find((line) => /\b(?:resolved|fixed|working now|successful(?:ly)?|restored|confirmed.*access|can now access|now able to access|without error)\b/i.test(line) && !CONDITIONAL_PREFIX.test(line));
  if (explicit) return sentence(explicit);
  if (conditionalNextSteps.length && !/\b(?:completed|successful|resolved|fixed|provided|sent|updated|trained|guided)\b/i.test(joined)) return "";
  return "";
}

export function analyzeLocally(rawNotes) {
  const cleaned = cleanNotes(rawNotes);
  const lines = cleaned.split(/\n+/).filter(Boolean);
  const steps = [];
  const conditionalNextSteps = [];
  const callerRole = inferCallerRole(rawNotes);

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
      steps.push(sentence(canonicalizeAction(clause, callerRole)));
    }
  }

  const uniqueSteps = uniqueExact(steps);
  const uniqueConditional = uniqueExact(conditionalNextSteps);
  const resolution = inferResolution(rawNotes, uniqueSteps, uniqueConditional, callerRole);
  return {
    source: "local",
    callerRole,
    issueSummary: inferIssue(lines),
    troubleshootingSteps: uniqueSteps,
    resolution,
    conditionalNextSteps: uniqueConditional,
    resolved: Boolean(resolution),
    cleanedNotes: cleaned
  };
}
