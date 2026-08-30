export function workersAiEndpoint(tokenEndpoint) {
  const raw = String(tokenEndpoint || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.pathname = "/analyze";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function healthEndpoint(tokenEndpoint) {
  const raw = String(tokenEndpoint || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.pathname = "/health";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export async function checkWorkersAiHealth({ tokenEndpoint, timeoutMs = 3500 } = {}) {
  const endpoint = healthEndpoint(tokenEndpoint);
  if (!endpoint) return { reachable: false, workersAiConfigured: false, reason: "endpoint_not_configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal
    });
    let payload = {};
    try { payload = await response.json(); } catch { /* handled below */ }
    if (!response.ok) throw new Error(payload?.error || `Worker health check failed (${response.status})`);
    return {
      reachable: true,
      workersAiConfigured: Boolean(payload?.workersAiConfigured),
      deepgramConfigured: Boolean(payload?.deepgramConfigured),
      model: String(payload?.model || "")
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeWithWorkersAi({ tokenEndpoint, roughNotes, category, subcategory, signal }) {
  const endpoint = workersAiEndpoint(tokenEndpoint);
  if (!endpoint) throw new Error("Cloudflare Worker endpoint is not configured");
  if (!String(roughNotes || "").trim()) throw new Error("Add rough notes before generating the ticket");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "omit",
    cache: "no-store",
    signal,
    body: JSON.stringify({
      rough_notes: String(roughNotes).trim(),
      category: String(category || ""),
      subcategory: String(subcategory || "")
    })
  });

  let payload = {};
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok) throw new Error(payload?.error || `Workers AI analysis failed (${response.status})`);
  if (!payload?.analysis || typeof payload.analysis !== "object") throw new Error("Workers AI returned no ticket analysis");
  return { analysis: payload.analysis, model: payload.model || "Workers AI" };
}

export function normalizeAiAnalysis(analysis, fallback) {
  const steps = Array.isArray(analysis?.troubleshooting_steps)
    ? analysis.troubleshooting_steps.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const conditionalNextSteps = Array.isArray(analysis?.conditional_next_steps)
    ? analysis.conditional_next_steps.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const issueSummary = String(analysis?.issue_summary || fallback?.issueSummary || "").trim();
  const resolution = String(analysis?.resolution || fallback?.resolution || "").trim();
  const accountNumber = String(analysis?.account_number || "").replace(/\D/g, "");

  return {
    source: "ai",
    issueSummary,
    accountNumber: /^\d{4,}$/.test(accountNumber) ? accountNumber : "",
    troubleshootingSteps: steps.length ? steps : (fallback?.troubleshootingSteps || []),
    conditionalNextSteps,
    resolution,
    resolved: Boolean(analysis?.resolved || resolution),
    cleanedNotes: fallback?.cleanedNotes || ""
  };
}
