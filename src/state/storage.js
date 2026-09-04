import { defaultCategoryId, resolveCategoryId, resolveSubcategoryId } from "../config/ticket-routing.js";

const PREFIX = "incidentRecorder:v2";
const KEYS = {
  settings: `${PREFIX}:settings`,
  drafts: `${PREFIX}:drafts`,
  history: `${PREFIX}:history`,
  migration: `${PREFIX}:migration-complete`
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`Could not read ${key}`, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    const quota = error?.name === "QuotaExceededError" || error?.code === 22;
    return { ok: false, error, message: quota ? "Browser storage is full. Delete old drafts/history or export them before saving again." : "Could not save browser data." };
  }
}

export function loadSettings() {
  return {
    name: "",
    deepgramTokenEndpoint: "",
    categoryId: defaultCategoryId(),
    subcategoryId: "",
    ...readJSON(KEYS.settings, {})
  };
}

export function saveSettings(settings) {
  return writeJSON(KEYS.settings, settings);
}

export function loadDrafts() {
  const value = readJSON(KEYS.drafts, []);
  return Array.isArray(value) ? value : [];
}

export function saveDrafts(drafts) {
  return writeJSON(KEYS.drafts, drafts.slice(0, 12));
}

export function loadHistory() {
  const value = readJSON(KEYS.history, []);
  return Array.isArray(value) ? value : [];
}

export function saveHistory(history) {
  return writeJSON(KEYS.history, history.slice(0, 50));
}

const LEGACY_KEYS = Object.freeze([
  "incidentRecorderDashboardV1",
  "incidentRecorderSettingsV11",
  "incidentRecorderSettingsV11TemplateRouting",
  "incidentRecorderDraftsV11TemplateRouting",
  "incidentRecorderDraftsV1"
]);

export function clearStoredData() {
  [...Object.values(KEYS), ...LEGACY_KEYS].forEach((key) => localStorage.removeItem(key));
}

function migrateFormData(data, settings) {
  const categoryId = resolveCategoryId(data?.categoryId || data?.newCategory || data?.category || settings.categoryId) || defaultCategoryId();
  const subcategoryId = resolveSubcategoryId(categoryId, data?.subcategoryId || data?.newSubcategory || data?.subcategory || settings.subcategoryId);
  return {
    ...data,
    categoryId,
    subcategoryId,
    roughNotes: data?.roughNotes || data?.newRawNotes || "",
    shortDescription: data?.shortDescription || data?.newTitle || "",
    detailedDescription: data?.detailedDescription || "",
    workNotes: data?.workNotes || "",
    generatedTicket: data?.generatedTicket || data?.ticketOutput || ""
  };
}

export function migrateLegacyStorage() {
  if (localStorage.getItem(KEYS.migration)) return;
  const currentSettings = loadSettings();
  let settings = { ...currentSettings };

  const oldDashboard = readJSON("incidentRecorderDashboardV1", null);
  if (oldDashboard?.settings) {
    settings = {
      ...settings,
      name: settings.name || oldDashboard.settings.name || "",
      deepgramTokenEndpoint: settings.deepgramTokenEndpoint || oldDashboard.settings.deepgramTokenEndpoint || ""
    };
  }

  const oldRecorderSettings = readJSON("incidentRecorderSettingsV11", null) || readJSON("incidentRecorderSettingsV11TemplateRouting", null);
  if (oldRecorderSettings) {
    const categoryId = resolveCategoryId(oldRecorderSettings.category) || settings.categoryId;
    settings.categoryId = categoryId;
    settings.subcategoryId = resolveSubcategoryId(categoryId, oldRecorderSettings.subcategory) || settings.subcategoryId;
  }
  saveSettings(settings);

  if (!loadDrafts().length) {
    const candidates = ["incidentRecorderDraftsV11TemplateRouting", "incidentRecorderDraftsV1"];
    for (const key of candidates) {
      const legacy = readJSON(key, []);
      if (!Array.isArray(legacy) || !legacy.length) continue;
      const migrated = legacy.slice(0, 12).map((draft) => ({
        id: draft?.id || crypto.randomUUID?.() || String(Date.now()),
        createdAt: draft?.createdAt || new Date().toISOString(),
        data: migrateFormData(draft?.data || draft, settings)
      }));
      saveDrafts(migrated);
      break;
    }
  }

  if (!loadHistory().length && Array.isArray(oldDashboard?.incidents)) {
    const realIncidents = oldDashboard.incidents.filter((incident) => incident?.rawNotes || incident?.account || /^Acct #:/i.test(incident?.title || ""));
    if (realIncidents.length) {
      saveHistory(realIncidents.slice(0, 50).map((incident) => ({
        id: incident.id || crypto.randomUUID?.() || String(Date.now()),
        createdAt: incident.date || new Date().toISOString(),
        shortDescription: incident.title || "",
        category: incident.category || "",
        subcategory: incident.subcategory || "",
        accountNumber: incident.account || "",
        rawNotes: incident.rawNotes || "",
        detailedDescription: incident.detailedDescription || "",
        workNotes: incident.workNotes || "",
        fullText: incident.notes || ""
      })));
    }
  }

  localStorage.setItem(KEYS.migration, "1");
}

export function exportAllData() {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    drafts: loadDrafts(),
    history: loadHistory()
  };
}
