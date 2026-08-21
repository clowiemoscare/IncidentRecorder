import { cleanNotes, normalizeTerms } from "./text.js";

export const DETAIL_FIELDS = [
  ["cribProgramId", "Crib/Program id"],
  ["programName", "Program name"],
  ["companyName", "Company name"],
  ["siteId", "Site ID"],
  ["accountNumber", "Acct #"],
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
  ["orderReposted", "Does user want order reposted"]
];

const DEFINITIONS = [
  ["cribProgramId", [
    /\b(?:crib|curb)(?:\s*\/\s*program)?\s*(?:id|number|num|#)?\s*(?:is\s+)?[:=#-]?\s*([A-Z0-9]+(?:-[A-Z0-9]+)+|\d{3,})\b/i,
    /\bprogram\s*(?:id|#)\s*(?:is\s+)?[:=#-]?\s*([A-Z0-9]+(?:-[A-Z0-9]+)+|\d{3,})\b/i
  ]],
  ["accountNumber", [
    /\b(?:acct|account)\s*(?:#|number|num)?\s*(?:is\s+)?[:=#-]?\s*(\d{4,})\b/i,
    /\b(\d{4,})\s+(?:acct|account)\b/i
  ]],
  ["deviceId", [/\bdevice\s*id(?:\s*\(affected\))?\s*[:=#-]?\s*([A-Z0-9-]{4,})\b/i]],
  ["machineSerial", [/\b(?:machine\s*)?serial(?:\s*number)?(?:\(s\))?\s*[:=#-]?\s*([A-Z0-9-]{5,})\b/i]],
  ["cradlepointSerial", [/\b(?:cradlepoint|cp)\s*serial(?:\s*number)?\s*[:=#-]?\s*([A-Z0-9-]{5,})\b/i]],
  ["siteId", [/\bsite\s*id\s*[:=#-]?\s*([A-Z0-9-]{3,})\b/i]],
  ["softwareVersion", [/\b(?:software|sw)\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)\b/i]],
  ["applicationVersion", [/\b(?:application|app)\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)\b/i]],
  ["phoneSoftwareVersion", [/\bphone\s*(?:software|sw)\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)\b/i]],
  ["imei", [/\bimei\s*[:=#-]?\s*([0-9]{8,20})\b/i]],
  ["carrier", [/\bcarrier\s*[:=-]\s*([A-Za-z][A-Za-z0-9 &.-]{1,30})/i]],
  ["badgeReader", [/\bbadge\s*reader\s*[:=-]\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,30})/i]],
  ["phoneModel", [/\bphone\s*model\s*[:=-]\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,40})/i]],
  ["model", [/\bmodel\s*[:=-]\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,40})/i]],
  ["application", [/\b(?:application|app)\s*[:=-]\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,40})/i]],
  ["timeIssueOccurred", [/\b(?:time issue occurred|issue time)\s*[:=-]?\s*([^.;]+)/i]],
  ["orderNumber", [/\border\s*(?:#|number|num)\s*(?:is\s+)?[:=#-]?\s*([A-Z0-9-]{3,})\b/i, /\border\s+(\d{5,})\b/i]],
  ["econnectionsStatus", [/\beconnections?\s*status\s*[:=-]\s*([^.;]+)/i]],
  ["sapStatusEbu", [/\b(?:sap\s*status(?:\s*\/\s*ebu\s*(?:number|#)?)?|ebu\s*(?:number|#))\s*[:=-]\s*([^.;]+)/i]],
  ["orderReposted", [/\b(?:does\s+user\s+want\s+order\s+reposted|order\s+reposted)\s*[:=-]\s*(yes|no)\b/i]],
  ["programName", [/\bprogram\s*name\s*[:=-]\s*([^.;]+)/i]],
  ["companyName", [/\b(?:company|customer)\s*name\s*[:=-]\s*([^.;]+)/i]]
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
