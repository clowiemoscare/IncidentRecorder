import { normalizeKeepStockTerminology } from "../config/terminology.js";

export function normalizeLine(text) {
  return String(text || "")
    .replace(/[\u2022\u00b7]/g, " ")
    .replace(/^[-*]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTerms(text) {
  return normalizeKeepStockTerminology(normalizeLine(text))
    .replace(/\baccess\s+skip\b/gi, "access KeepStock");
}

export function sentence(text) {
  const clean = normalizeTerms(text);
  if (!clean) return "";
  const capped = clean[0].toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}


export function limitSentences(text, maxSentences = 2) {
  const clean = normalizeTerms(text);
  if (!clean) return "";
  const max = Math.max(1, Number(maxSentences) || 1);
  const parts = [];
  let start = 0;
  for (let i = 0; i < clean.length; i += 1) {
    if (!/[.!?]/.test(clean[i])) continue;
    let end = i + 1;
    while (end < clean.length && /[.!?]/.test(clean[end])) end += 1;
    const remainder = clean.slice(end);
    const next = remainder.match(/^\s+([A-Z0-9"'])/);
    if (end === clean.length || next) {
      parts.push(clean.slice(start, end).trim());
      start = end;
      while (start < clean.length && /\s/.test(clean[start])) start += 1;
      i = start - 1;
    }
  }
  if (start < clean.length) parts.push(clean.slice(start).trim());
  const limited = (parts.length ? parts : [clean]).filter(Boolean).slice(0, max).join(" " ).trim();
  if (!limited) return "";
  const capped = limited[0].toUpperCase() + limited.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

export function extractResolution(text) {
  const source = String(text || "");
  const match = source.match(/(?:^|\n)Resolution:\s*([\s\S]*?)(?=\n(?:Reason for Escalation|Root Cause|Issue Type|Why are we making changes to the data):|\s*$)/i);
  return String(match?.[1] || "").trim();
}

export function uniqueExact(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeTerms(item).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function splitTranscript(raw) {
  return String(raw || "")
    .replace(/\r/g, "\n")
    .replace(/[\u2022\u00b7]/g, "\n")
    .split(/\n|;|(?<=[.!?])\s+/)
    .map(normalizeTerms)
    .filter(Boolean);
}

export function cleanNotes(raw) {
  const filler = /^(hi|hello|hey|thanks|thank you|okay|ok|um|uh|hmm|so|basically|you know|good morning|good afternoon|good evening)\b/i;
  return uniqueExact(splitTranscript(raw).filter((line) => !filler.test(line) || line.split(/\s+/).length > 5)).join("\n");
}

export function stripIssuePrefix(text) {
  return normalizeTerms(text)
    .replace(/^(?:issue|problem|reason for (?:the )?call)\s*[:\-]\s*/i, "")
    .replace(/^(?:caller|customer|user|rep)\s+(?:wanted to|needs? to|is trying to|reported that|reported)\s+/i, "")
    .replace(/^(?:caller|customer|rep)\s+/i, "")
    .replace(/^user\s+(?!group\b)/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}
