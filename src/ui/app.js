import {
  TICKET_ROUTES,
  categoryLabel,
  defaultCategoryId,
  getCategory,
  resolveCategoryId,
  resolveSubcategoryId,
  subcategoryLabel
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
import { RESET_TEMPLATE, renderDetailedDescription } from "../ticket/templates.js";
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
    const categoryId = resolveCategoryId(preferred) || defaultCategoryId();
    select.innerHTML = TICKET_ROUTES.map((route) => `<option value="${route.id}">${escapeHtml(route.label)}</option>`).join("");
    select.value = categoryId;
    this.populateSubcategories(this.settings.subcategoryId);
  }

  populateSubcategories(preferred = "") {
    const categoryId = $("newCategory").value;
    const route = getCategory(categoryId);
    const select = $("newSubcategory");
    select.innerHTML = `<option value="">-- None --</option>${(route?.subcategories || []).map((sub) => `<option value="${sub.id}">${escapeHtml(sub.label)}</option>`).join("")}`;
    const subcategoryId = resolveSubcategoryId(categoryId, preferred);
    if (subcategoryId) select.value = subcategoryId;
  }

  loadSettingsIntoUi() {
    $("profileName").value = this.settings.name || "";
    $("deepgramTokenEndpoint").value = this.settings.deepgramTokenEndpoint || "";
    const categoryId = resolveCategoryId(this.settings.categoryId) || defaultCategoryId();
    $("newCategory").value = categoryId;
    this.populateSubcategories(this.settings.subcategoryId);
    this.voice.setTokenEndpoint(this.settings.deepgramTokenEndpoint || "");
    this.syncSettingsStatus();
  }

  applyInitialTemplates() {
    $("detailedDescription").value = this.recommendedTemplate();
    $("workNotes").value = WORK_NOTES_TEMPLATE;
    this.syncGeneratedOutput();
    this.renderDetectedSummary();
  }

  recommendedTemplate(fields = this.readFields()) {
    return renderDetailedDescription({
      categoryId: $("newCategory").value,
      subcategoryId: $("newSubcategory").value,
      fields
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

  renderDetectedSummary() {
    const fields = this.readFields();
    const found = DETAIL_FIELDS.map(([id, label]) => ({ label, value: fields[id] })).filter((item) => item.value);
    const box = $("detectedSummary");
    if (!found.length) {
      box.innerHTML = `<span>No details extracted yet.</span>`;
      box.classList.remove("has-values");
      return;
    }
    box.classList.add("has-values");
    box.innerHTML = found.map((item) => `<span class="detected-chip"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</span>`).join("");
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
    const active = state === "listening" || state === "reconnecting";
    start.disabled = active;
    pause.disabled = !active;
    stop.disabled = state === "stopped";
    dot.classList.toggle("listening", active);
    dot.classList.toggle("ready", state !== "error");
  }

  syncVoiceProvider() {
    const configured = this.voice.isDeepgramConfigured();
    $("voiceProviderBadge").textContent = configured ? "Deepgram Nova-3" : "Browser fallback";
    $("deepgramRecorderHint").textContent = configured
      ? "Deepgram captures the call. Generate sends the completed Rough Notes to your Cloudflare Worker for structured ticket analysis."
      : "Configure the secure Cloudflare /token endpoint in Settings. Until then, supported browsers use their built-in speech recognizer.";
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
    $("detailedDescription").value = RESET_TEMPLATE;
    this.dirty.detail = true;
    $("templateNotice").hidden = true;
    this.syncGeneratedOutput();
    this.showToast("Original standard template restored.");
  }

  resetWorkNotes() {
    $("workNotes").value = WORK_NOTES_TEMPLATE;
    this.dirty.work = true;
    this.syncGeneratedOutput();
    this.showToast("Work Notes template restored.");
  }

  async generateTicket() {
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
    const categoryId = resolveCategoryId(data.categoryId || data.category) || defaultCategoryId();
    $("newCategory").value = categoryId;
    this.populateSubcategories(data.subcategoryId || data.subcategory);
    $("newRawNotes").value = data.roughNotes || data.newRawNotes || "";
    this.writeFields(data.fields || data);
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
    this.applyInitialTemplates();
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
