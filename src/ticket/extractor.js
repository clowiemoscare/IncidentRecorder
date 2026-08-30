import { cleanNotes, normalizeTerms } from "./text.js";

export const DETAIL_FIELDS = [
  ["cribProgramId", "Crib/Program id"],
  ["programName", "Program name"],
  ["companyName", "Company name"],
  ["siteId", "Site ID (If Applicable)"],
  ["accountNumber", "Acct # / Account Number"],
  ["softwareVersion", "Software Version"],
  ["deviceId", "Device ID (Affected)"],
  ["machineSerial", "Machine Serial Number(s)"],
  ["cradlepointSerial", "Cradlepoint Serial Number"],
  ["imei", "IMEI"],
  ["carrier", "Carrier"],
  ["badgeReader", "Badge Reader"],
  ["model", "Model"],
  ["phoneModel", "Phone Model"],
  ["phoneSoftwareVersion", "Phone Software Version"],
  ["application", "Application"],
  ["applicationVersion", "Application Version"],
  ["timeIssueOccurred", "Time issue occurred"],
  ["orderNumber", "Order #"],
  ["econnectionsStatus", "eConnections Status"],
  ["sapStatusEbu", "SAP Status/EBU Number"],
  ["orderReposted", "Does user want order reposted"],
  ["siteName", "Site Name"],
  ["currentTask", "Current Task"],
  ["screenshot", "Screenshot"],
  ["iosVersion", "IOS Version"],
  ["appVersion", "App Version"],
  ["customerAdminName", "Customer Admin Name"],
  ["customerAdminEmail", "Customer Admin Email"],
  ["browser", "Browser"],
  ["storageUnit", "Storage Unit"],
  ["rootCause", "Root Cause"],
  ["issueType", "Issue Type"],
  ["whyDataChanges", "Why are we making changes to the data"]
];

const DEFINITIONS = [
  ["cribProgramId", [
    /\b(?:crib|curb)(?:\s*\/\s*program)?\s*(?:id|number|num|#)?\s*(?:is\s+)?[:=#-]?\s*([A-Z0-9]+(?:-[A-Z0-9]+)+|\d{3,})\b/i,
    /\bprogram\s*(?:id|#)\s*(?:is\s+)?[:=#-]?\s*([A-Z0-9]+(?:-[A-Z0-9]+)+|\d{3,})\b/i
  ]],
  ["accountNumber", [
    /\b(?:acct|account)\s*(?:#|number|num)?\s*(?:\(optional\))?\s*(?:is\s+)?[:=#-]?\s*(\d{4,})\b/i,
    /\b(\d{4,})\s+(?:acct|account)\b/i
  ]],
  ["deviceId", [/\bdevice\s*id(?:\s*\(affected\)|\s*\(if vending related task\))?\s*[:=#-]?\s*([A-Z0-9-]{4,})\b/i]],
  ["machineSerial", [/\b(?:machine\s*)?serial(?:\s*number)?(?:\(s\))?\s*[:=#-]?\s*([A-Z0-9-]{5,})\b/i]],
  ["cradlepointSerial", [/\b(?:cradlepoint|cp)\s*serial(?:\s*number)?\s*[:=#-]?\s*([A-Z0-9-]{5,})\b/i]],
  ["siteId", [/\bsite\s*id(?:\s*\(if applicable\))?\s*[:=#-]?\s*([A-Z0-9-]{3,})\b/i]],
  ["siteName", [/\bsite\s*name\s*[:=-]\s*([^.;\n]+)/i]],
  ["softwareVersion", [/\b(?:software|sw)\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)\b/i]],
  ["applicationVersion", [/\bapplication\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)\b/i]],
  ["appVersion", [/\bapp\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)\b/i]],
  ["phoneSoftwareVersion", [/\bphone\s*(?:software|sw)\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)\b/i]],
  ["iosVersion", [/\bi\s*o\s*s\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)\b/i]],
  ["imei", [/\bimei\s*[:=#-]?\s*([0-9]{8,20})\b/i]],
  ["carrier", [/\bcarrier\s*[:=-]\s*([A-Za-z][A-Za-z0-9 &.-]{1,30})/i]],
  ["badgeReader", [/\bbadge\s*reader\s*[:=-]\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,30})/i]],
  ["phoneModel", [/\bphone\s*model\s*[:=-]\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,40})/i]],
  ["model", [/\bmodel\s*[:=-]\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,40})/i]],
  ["application", [/\b(?:application|app)\s*[:=-]\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,40})/i]],
  ["timeIssueOccurred", [/\b(?:time issue occurred|time of issue|issue time)\s*[:=-]?\s*([^.;\n]+)/i]],
  ["currentTask", [/\bcurrent\s*task\s*[:=-]\s*([^.;\n]+)/i]],
  ["screenshot", [/\bscreenshot(?:\s*\(\s*if possible\s*\))?\s*[:=-]\s*([^.;\n]+)/i]],
  ["customerAdminName", [/\bcustomer\s*admin\s*name\s*[:=-]\s*([^.;\n]+)/i]],
  ["customerAdminEmail", [/\bcustomer\s*admin\s*email\s*[:=-]\s*([^\s;]+@[^\s;]+)/i]],
  ["browser", [/\bbrowser\s*[:=-]\s*([^.;\n]+)/i]],
  ["storageUnit", [/\bstorage\s*unit\s*[:=-]\s*([^.;\n]+)/i]],
  ["rootCause", [/\broot\s*cause\s*[:=-]\s*([^.;\n]+)/i]],
  ["issueType", [/\bissue\s*type\s*[:=-]\s*([^.;\n]+)/i]],
  ["whyDataChanges", [/\bwhy\s+are\s+we\s+making\s+changes\s+to\s+the\s+data\s*[:=-]\s*([^.;\n]+)/i]],
  ["orderNumber", [/\border\s*(?:#|number|num)\s*(?:is\s+)?[:=#-]?\s*([A-Z0-9-]{3,})\b/i, /\border\s+(\d{5,})\b/i]],
  ["econnectionsStatus", [/\beconnections?\s*status\s*[:=-]\s*([^.;\n]+)/i]],
  ["sapStatusEbu", [/\b(?:sap\s*status(?:\s*\/\s*ebu\s*(?:number|#)?)?|ebu\s*(?:number|#))\s*[:=-]\s*([^.;\n]+)/i]],
  ["orderReposted", [/\b(?:does\s+user\s+want\s+order\s+reposted|order\s+reposted)\s*[:=-]\s*(yes|no)\b/i]],
  ["programName", [/\bprogram\s*name\s*[:=-]\s*([^.;\n]+)/i]],
  ["companyName", [/\b(?:company|customer)\s*name\s*[:=-]\s*([^.;\n]+)/i]]
];

export function emptyFields() {
  return Object.fromEntries(DETAIL_FIELDS.map(([id]) => [id, ""]));
}

export function extractFields(rawNotes, existing = {}) {
  const fields = { ...emptyFields(), ...existing };
  const lines = cleanNotes(rawNotes).split(/\n+/).map(normalizeTerms).filter(Boolean);

  for (const [id, regexes] of DEFINITIONS) {
    if (String(fields[id] || "").trim()) continue;
    for (const line of lines) {
      let found = "";
      for (const regex of regexes) {
        const match = line.match(regex);
        if (match) { found = match[1]; break; }
      }
      if (!found) continue;
      let normalized = normalizeTerms(found).replace(/\s+(?:and|then)$/i, "");
      if (id === "orderReposted") normalized = /^yes$/i.test(normalized) ? "Yes" : /^no$/i.test(normalized) ? "No" : normalized;
      fields[id] = normalized;
      break;
    }
  }

  if (!fields.programName) {
    for (let i = 0; i < lines.length; i += 1) {
      const sameLine = lines[i].match(/\b(?:crib|program)\b.*?\b(?:it\s+is\s+for|is\s+for)\s+(.+)$/i);
      if (sameLine?.[1]?.trim()) {
        fields.programName = sameLine[1].trim();
        break;
      }
      if (/\b(?:crib|program)\b.*?\b(?:it\s+is\s+for|is\s+for)\s*$/i.test(lines[i])) {
        const candidate = normalizeTerms(lines[i + 1] || "");
        if (candidate && candidate.length <= 90 && !/\b(?:how can i help|what|which|do you|can you|look it up)\b/i.test(candidate)) {
          fields.programName = candidate;
          break;
        }
      }
    }
  }

  return fields;
}
