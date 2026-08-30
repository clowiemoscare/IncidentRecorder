import {
  TICKET_ROUTES,
  categoryLabel,
  defaultCategoryId,
  getCategory,
  resolveCategoryId,
  resolveSubcategoryId,
  subcategoryLabel,
  verifyFieldIdsFor
} from "../config/ticket-routing.js";
import {
  clearStoredData,
  exportAllData,
  loadDrafts,
  loadHistory,
  loadSettings,
  migrateLegacyStorage,
  saveDrafts,
  saveHistory,
  saveSettings
} from "../state/storage.js";
import { VoiceController } from "../recorder/voice.js";
import { analyzeWithWorkersAi, workersAiEndpoint } from "../ticket/ai-client.js";
import { DETAIL_FIELDS, emptyFields, extractFields } from "../ticket/extractor.js";
import { generateTicketModel, renderTicketText } from "../ticket/generator.js";
import { analyzeLocally } from "../ticket/local-analyzer.js";
import { GEN2_RESET_TEMPLATE, STANDARD_RESET_TEMPLATE, renderDetailedDescription } from "../ticket/templates.js";
import { cleanNotes, sentence } from "../ticket/text.js";
import { $, $$, copyText, downloadText, escapeHtml } from "./dom.js";

const WORK_NOTES_TEMPLATE = `Issue:\n\nTroubleshooting Steps:\n\nResolution:\n\nReason for Escalation:\n`;
const DETAIL_FIELD_IDS = DETAIL_FIELDS.map(([id]) => id);

export class IncidentRecorderApp {
  constructor() {
    migrateLegacyStorage();
    this.settings = loadSettings();
    this.drafts = loadDrafts();
    this.history = loadHistory();
    this.dirty = { short: false, detail: false, work: false };
    this.generatedOnce = false;
    this.lastAnalysis = null;
    this.toastTimer = null;
    this.voice = new VoiceController({
      onFinal: (text) => this.appendRoughNote(text),
      onInterim: (text) => this.updateInterim(text),
      onStatus: (text) => this.setVoiceStatus(text),
      onState: (state) => this.setVoiceState(state),
      onError: (error) => console.warn("Voice transcription error", error)
    });
  }

  init() {
    this.populateCategories();
    this.loadSettingsIntoUi();
    this.applyInitialTemplates();
    this.updateVerifyFieldVisibility();
    this.renderDrafts();
    this.renderHistory();
    this.wireEvents();
    this.syncVoiceProvider();
    this.showPage("recorder");
  }

  showToast(message, tone = "normal") {
    const toast = $("toast");
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  showPage(page) {
    $$("[data-page]").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
    $$("[data-nav]").forEach((el) => el.classList.toggle("active", el.dataset.nav === page));
    document.title = `${page === "recorder" ? "IncidentRecorder" : page[0].toUpperCase() + page.slice(1)} | IncidentRecorder`;
  }

  populateCategories(preferred = this.settings.categoryId) {
    const select = $("newCategory");
    const categoryId = resolveCategoryId(preferred) || "";
    select.innerHTML = `<option value="">-- Select Category --</option>${TICKET_ROUTES.map((route) => `<option value="${route.id}">${escapeHtml(route.label)}</option>`).join("")}`;
    select.value = categoryId;
    this.populateSubcategories(this.settings.subcategoryId);
  }

  populateSubcategories(preferred = "") {
    const categoryId = $("newCategory").value;
    const route = getCategory(categoryId);
    const select = $("newSubcategory");
    select.innerHTML = `<option value="">-- Select Subcategory --</option>${(route?.subcategories || []).map((sub) => `<option value="${sub.id}">${escapeHtml(sub.label)}</option>`).join("")}`;
    const subcategoryId = resolveSubcategoryId(categoryId, preferred);
    select.value = subcategoryId || "";
  }

  loadSettingsIntoUi() {
    $("profileName").value = this.settings.name || "";
    $("deepgramTokenEndpoint").value = this.settings.deepgramTokenEndpoint || "";
    const categoryId = resolveCategoryId(this.settings.categoryId) || "";
    $("newCategory").value = categoryId;
    this.populateSubcategories(this.settings.subcategoryId);
    this.voice.setTokenEndpoint(this.settings.deepgramTokenEndpoint || "");
    this.voice.setProviderPreference(this.settings.voiceProvider || "auto");
    $("voiceProviderSelect").value = this.voice.getProviderPreference();
    this.syncSettingsStatus();
  }

  applyInitialTemplates() {
    $("detailedDescription").value = this.recommendedTemplate();
    $("workNotes").value = WORK_NOTES_TEMPLATE;
    this.syncGeneratedOutput();
    this.renderDetectedSummary();
  }

  recommendedTemplate(fields = this.readFields(), analysis = this.lastAnalysis || {}) {
    const categoryId = $("newCategory").value;
    if (!categoryId) return "";
    return renderDetailedDescription({
      categoryId,
      subcategoryId: $("newSubcategory").value,
      fields,
      analysis
    });
  }

  readFields() {
    const fields = emptyFields();
    for (const id of DETAIL_FIELD_IDS) fields[id] = String($(id)?.value || "").trim();
    return fields;
  }

  writeFields(fields, { onlyBlank = false } = {}) {
    for (const id of DETAIL_FIELD_IDS) {
      const el = $(id);
      if (!el) continue;
      if (onlyBlank && String(el.value || "").trim()) continue;
      if (fields?.[id] !== undefined) el.value = fields[id] || "";
    }
    this.renderDetectedSummary();
  }

  updateVerifyFieldVisibility() {
    const categoryId = $("newCategory").value;
    const visibleIds = new Set(verifyFieldIdsFor(categoryId));
    $$('[data-detail-field]').forEach((label) => {
      label.hidden = !visibleIds.has(label.dataset.detailField);
    });
    this.renderDetectedSummary();
  }

  renderDetectedSummary() {
    const categoryId = $("newCategory").value;
    const box = $("detectedSummary");
    if (!categoryId) {
      box.innerHTML = `<span>Select a Category to show its ticket fields.</span>`;
      box.classList.remove("has-values");
      return;
    }
    const visibleIds = new Set(verifyFieldIdsFor(categoryId));
    const fields = this.readFields();
    const found = DETAIL_FIELDS
      .filter(([id]) => visibleIds.has(id))
      .map(([id, label]) => ({ label, value: fields[id] }))
      .filter((item) => item.value);
    if (!found.length) {
      box.innerHTML = `<span>No details extracted yet for this Category.</span>`;
      box.classList.remove("has-values");
      return;
    }
    box.classList.add("has-values");
    box.innerHTML = found.map((item) => `<span class="detected-chip"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</span>`).join("");
  }

  ensureRoutingSelected() {
    if (!$("newCategory").value) {
      this.showToast("Select a Category first.", "error");
      $("newCategory").focus();
      return false;
    }
    if (!$("newSubcategory").value) {
      this.showToast("Select a Subcategory first.", "error");
      $("newSubcategory").focus();
      return false;
    }
    return true;
  }

  extractDetails({ notify = true } = {}) {
    const extracted = extractFields($("newRawNotes").value, this.readFields());
    this.writeFields(extracted);
    if (!this.dirty.detail) $("detailedDescription").value = this.recommendedTemplate(extracted);
    if (notify) this.showToast("Details extracted. Review the detected values before generating.");
    this.setSaveStatus("Unsaved changes");
    return extracted;
  }

  appendRoughNote(text) {
    const line = String(text || "").trim();
    if (!line) return;
    const area = $("newRawNotes");
    area.value = area.value ? `${area.value}\n${line}` : line;
    this.setSaveStatus("Unsaved changes");
  }

  updateInterim(text) {
    $("interimTranscript").textContent = text || "Listening for the next part of the call…";
  }

  setVoiceStatus(text) { $("voiceStatus").textContent = text; }

  setVoiceState(state) {
    const start = $("startVoiceBtn");
    const pause = $("pauseVoiceBtn");
    const stop = $("stopVoiceBtn");
    const dot = $("voiceDot");
    const providerSelect = $("voiceProviderSelect");
    const active = state === "listening" || state === "reconnecting";
    start.disabled = active;
    pause.disabled = !active;
    stop.disabled = state === "stopped";
    if (providerSelect) providerSelect.disabled = active;
    dot.classList.toggle("listening", active);
    dot.classList.toggle("ready", state !== "error");
  }

  syncVoiceProvider() {
    const configured = this.voice.isDeepgramConfigured();
    const preference = this.voice.setProviderPreference(this.settings.voiceProvider || "auto");
    const select = $("voiceProviderSelect");
    if (select && document.activeElement !== select) select.value = preference;

    if (preference === "browser") {
      $("voiceProviderBadge").textContent = "Browser speech";
      $("deepgramRecorderHint").textContent = "Browser speech mode is enabled. Starting voice notes will not request a Deepgram token or open a Deepgram transcription connection.";
      return;
    }
    if (preference === "deepgram") {
      $("voiceProviderBadge").textContent = configured ? "Deepgram Nova-3" : "Deepgram not configured";
      $("deepgramRecorderHint").textContent = configured
        ? "Deepgram Nova-3 is selected for transcription. Generate sends the completed Rough Notes to the same Worker for ticket analysis."
        : "Deepgram is selected but not configured. Voice notes will fall back to browser speech recognition when available.";
      return;
    }
    $("voiceProviderBadge").textContent = configured ? "Auto · Deepgram" : "Auto · Browser speech";
    $("deepgramRecorderHint").textContent = configured
      ? "Auto mode uses Deepgram when available and browser speech if Deepgram cannot start."
      : "Auto mode uses browser speech recognition because Deepgram is not configured.";
  }

  saveVoiceProviderPreference() {
    this.settings.voiceProvider = this.voice.setProviderPreference($("voiceProviderSelect").value);
    saveSettings(this.settings);
    this.syncVoiceProvider();
    this.showToast(this.settings.voiceProvider === "browser" ? "Browser speech selected. Deepgram will not be used for recording." : "Transcription preference saved.");
  }

  async startVoice() {
    try {
      await this.voice.start();
    } catch (error) {
      this.showToast(error.message || "Voice notes could not start.", "error");
      this.setVoiceStatus(error.message || "Voice notes could not start.");
    }
  }

  async pauseVoice() { await this.voice.pause(); }
  async stopVoice() { await this.voice.stop(); }

  routeChanged({ categoryChanged = false } = {}) {
    if (categoryChanged) this.populateSubcategories();
    this.settings.categoryId = $("newCategory").value;
    this.settings.subcategoryId = $("newSubcategory").value;
    saveSettings(this.settings);
    this.updateVerifyFieldVisibility();
    if (!this.dirty.detail) {
      $("detailedDescription").value = this.recommendedTemplate();
      $("templateNotice").hidden = true;
    } else {
      $("templateNotice").hidden = false;
      this.showToast("Routing changed. Your edited Detailed Description was preserved. Use Apply routing template if you want the new template.");
    }
    this.syncGeneratedOutput();
    this.setSaveStatus("Unsaved changes");
  }

  applyRoutingTemplate() {
    $("detailedDescription").value = this.recommendedTemplate();
    this.dirty.detail = false;
    $("templateNotice").hidden = true;
    this.syncGeneratedOutput();
    this.showToast("Recommended routing template applied.");
  }

  resetDetailedTemplate() {
    if (!this.ensureRoutingSelected()) return;
    $("templateChoiceDialog").showModal();
  }

  applyResetTemplate(family) {
    $("detailedDescription").value = family === "gen2" ? GEN2_RESET_TEMPLATE : STANDARD_RESET_TEMPLATE;
    this.dirty.detail = true;
    $("templateNotice").hidden = true;
    $("templateChoiceDialog").close();
    this.syncGeneratedOutput();
    this.showToast(family === "gen2" ? "KeepStock Gen2 template restored." : "Standard template restored.");
  }

  resetWorkNotes() {
    $("workNotes").value = WORK_NOTES_TEMPLATE;
    this.dirty.work = true;
    this.syncGeneratedOutput();
    this.showToast("Work Notes template restored.");
  }

  async generateTicket() {
    if (!this.ensureRoutingSelected()) return null;
    const rawNotes = $("newRawNotes").value.trim();
    if (!rawNotes) {
      this.showToast("Add Rough Notes before generating the ticket.", "error");
      $("newRawNotes").focus();
      return null;
    }
    const button = $("generateTicketBtn");
    button.disabled = true;
    button.textContent = "Analyzing call…";
    this.setGenerationStatus("Analyzing the full transcript…");

    const fields = this.extractDetails({ notify: false });
    const fallback = analyzeLocally(rawNotes);
    let analysis = fallback;
    let source = "Local fallback";

    try {
      const result = await analyzeWithWorkersAi({
        tokenEndpoint: this.settings.deepgramTokenEndpoint,
        roughNotes: rawNotes,
        category: categoryLabel($("newCategory").value),
        subcategory: subcategoryLabel($("newCategory").value, $("newSubcategory").value)
      });
      const ai = result.analysis;
      analysis = {
        source: "ai",
        issueSummary: String(ai.issue_summary || fallback.issueSummary || "").trim(),
        accountNumber: /^\d{4,}$/.test(String(ai.account_number || "").replace(/\D/g, "")) ? String(ai.account_number).replace(/\D/g, "") : "",
        troubleshootingSteps: Array.isArray(ai.troubleshooting_steps) && ai.troubleshooting_steps.length ? ai.troubleshooting_steps : fallback.troubleshootingSteps,
        conditionalNextSteps: Array.isArray(ai.conditional_next_steps) ? ai.conditional_next_steps : [],
        resolution: String(ai.resolution || fallback.resolution || "").trim(),
        resolved: Boolean(ai.resolved || ai.resolution || fallback.resolved),
        cleanedNotes: fallback.cleanedNotes
      };
      source = result.model || "Cloudflare Workers AI";
    } catch (error) {
      console.warn("Workers AI unavailable; local analyzer used", error);
      this.showToast(`Cloudflare AI unavailable; local fallback used. ${error.message || ""}`.trim(), "warning");
    }

    this.lastAnalysis = analysis;

    if (!fields.accountNumber && analysis.accountNumber) {
      fields.accountNumber = analysis.accountNumber;
      $("accountNumber").value = analysis.accountNumber;
      this.renderDetectedSummary();
    }

    const ticket = generateTicketModel({
      categoryId: $("newCategory").value,
      subcategoryId: $("newSubcategory").value,
      subcategoryLabel: subcategoryLabel($("newCategory").value, $("newSubcategory").value),
      fields,
      analysis,
      overrides: {
        ...(this.dirty.short ? { shortDescription: $("newTitle").value } : {}),
        ...(this.dirty.detail ? { detailedDescription: $("detailedDescription").value } : {}),
        ...(this.dirty.work ? { workNotes: $("workNotes").value } : {})
      }
    });

    if (!this.dirty.short) $("newTitle").value = ticket.shortDescription;
    if (!this.dirty.detail) $("detailedDescription").value = ticket.detailedDescription;
    if (!this.dirty.work) $("workNotes").value = ticket.workNotes;
    $("generatedTicket").value = renderTicketText({
      shortDescription: $("newTitle").value,
      detailedDescription: $("detailedDescription").value,
      workNotes: $("workNotes").value
    });
    this.generatedOnce = true;
    this.setGenerationStatus(`Generated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${source}`);
    this.setSaveStatus("Generated");
    button.disabled = false;
    button.innerHTML = `<span aria-hidden="true">✦</span> Generate clean ticket`;
    this.showToast(source === "Local fallback" ? "Ticket generated with the local fallback." : "Ticket generated with Cloudflare Workers AI.");
    return ticket;
  }

  syncGeneratedOutput() {
    $("generatedTicket").value = renderTicketText({
      shortDescription: $("newTitle")?.value || "",
      detailedDescription: $("detailedDescription")?.value || "",
      workNotes: $("workNotes")?.value || ""
    });
  }

  setGenerationStatus(text) { $("generationStatus").textContent = text || ""; }
  setSaveStatus(text) { $("saveStatus").textContent = text; }

  currentFormData() {
    return {
      categoryId: $("newCategory").value,
      subcategoryId: $("newSubcategory").value,
      roughNotes: $("newRawNotes").value,
      fields: this.readFields(),
      shortDescription: $("newTitle").value,
      detailedDescription: $("detailedDescription").value,
      workNotes: $("workNotes").value,
      generatedTicket: $("generatedTicket").value,
      dirty: { ...this.dirty }
    };
  }

  restoreFormData(data = {}) {
    this.lastAnalysis = null;
    const categoryId = resolveCategoryId(data.categoryId || data.category) || defaultCategoryId();
    $("newCategory").value = categoryId;
    this.populateSubcategories(data.subcategoryId || data.subcategory);
    $("newRawNotes").value = data.roughNotes || data.newRawNotes || "";
    this.writeFields(data.fields || data);
    this.updateVerifyFieldVisibility();
    $("newTitle").value = data.shortDescription || data.newTitle || "";
    $("detailedDescription").value = data.detailedDescription || this.recommendedTemplate();
    $("workNotes").value = data.workNotes || WORK_NOTES_TEMPLATE;
    this.dirty = { short: Boolean(data.dirty?.short), detail: Boolean(data.dirty?.detail), work: Boolean(data.dirty?.work) };
    this.syncGeneratedOutput();
    this.setSaveStatus("Loaded");
    this.showPage("recorder");
  }

  saveDraft() {
    const draft = {
      id: crypto.randomUUID?.() || String(Date.now()),
      createdAt: new Date().toISOString(),
      data: this.currentFormData()
    };
    this.drafts = [draft, ...this.drafts].slice(0, 12);
    const result = saveDrafts(this.drafts);
    if (!result.ok) return this.showToast(result.message, "error");
    this.renderDrafts();
    this.setSaveStatus("Draft saved");
    this.showToast("Draft saved in this browser.");
  }

  renderDrafts() {
    const root = $("draftList");
    if (!this.drafts.length) {
      root.innerHTML = `<div class="empty-card">No saved drafts yet.</div>`;
      return;
    }
    root.innerHTML = this.drafts.map((draft) => {
      const data = draft.data || {};
      const title = data.shortDescription || subcategoryLabel(data.categoryId, data.subcategoryId) || "Untitled incident";
      const preview = String(data.roughNotes || "No rough notes saved.").slice(0, 150);
      return `<article class="saved-card">
        <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(new Date(draft.createdAt).toLocaleString())}</small><p>${escapeHtml(preview)}${preview.length >= 150 ? "…" : ""}</p></div>
        <div class="saved-actions"><button type="button" data-draft-load="${escapeHtml(draft.id)}">Load</button><button class="danger-link" type="button" data-draft-delete="${escapeHtml(draft.id)}">Delete</button></div>
      </article>`;
    }).join("");
  }

  deleteDraft(id) {
    this.drafts = this.drafts.filter((draft) => draft.id !== id);
    saveDrafts(this.drafts);
    this.renderDrafts();
  }

  async saveToHistory() {
    if (!this.ensureRoutingSelected()) return;
    if (!this.generatedOnce && !$("newTitle").value.trim()) await this.generateTicket();
    if (!$("newTitle").value.trim()) return;
    this.syncGeneratedOutput();
    const item = {
      id: `IR-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`,
      createdAt: new Date().toISOString(),
      shortDescription: $("newTitle").value.trim(),
      category: categoryLabel($("newCategory").value),
      subcategory: subcategoryLabel($("newCategory").value, $("newSubcategory").value),
      accountNumber: $("accountNumber").value.trim(),
      rawNotes: $("newRawNotes").value,
      detailedDescription: $("detailedDescription").value,
      workNotes: $("workNotes").value,
      fullText: $("generatedTicket").value
    };
    this.history = [item, ...this.history].slice(0, 50);
    const result = saveHistory(this.history);
    if (!result.ok) return this.showToast(result.message, "error");
    this.renderHistory();
    this.setSaveStatus("Saved to history");
    this.showToast("Incident saved to local history.");
  }

  renderHistory() {
    const root = $("historyList");
    if (!this.history.length) {
      root.innerHTML = `<div class="empty-card">No saved incidents yet.</div>`;
      return;
    }
    root.innerHTML = this.history.map((item) => `<article class="history-card">
      <div class="history-meta"><strong>${escapeHtml(item.shortDescription || "Untitled incident")}</strong><small>${escapeHtml(new Date(item.createdAt).toLocaleString())}</small><span>${escapeHtml(item.category || "")}${item.subcategory ? ` · ${escapeHtml(item.subcategory)}` : ""}</span></div>
      <div class="history-actions"><button type="button" data-history-copy="${escapeHtml(item.id)}">Copy ticket</button><button type="button" data-history-rough="${escapeHtml(item.id)}">Copy rough notes</button><button class="danger-link" type="button" data-history-delete="${escapeHtml(item.id)}">Delete</button></div>
      <pre>${escapeHtml(item.workNotes || item.fullText || "")}</pre>
    </article>`).join("");
  }

  resetWorkspace() {
    if (!confirm("Reset the current Rough Notes, fields, and generated ticket?")) return;
    this.stopVoice();
    $("newIncidentForm").reset();
    this.settings = loadSettings();
    this.populateCategories(this.settings.categoryId);
    this.dirty = { short: false, detail: false, work: false };
    this.generatedOnce = false;
    this.lastAnalysis = null;
    this.voice.setProviderPreference(this.settings.voiceProvider || "auto");
    $("voiceProviderSelect").value = this.voice.getProviderPreference();
    this.applyInitialTemplates();
    this.updateVerifyFieldVisibility();
    this.syncVoiceProvider();
    this.setGenerationStatus("");
    this.setSaveStatus("Not saved");
    this.showToast("Workspace reset.");
  }

  saveEndpoint() {
    const raw = $("deepgramTokenEndpoint").value.trim();
    const normalized = raw ? this.voice.setTokenEndpoint(raw) : "";
    if (raw && !normalized) return this.showToast("Enter a valid HTTPS Worker /token endpoint.", "error");
    this.settings.deepgramTokenEndpoint = normalized;
    const result = saveSettings(this.settings);
    if (!result.ok) return this.showToast(result.message, "error");
    this.syncSettingsStatus();
    this.syncVoiceProvider();
    this.showToast(normalized ? "Cloudflare Worker endpoint saved." : "Worker endpoint cleared.");
  }

  saveProfile() {
    this.settings.name = $("profileName").value.trim();
    const result = saveSettings(this.settings);
    if (!result.ok) return this.showToast(result.message, "error");
    this.showToast("Profile saved locally.");
  }

  syncSettingsStatus() {
    const endpoint = this.settings.deepgramTokenEndpoint || "";
    $("deepgramSettingsStatus").textContent = endpoint ? "Endpoint saved · ready to test" : "Not configured";
    $("workersAiSettingsStatus").textContent = workersAiEndpoint(endpoint) ? "Uses the same Worker · ready to test" : "Save the Worker /token endpoint first";
  }

  async testDeepgram() {
    const status = $("deepgramSettingsStatus");
    status.textContent = "Testing secure token endpoint…";
    try {
      const raw = $("deepgramTokenEndpoint").value.trim() || this.settings.deepgramTokenEndpoint;
      await this.voice.testDeepgram(raw);
      this.settings.deepgramTokenEndpoint = this.voice.setTokenEndpoint(raw);
      saveSettings(this.settings);
      status.textContent = "Connected · temporary token received";
      this.syncVoiceProvider();
      this.showToast("Deepgram token endpoint is working.");
    } catch (error) {
      status.textContent = `Connection failed: ${error.message || "unknown error"}`;
      this.showToast("Deepgram connection test failed.", "error");
    }
  }

  async testWorkersAi() {
    const status = $("workersAiSettingsStatus");
    status.textContent = "Testing Cloudflare Workers AI…";
    try {
      const result = await analyzeWithWorkersAi({
        tokenEndpoint: this.settings.deepgramTokenEndpoint,
        roughNotes: "Checked machine power. Reseated the cable. Power cycled the PC. Logged back in and confirmed communication was restored.",
        category: "Keepstock - Seaga / CM",
        subcategory: "Hardware issue: - Main harness"
      });
      status.textContent = `Connected · ${result.model} ready`;
      this.showToast("Cloudflare Workers AI ticket analysis is working.");
    } catch (error) {
      status.textContent = `Connection failed: ${error.message || "unknown error"}`;
      this.showToast("Workers AI test failed.", "error");
    }
  }

  exportData() {
    downloadText(JSON.stringify(exportAllData(), null, 2), "incident-recorder-export.json", "application/json");
  }

  clearData() {
    if (!confirm("Delete IncidentRecorder settings, drafts, and history stored in this browser?")) return;
    clearStoredData();
    location.reload();
  }

  async handleCopy(button) {
    const target = button.dataset.copyTarget;
    const map = {
      short: [$("newTitle").value, "Short description copied."],
      detailed: [$("detailedDescription").value, "Detailed description copied."],
      work: [$("workNotes").value, "Work Notes copied."],
      ticket: [$("generatedTicket").value, "Generated ticket copied."],
      rough: [$("newRawNotes").value, "Rough Notes copied."]
    };
    const [text, message] = map[target] || ["", "Copied."];
    try { await copyText(text); this.showToast(message); }
    catch (error) { this.showToast(error.message, "error"); }
  }

  wireEvents() {
    document.addEventListener("click", async (event) => {
      const nav = event.target.closest("[data-nav]");
      if (nav) this.showPage(nav.dataset.nav);
      const copy = event.target.closest("[data-copy-target]");
      if (copy) await this.handleCopy(copy);
      const draftLoad = event.target.closest("[data-draft-load]");
      if (draftLoad) {
        const draft = this.drafts.find((item) => item.id === draftLoad.dataset.draftLoad);
        if (draft) this.restoreFormData(draft.data);
      }
      const draftDelete = event.target.closest("[data-draft-delete]");
      if (draftDelete) this.deleteDraft(draftDelete.dataset.draftDelete);
      const historyCopy = event.target.closest("[data-history-copy]");
      if (historyCopy) {
        const item = this.history.find((entry) => entry.id === historyCopy.dataset.historyCopy);
        if (item) { await copyText(item.fullText); this.showToast("Saved ticket copied."); }
      }
      const historyRough = event.target.closest("[data-history-rough]");
      if (historyRough) {
        const item = this.history.find((entry) => entry.id === historyRough.dataset.historyRough);
        if (item) { await copyText(item.rawNotes); this.showToast("Saved Rough Notes copied."); }
      }
      const historyDelete = event.target.closest("[data-history-delete]");
      if (historyDelete) {
        this.history = this.history.filter((item) => item.id !== historyDelete.dataset.historyDelete);
        saveHistory(this.history);
        this.renderHistory();
      }
    });

    $("newCategory").addEventListener("change", () => this.routeChanged({ categoryChanged: true }));
    $("newSubcategory").addEventListener("change", () => this.routeChanged());

    for (const id of DETAIL_FIELD_IDS) {
      $(id).addEventListener("input", () => {
        this.renderDetectedSummary();
        if (!this.dirty.detail) $("detailedDescription").value = this.recommendedTemplate();
        this.syncGeneratedOutput();
        this.setSaveStatus("Unsaved changes");
      });
    }

    $("newRawNotes").addEventListener("input", () => this.setSaveStatus("Unsaved changes"));
    $("newTitle").addEventListener("input", () => { this.dirty.short = true; this.syncGeneratedOutput(); });
    $("detailedDescription").addEventListener("input", () => { this.dirty.detail = true; this.syncGeneratedOutput(); });
    $("workNotes").addEventListener("input", () => { this.dirty.work = true; this.syncGeneratedOutput(); });

    $("cleanNotesBtn").addEventListener("click", () => {
      $("newRawNotes").value = cleanNotes($("newRawNotes").value);
      this.showToast("Rough Notes cleaned without changing ticket fields.");
    });
    $("extractDetailsBtn").addEventListener("click", () => this.extractDetails());
    $("generateTicketBtn").addEventListener("click", () => this.generateTicket());
    $("saveDraftBtn").addEventListener("click", () => this.saveDraft());
    $("saveHistoryBtn").addEventListener("click", () => this.saveToHistory());
    $("resetWorkspaceBtn").addEventListener("click", () => this.resetWorkspace());
    $("applyRoutingTemplateBtn").addEventListener("click", () => this.applyRoutingTemplate());
    $("resetDetailedBtn").addEventListener("click", () => this.resetDetailedTemplate());
    $("resetWorkBtn").addEventListener("click", () => this.resetWorkNotes());
    $("downloadTicketBtn").addEventListener("click", () => {
      const name = ($("newTitle").value || "incident").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
      downloadText($("generatedTicket").value, `${name || "incident"}-ticket.txt`);
    });

    $("startVoiceBtn").addEventListener("click", () => this.startVoice());
    $("pauseVoiceBtn").addEventListener("click", () => this.pauseVoice());
    $("stopVoiceBtn").addEventListener("click", () => this.stopVoice());
    $("voiceProviderSelect").addEventListener("change", () => this.saveVoiceProviderPreference());

    $("chooseStandardTemplateBtn").addEventListener("click", () => this.applyResetTemplate("standard"));
    $("chooseGen2TemplateBtn").addEventListener("click", () => this.applyResetTemplate("gen2"));

    $("saveProfileBtn").addEventListener("click", () => this.saveProfile());
    $("saveEndpointBtn").addEventListener("click", () => this.saveEndpoint());
    $("testDeepgramBtn").addEventListener("click", () => this.testDeepgram());
    $("testWorkersAiBtn").addEventListener("click", () => this.testWorkersAi());
    $("exportDataBtn").addEventListener("click", () => this.exportData());
    $("clearDataBtn").addEventListener("click", () => this.clearData());

    document.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "Enter") { event.preventDefault(); this.generateTicket(); }
      if (event.key.toLowerCase() === "s") { event.preventDefault(); this.saveDraft(); }
    });
  }
}
