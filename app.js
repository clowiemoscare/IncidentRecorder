const APP_STORAGE_KEY = "incidentRecorderDashboardV1";
const LEGACY_DRAFT_KEYS = ["incidentRecorderDraftsV11TemplateRouting", "incidentRecorderDraftsV1"];

const seedIncidents = [
  { id: "INC-001", title: "Unauthorized Access Attempt", severity: "high", date: "2025-10-07", status: "investigating", assignedTo: "John Doe", category: "Suspicious Activity", location: "Main Entrance", notes: "Unauthorized access attempt detected at the main entrance. Security review is in progress." },
  { id: "INC-002", title: "Suspicious Activity in Parking Lot", severity: "medium", date: "2025-10-06", status: "pending", assignedTo: "Jane Smith", category: "Suspicious Activity", location: "Parking Lot A", notes: "Repeated loitering and suspicious vehicle activity observed in Parking Lot A." },
  { id: "INC-003", title: "Alarm Triggered - Building A", severity: "high", date: "2025-10-06", status: "resolved", assignedTo: "Mike Johnson", category: "Technical / Other", location: "Building A", notes: "Door alarm triggered outside the scheduled access window. Area checked and incident resolved." },
  { id: "INC-004", title: "Loitering Near Entrance", severity: "low", date: "2025-10-05", status: "resolved", assignedTo: "Sarah Williams", category: "Trespassing", location: "Main Entrance", notes: "Person remained near the entrance after closing. Security made contact and the subject left." },
  { id: "INC-005", title: "Vandalism on Camera 12", severity: "medium", date: "2025-10-05", status: "investigating", assignedTo: "John Doe", category: "Vandalism", location: "Perimeter", notes: "Camera 12 captured property damage near the perimeter fence. Footage is under review." },
  { id: "INC-006", title: "Package Theft Detected", severity: "high", date: "2025-10-04", status: "pending", assignedTo: "Jane Smith", category: "Theft", location: "Warehouse", notes: "Package removal detected in the delivery staging area. Awaiting supervisor review." }
];

const seedVideos = [
  { id: "VID-001", incidentId: "INC-001", filename: "camera_12_20251007_143022.mp4", uploadDate: "2025-10-07 14:30", size: "124 MB" },
  { id: "VID-002", incidentId: "INC-002", filename: "parking_cam_20251006_092145.mp4", uploadDate: "2025-10-06 09:22", size: "256 MB" },
  { id: "VID-003", incidentId: "INC-003", filename: "entrance_cam_20251006_183045.mp4", uploadDate: "2025-10-06 18:31", size: "189 MB" },
  { id: "VID-004", incidentId: "INC-005", filename: "camera_12_20251005_112233.mp4", uploadDate: "2025-10-05 11:23", size: "98 MB" }
];

const analyticsData = {
  trend: [45, 52, 48, 61, 55, 67],
  trendResolved: [38, 44, 41, 53, 48, 59],
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  categories: [
    { name: "Theft", value: 35, color: "#ef4444" },
    { name: "Vandalism", value: 25, color: "#f59e0b" },
    { name: "Trespassing", value: 20, color: "#3b82f6" },
    { name: "Suspicious Activity", value: 15, color: "#8b5cf6" },
    { name: "Other", value: 5, color: "#64748b" }
  ]
};

let appState = loadAppState();
let currentPage = "dashboard";
let toastTimer;
let uploadTimer;

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function loadAppState() {
  try {
    const stored = JSON.parse(localStorage.getItem(APP_STORAGE_KEY));
    if (stored && Array.isArray(stored.incidents) && Array.isArray(stored.videos)) return stored;
  } catch (error) {
    console.warn("Could not read saved dashboard data", error);
  }

  return {
    incidents: [...seedIncidents, ...migrateLegacyDrafts()],
    videos: [...seedVideos],
    settings: { name: "Clowie Moscare", email: "clowie@securewatch.local" }
  };
}

function migrateLegacyDrafts() {
  const migrated = [];
  LEGACY_DRAFT_KEYS.forEach((key) => {
    try {
      const drafts = JSON.parse(localStorage.getItem(key));
      if (!Array.isArray(drafts)) return;
      drafts.slice(0, 20).forEach((draft, index) => {
        const data = draft?.data || draft || {};
        const title = data.shortDescription || data.title || data.service || firstMeaningfulLine(data.rawNotes) || "Imported IncidentRecorder draft";
        migrated.push({
          id: `IMP-${String(index + 1).padStart(3, "0")}`,
          title: title.slice(0, 90),
          severity: priorityToSeverity(data.priority || data.urgency),
          date: (draft.createdAt || new Date().toISOString()).slice(0, 10),
          status: stateToStatus(data.state || data.status),
          assignedTo: data.assignedTo || "Clowie Moscare",
          category: data.category || "Technical / Other",
          location: data.location || data.department || "Not provided",
          notes: data.ticketOutput || data.detailedDescription || data.rawNotes || "Imported from a previous IncidentRecorder browser draft.",
          imported: true
        });
      });
    } catch (error) {
      // Ignore legacy keys that do not contain valid JSON.
    }
  });
  return migrated;
}

function firstMeaningfulLine(value) {
  return String(value || "").split(/\n+/).map((line) => line.trim()).find(Boolean) || "";
}
function priorityToSeverity(value = "") {
  const v = String(value).toLowerCase();
  if (v.includes("critical") || v.includes("high") || v.includes("1") || v.includes("2")) return "high";
  if (v.includes("low") || v.includes("4") || v.includes("5")) return "low";
  return "medium";
}
function stateToStatus(value = "") {
  const v = String(value).toLowerCase();
  if (v.includes("resolve") || v.includes("closed")) return "resolved";
  if (v.includes("hold") || v.includes("pending")) return "pending";
  return "investigating";
}

function saveAppState() {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(appState));
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function navigate(page) {
  if (!$("page-" + page)) return;
  currentPage = page;
  $$(".page").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
  $$(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.nav === page));
  document.title = `${page[0].toUpperCase() + page.slice(1)} | IncidentRecorder`;
  closeMobileMenu();
  if (page === "dashboard" || page === "analytics") requestAnimationFrame(drawAllCharts);
}

function openMobileMenu() {
  $("sidebar").classList.add("mobile-open");
  $("mobileOverlay").hidden = false;
}
function closeMobileMenu() {
  $("sidebar").classList.remove("mobile-open");
  $("mobileOverlay").hidden = true;
}

function renderIncidents() {
  const severity = $("severityFilter").value;
  const status = $("statusFilter").value;
  const query = $("incidentSearch").value.trim().toLowerCase();
  const rows = appState.incidents.filter((incident) => {
    if (severity !== "all" && incident.severity !== severity) return false;
    if (status !== "all" && incident.status !== status) return false;
    if (query && ![incident.id, incident.title, incident.assignedTo, incident.category, incident.location].join(" ").toLowerCase().includes(query)) return false;
    return true;
  });

  $("incidentTableBody").innerHTML = rows.map((incident) => `
    <tr>
      <td><button class="incident-link" type="button" data-view-incident="${escapeHtml(incident.id)}">${escapeHtml(incident.id)}</button></td>
      <td class="incident-title">${escapeHtml(incident.title)}</td>
      <td><span class="badge badge-${incident.severity}">${incident.severity}</span></td>
      <td>${escapeHtml(incident.date)}</td>
      <td><span class="badge badge-${incident.status}">${incident.status}</span></td>
      <td>${escapeHtml(incident.assignedTo)}</td>
      <td><button class="action-link" type="button" data-view-incident="${escapeHtml(incident.id)}"><i data-lucide="eye"></i> View</button></td>
    </tr>`).join("");
  $("incidentEmpty").hidden = rows.length !== 0;
  refreshIcons();
  updateMetrics();
}

function openIncidentDetails(id) {
  const incident = appState.incidents.find((item) => item.id === id);
  if (!incident) return;
  $("incidentDetailContent").innerHTML = `
    <div class="detail-meta-grid">
      ${detailMeta("Incident ID", incident.id)}
      ${detailMeta("Date", incident.date)}
      ${detailMeta("Status", incident.status)}
      ${detailMeta("Severity", incident.severity)}
      ${detailMeta("Assigned To", incident.assignedTo)}
      ${detailMeta("Location", incident.location || "Not provided")}
      ${detailMeta("Category", incident.category || "Not provided")}
      ${detailMeta("Title", incident.title)}
    </div>
    <div class="detail-description">${escapeHtml(incident.notes || "No additional notes recorded.")}</div>
    <div class="detail-actions">
      <button class="button primary" type="button" data-status-change="resolved" data-id="${escapeHtml(incident.id)}"><i data-lucide="circle-check-big"></i> Mark as Resolved</button>
      <button class="button" type="button" data-status-change="pending" data-id="${escapeHtml(incident.id)}"><i data-lucide="clock-3"></i> Mark as Pending</button>
      <button class="button" type="button" data-copy-incident="${escapeHtml(incident.id)}"><i data-lucide="copy"></i> Copy Notes</button>
    </div>`;
  refreshIcons();
  $("incidentDetailDialog").showModal();
}

function detailMeta(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "Not provided")}</strong></div>`;
}

function changeIncidentStatus(id, status) {
  const incident = appState.incidents.find((item) => item.id === id);
  if (!incident) return;
  incident.status = status;
  saveAppState();
  renderIncidents();
  $("incidentDetailDialog").close();
  showToast(`Incident ${id} marked ${status}.`);
}

function renderVideos() {
  $("videoTableBody").innerHTML = appState.videos.map((video) => `
    <tr>
      <td><span class="incident-link">${escapeHtml(video.id)}</span></td>
      <td>${escapeHtml(video.incidentId)}</td>
      <td class="incident-title">${escapeHtml(video.filename)}</td>
      <td>${escapeHtml(video.uploadDate)}</td>
      <td>${escapeHtml(video.size)}</td>
      <td><button class="action-link" type="button" data-view-video="${escapeHtml(video.id)}"><i data-lucide="play"></i> View</button></td>
    </tr>`).join("");
  $("videoCount").textContent = `${appState.videos.length} file${appState.videos.length === 1 ? "" : "s"}`;
  $("metricUploads").textContent = 338 + appState.videos.length;
  refreshIcons();
}

function openVideo(id) {
  const video = appState.videos.find((item) => item.id === id);
  if (!video) return;
  $("videoDetailMeta").innerHTML = [
    ["Video ID", video.id], ["Incident ID", video.incidentId], ["Filename", video.filename], ["Size", video.size]
  ].map(([label, value]) => detailMeta(label, value)).join("");
  $("videoDialog").showModal();
}

function simulateUpload(files) {
  const list = files && files.length ? Array.from(files) : [{ name: "camera_footage.mp4", size: 124 * 1024 * 1024 }];
  const file = list[0];
  clearInterval(uploadTimer);
  $("uploadProgress").hidden = false;
  $("uploadName").textContent = `Uploading ${file.name}`;
  let progress = 0;
  const update = () => {
    $("uploadPercent").textContent = `${progress}%`;
    $("uploadProgressBar").style.width = `${progress}%`;
  };
  update();
  uploadTimer = setInterval(() => {
    progress += 10;
    update();
    if (progress >= 100) {
      clearInterval(uploadTimer);
      const nextId = `VID-${String(appState.videos.length + 1).padStart(3, "0")}`;
      appState.videos.unshift({
        id: nextId,
        incidentId: appState.incidents[0]?.id || "UNASSIGNED",
        filename: file.name,
        uploadDate: new Date().toLocaleString([], { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", ""),
        size: formatBytes(file.size || 124 * 1024 * 1024)
      });
      saveAppState();
      renderVideos();
      setTimeout(() => { $("uploadProgress").hidden = true; }, 600);
      showToast(`${file.name} added to local video records.`);
    }
  }, 120);
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`;
}

const RECORDER_DRAFT_STORAGE_KEY = "incidentRecorderDraftsV11TemplateRouting";
const RECORDER_SETTINGS_KEY = "incidentRecorderSettingsV11";
const RECORDER_WORK_NOTES_TEMPLATE = `Issue:


Troubleshooting Steps:


Resolution:


Reason for Escalation: [Only if escalated to T2]`;
const RECORDER_TEMPLATE_DIVIDER = "---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------";
// Reset template intentionally matches the user's original spacing and field set.
const RECORDER_RESET_DETAIL_TEMPLATE = `Template Header (DO NOT REMOVE)
**Delete any unused sections below**
${RECORDER_TEMPLATE_DIVIDER}
Slack Thread URL:


Parent/PRB Template: [Update/add to section below with all required data from Parents/PRB's]


Crib/Program id: 
Program name: 
Company name: 
Site ID (If Applicable): 
Acct #:



Software Version:
Device ID (Affected): 
Machine Serial Number(s):



Badge Reader:
Model:

Phone Model:
Phone Software Version:
Application:
Application Version:
Time issue occurred:


Order #:
eConnections Status:
SAP Status/EBU Number:
Does user want order reposted:`;
const RECORDER_CATEGORY_MAP = {
  "Keepstock - MobileCast": ["Access/login", "Routing", "other"],
  "Keepstock - GCOM Mobile App": ["access/login", "Barcode label", "Bluetooth Scanner", "Camera Scanner", "Cart", "Ks Items", "other"],
  "Keepstock Canada - Onsite": ["Access/Login", "CS Software", "Email notification", "Item Data", "Item maintenance", "MRF Issue", "MRF required", "order approval", "program maintenance", "other"],
  "Keepstock - Seaga / CM": ["Hardware issue: - Drop sensor", "Hardware issue: - lightning", "Hardware issue: - transformer", "Hardware issue: - Fuses", "Hardware issue: - Internal Keypad", "Hardware issue: - Main board", "Hardware issue: - Main harness", "Hardware issue: - Motors", "Hardware issue: - Power supply", "Hardware issue: - Tray", "Hardware issue: - Tray harness", "Hardware issue: - Machine Replacement Request", "physical damage", "Product sizing", "other"],
  "Keepstock - CM - PC/Data": ["Data issue ATR setting", "craftcodes/uda", "item data", "data issue-user/login", "hardware issue - ComPorts", "hardware issue - Existing badge reader", "hardware issue - New badge reader", "hardware issue - Touchscreen", "Network issue - Cellular", "Network issue - Customer network", "reporting-PO issue", "Software issue", "other"],
  "Keepstock - Seaga - PC/Data": ["Data issue ATR setting", "craftcodes/uda", "item data", "data issue-user/login", "hardware issue - ComPorts", "hardware issue - Existing badge reader", "hardware issue - New badge reader", "hardware issue - Touchscreen", "Network issue - Cellular", "Network issue - Customer network", "reporting-PO issue", "Software issue", "other"],
  "Keepstock - Onsite": ["Email notification", "Drop call-immediately", "KS console", "KS console - access/login", "KS console - Report manager", "KS Web - User groups/Product groups", "KS Web - Access/login", "KS Web - item management", "KS Web - Labels", "KS Web - Reporting", "KS Web - Order Status Viewer", "KS Web - User management", "consignment issue", "CMI scanner", "MRF Issue", "MRF required", "New customer request", "Approver update", "Order issue - CS", "Order issue - Epro", "Order issue - GCOM", "Parts Assistance", "other"]
};
const RECORDER_DETAIL_FIELDS = [
  ["cribProgramId", "Crib/Program id"], ["programName", "Program name"], ["companyName", "Company name"], ["siteId", "Site ID"],
  ["accountNumber", "Acct #"], ["softwareVersion", "Software Version"], ["deviceId", "Device ID (Affected)"], ["machineSerial", "Machine Serial Number(s)"],
  ["cradlepointSerial", "Cradlepoint Serial Number"], ["imei", "IMEI"], ["carrier", "Carrier"], ["badgeReader", "Badge Reader"],
  ["model", "Model"], ["phoneModel", "Phone Model"], ["phoneSoftwareVersion", "Phone Software Version"], ["application", "Application"],
  ["applicationVersion", "Application Version"], ["timeIssueOccurred", "Time issue occurred"], ["orderNumber", "Order #"],
  ["econnectionsStatus", "eConnections Status"], ["sapStatusEbu", "SAP Status/EBU Number"], ["orderReposted", "Does user want order reposted"]
];
const RECORDER_FORM_IDS = [
  "newRawNotes", "cribProgramId", "programName", "companyName", "siteId", "accountNumber", "softwareVersion", "deviceId", "machineSerial", "cradlepointSerial", "imei", "carrier", "badgeReader", "model", "phoneModel", "phoneSoftwareVersion", "application", "applicationVersion", "timeIssueOccurred", "orderNumber", "econnectionsStatus", "sapStatusEbu", "orderReposted", "newCategory", "newSubcategory", "channel", "newLocation", "partsRequest", "deviceAsset", "applicationService", "relatedSearch", "knowledgeScope", "watchList", "resolutionCode", "closeNotes", "newTitle", "detailedDescription", "workNotes", "generatedTicket"
];

let recorderRecognition = null;
let recorderShouldRestartVoice = false;
let recorderVoiceListening = false;
let recorderVoiceStarting = false;
let recorderVoicePaused = false;
let recorderVoiceFatalError = false;
let recorderVoiceRestartTimer = null;
let recorderVoiceRestartAttempts = 0;
let recorderVoicePendingInterim = "";

function openNewIncident() {
  stopRecorderVoiceNotes();
  $("newIncidentForm").reset();
  $("generatedTicket").value = "";
  applyRecorderDefaults();
  renderRecorderDrafts();
  setupRecorderVoiceNotes();
  setRecorderSaveStatus("Not saved");
  $("newIncidentDialog").showModal();
  refreshIcons();
}

function normalizeRecorderLine(text) {
  return String(text || "").replace(/[\u2022\u00b7]/g, " ").replace(/^[-*]+\s*/, "").replace(/\s+/g, " ").trim();
}

function normalizeRecorderTerms(text) {
  return normalizeRecorderLine(text)
    .replace(/\b(?:keep\s*stock|keeps\s*stock|keep\s*stop|keepstop|keepsake|keep\s*stake|keeps\s*up|keep\s*up)\b/gi, "KeepStock")
    .replace(/\baccess\s+skip\b/gi, "access KeepStock")
    .replace(/\bclear\s*spider\b/gi, "ClearSpider")
    .replace(/\b(?:grainger|granger)\s*\.\s*com\b/gi, "Grainger.com")
    .replace(/\bcurb\s+(?=(?:number|num|#|id)\b)/gi, "crib ");
}
function isRecorderChatter(line) {
  const text = normalizeRecorderTerms(line).toLowerCase();
  if (!text) return true;

  // The recorder normally hears only the support rep. Preserve diagnostic
  // questions, findings, and instructions even when they are conversational.
  if (/password reset|clearspider|reset email|sent.*teams|right account|gen\s*2|transition(?:ed|ing)?|workstation|not assigned.*program|assigned to.*program|grainger\.com|account information|select all|keepstock web|program management|user group|dispens|batter|pack of|conflict|remove.*item|add it back|per week|weekly|crib|program id|pulled up/.test(text)) return false;

  const chatter = [
    /\bhow can i help you\b/,
    /\b(?:first and last name|confirm your .*id|what(?:'s| is) the account number|who was the contact|what email address|what user id do you use)\b/,
    /\b(?:bear with me|just a second|just a moment|let me look (?:you|this) up|let me look this up real quick|you hear me|can you hear me)\b/,
    /\bdo you have any other questions\b/,
    /\bis that what you(?:'re| are) asking\b/,
    /^(?:hi|hello|hey|thanks|thank you|awesome|great|perfect|okay|ok|sure|gotcha|all right|alright|yeah|yep|me|bye|bye-bye)\b[.!]?$/,
    /^(?:thank you|thanks).*(?:day|bye)/,
    /^(?:do you|can you|could you|would you)\b.*\?*$/,
    /\blet me know when (?:you(?:'re| are)|you got|you have)\b/,
    /^(?:and )?whenever you click\b|\bdoes it ask you for\b/,
    /^(?:you got to|you need to|i(?:'m| am) going to need you to) click on that link\b/,
    /\bgo to page number\b|\bpage number (?:three|four|five|\d+)\b/,
    /\bthis is the most important(?: part)?\b/
  ];
  return chatter.some((re) => re.test(text));
}
function cleanNotesText(raw) {
  const filler = /^(hi|hello|hey|thanks|thank you|okay|ok|um|uh|hmm|so|basically|you know|good morning|good afternoon|good evening)\b/i;
  const lines = String(raw || "")
    .replace(/\r/g, "\n")
    .replace(/[\u2022\u00b7]/g, "\n")
    .split(/\n|;|(?<=[.!?])\s+/)
    .map(normalizeRecorderTerms)
    .filter(Boolean)
    .filter((line) => !filler.test(line) || line.split(/\s+/).length > 5);
  return unique(lines).join("\n");
}

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function sentence(text) {
  const clean = normalizeRecorderTerms(text);
  if (!clean) return "";
  const capped = clean[0].toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}
function value(id, fallback = "") { const el=$(id); return el ? el.value.trim() || fallback : fallback; }

function populateRecorderCategories(preferred) {
  const select = $("newCategory");
  const settings = getRecorderSettings();
  const categories = Object.keys(RECORDER_CATEGORY_MAP);
  const legacyMachineCategories = new Set([
    "Keepstock - CM - AMS toolbox", "Keepstock - CM - Locker", "Keepstock - CM - Carousel",
    "Keepstock - Seaga - Coil", "Keepstock - Seaga - Locker"
  ]);
  const migrate = (category) => legacyMachineCategories.has(category) ? "Keepstock - Seaga / CM" : category;
  const requested = migrate(preferred);
  const remembered = migrate(settings.category);
  select.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  select.value = categories.includes(requested) ? requested : categories.includes(remembered) ? remembered : "Keepstock - Seaga - PC/Data";
  populateRecorderSubcategories(settings.subcategory);
}

function populateRecorderSubcategories(preferred) {
  const category = value("newCategory", "Keepstock - Seaga - PC/Data");
  const options = RECORDER_CATEGORY_MAP[category] || ["other"];
  $("newSubcategory").innerHTML = `<option value="">-- None --</option>` + options.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  if (preferred && options.includes(preferred)) $("newSubcategory").value = preferred;
}

function getRecorderSettings() {
  try { return JSON.parse(localStorage.getItem(RECORDER_SETTINGS_KEY)) || {}; } catch (e) { return {}; }
}
function saveRecorderSettings() {
  localStorage.setItem(RECORDER_SETTINGS_KEY, JSON.stringify({ category:value("newCategory"), subcategory:value("newSubcategory") }));
}

function applyRecorderDefaults() {
  const settings = getRecorderSettings();
  populateRecorderCategories(settings.category);
  if ($("channel")) $("channel").value = "Phone";
  if ($("knowledgeScope")) $("knowledgeScope").value = "Knowledge & Catalog (All)";
  $("detailedDescription").value = buildRecorderDetailedDescription();
  $("workNotes").value = RECORDER_WORK_NOTES_TEMPLATE;
  renderRecorderDetectedSummary();
  updateRecorderCounters();
}

function extractRecorderDetails(overwrite = false) {
  const lines = cleanNotesText(value("newRawNotes"))
    .split(/\n+/)
    .map(normalizeRecorderTerms)
    .filter(Boolean);

  const defs = [
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

  defs.forEach(([id, regexes]) => {
    if (!overwrite && value(id)) return;
    for (const line of lines) {
      let found = null;
      for (const regex of regexes) {
        const match = line.match(regex);
        if (match) { found = match[1]; break; }
      }
      if (found) {
        let normalized = normalizeRecorderTerms(found).replace(/\s+(?:and|then)$/i, "");
        if (id === "orderReposted") normalized = /^yes$/i.test(normalized) ? "Yes" : /^no$/i.test(normalized) ? "No" : normalized;
        $(id).value = normalized;
        break;
      }
    }
  });

  // Speech recognition commonly splits "crib 218-126, it is for Joya
  // Corporate HQ" across lines. Capture the program name without overwriting
  // anything the rep entered manually.
  if (overwrite || !value("programName")) {
    for (let i = 0; i < lines.length; i += 1) {
      const sameLine = lines[i].match(/\b(?:crib|program)\b.*?\b(?:it\s+is\s+for|is\s+for)\s+(.+)$/i);
      if (sameLine && sameLine[1].trim()) {
        $("programName").value = sameLine[1].trim();
        break;
      }
      if (/\b(?:crib|program)\b.*?\b(?:it\s+is\s+for|is\s+for)\s*$/i.test(lines[i])) {
        const candidate = normalizeRecorderTerms(lines[i + 1] || "");
        if (candidate && candidate.length <= 90 && !/\b(?:how can i help|what|which|do you|can you|look it up)\b/i.test(candidate)) {
          $("programName").value = candidate;
          break;
        }
      }
    }
  }

  renderRecorderDetectedSummary();
  setRecorderSaveStatus("Unsaved changes");
  return Object.fromEntries(RECORDER_DETAIL_FIELDS.map(([id]) => [id, value(id)]));
}
function renderRecorderDetectedSummary() {
  const found = RECORDER_DETAIL_FIELDS.map(([id,label])=>({label,value:value(id)})).filter((item)=>item.value);
  const box=$("detectedSummary");
  if (!found.length) { box.className="detected-summary"; box.textContent="No details extracted yet."; return; }
  box.className="detected-summary detected-list has-values";
  box.innerHTML=found.map((item)=>`<span class="detected-chip"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</span>`).join("");
}

function recorderIssueSummary(lines) {
  const candidates = lines.filter((line) => !isRecorderChatter(line));
  const joined = candidates.join(" ");

  if (/initialization[^.]{0,100}(?:fail|failed)/i.test(joined) && /unable to communicate/i.test(joined)) {
    return /(?:auxiliary|aux)\s+locker/i.test(joined)
      ? "Machine initialization failed - unable to communicate with auxiliary locker"
      : "Machine initialization failed - unable to communicate";
  }

  if (/\bconflict\b/i.test(joined) && /\buser group\b/i.test(joined) && /\b(?:program|dispens|batter)\b/i.test(joined)) {
    return "User group dispensing limit conflicts with the program settings";
  }

  const gen2 = candidates.find((line) =>
    /(?:verify|make sure|check|confirm).*(?:account).*(?:transition(?:ed|ing)?).*(?:gen\s*2)/i.test(line) ||
    /(?:account).*(?:transition(?:ed|ing)?).*(?:gen\s*2)/i.test(line)
  );
  if (gen2) return "Caller wanted to verify whether the account has transitioned to Gen 2";

  const createUser = candidates.find((line) =>
    /(?:need|needs|assistance|help|how to|how do i|want to).*(?:create|add).*(?:new\s+)?user.*KeepStock(?:\s+web)?/i.test(line) ||
    /(?:create|add).*(?:new\s+)?user.*KeepStock(?:\s+web)?/i.test(line)
  );
  if (createUser) return "Create a new user in KeepStock Web";

  const accessManagement = /(?:guest user|role to an admin|role.*admin|KeepStock Web admin|vending and inventory management)/i.test(joined) && /(?:user|profile|access)/i.test(joined);
  if (accessManagement) return "User needed KeepStock Web access and Admin permissions";

  const assignment = candidates.find((line) => /not assigned.*(?:program|vending)|(?:program|vending).*not assigned/i.test(line));
  if (assignment) return "Rep was not assigned to the customer's KeepStock programs";

  const strong = /\b(?:unable to|not able to|can(?:not|'t)|could(?: not|n't)|fails? to|failed to|cannot|locked out|not working|issue with|problem with|error|access|log ?in|login|verify|transition|create|add user|new user|conflict|dispens)\b/i;
  const action = /\b(?:sent|clicked|click|submit|requested|reset|advised|explained|asked|reviewed|go to|page number|follow step|receive an email|select all|save|assign|remove|add it back|change)\b/i;
  let best = "";
  let bestScore = -999;
  candidates.forEach((line, index) => {
    let score = 0;
    if (strong.test(line)) score += 8;
    if (/\b(?:unable to|not able to|can(?:not|'t)|cannot|fails? to|failed to|locked out|conflict)\b/i.test(line)) score += 7;
    if (/\bKeepStock\b/i.test(line)) score += 3;
    if (/\b(?:verify|transition|gen\s*2|user group|dispens)\b/i.test(line)) score += 5;
    if (action.test(line)) score -= 4;
    if (/\b(?:crib|program)\s+(?:id|number)\b/i.test(line)) score -= 8;
    if (line.length > 220) score -= 2;
    score -= index * 0.02;
    if (score > bestScore) { bestScore = score; best = line; }
  });

  best = normalizeRecorderTerms(best || candidates[0] || "");
  best = best.replace(/^(.{2,60}?)\s+so\s+\1\s+/i, "$1 ");
  best = best.replace(/\b(?:is not able to|was not able to)\b/i, "is unable to");
  best = best.replace(/\b(?:can not|cannot|can't)\b/i, "is unable to");
  best = best.replace(/\s+/g, " ").trim();
  return best;
}

function recorderSpokenNumber(text) {
  const match = String(text || "").toLowerCase().match(/\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/);
  if (!match) return "";
  if (/^\d+$/.test(match[1])) return match[1];
  const map = { zero:"0", one:"1", two:"2", three:"3", four:"4", five:"5", six:"6", seven:"7", eight:"8", nine:"9", ten:"10", eleven:"11", twelve:"12" };
  return map[match[1]] || "";
}

function recorderUserGroupFromLines(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    if (!/which\s+(?:which\s+)?user group|what\s+user group/i.test(lines[i])) continue;
    for (let offset = 1; offset <= 2; offset += 1) {
      const candidate = normalizeRecorderTerms(lines[i + offset] || "").replace(/[^A-Za-z0-9 &/-]/g, "").trim();
      if (candidate && candidate.split(/\s+/).length <= 4 && !/^(?:yeah|yes|no|okay|ok|all right|alright)$/i.test(candidate)) return candidate;
    }
  }
  return "";
}

function recorderItemCodeFromLines(lines) {
  for (const line of lines) {
    const compact = line.replace(/\s+/g, "").toUpperCase();
    if (/^\d{1,3}[A-Z]{1,4}\d{1,5}$/.test(compact)) return compact;
  }
  return "";
}
function summarizeRecorderStep(line) {
  const text = normalizeRecorderTerms(line);
  const lower = text.toLowerCase();

  if (/(?:both\s+machines?|both\s+machine).*\bpower\b|(?:check|confirm|make sure).*\bpower\b.*(?:both\s+machines?|both\s+machine)/.test(lower)) return "Confirmed both machines had power.";
  if (/(?:serial|molex).*cable|cable.*(?:serial|molex)/.test(lower) && /(?:check|checked|connection|connections|reseat|reseating)/.test(lower)) return "Checked and reseated the serial/Molex cable connections.";
  if (/power\s*cycl(?:e|ed|ing).*\bpc\b|\bpc\b.*power\s*cycl(?:e|ed|ing)/.test(lower)) return "Power cycled the PC.";
  if (/(?:got|back|returned).*login screen|login screen.*(?:back|returned)/.test(lower)) return "Confirmed the PC returned to the login screen after the power cycle.";
  if (/(?:machine|communicat|auxiliary|aux locker|initialization)/.test(lower) && /(?:after\s+logging\s+in|logged\s+(?:back\s+)?in).*\bresolved\b|(?:machine|communicat|locker)[^.]{0,120}confirm(?:ed)?[^.]*\bresolved\b/.test(lower)) return "Logged back in and confirmed the machine communication issue was resolved.";

  if (/teams/.test(lower) && /(?:job|document|message|sent)/.test(lower)) return "Sent the KeepStock password-reset job aid via Teams.";
  if (/clearspider/.test(lower) && /email/.test(lower) && /(?:submit|request|input|enter)/.test(lower)) return "Directed the caller to submit a ClearSpider password-reset request using the customer's email.";
  if (/receive an email|reset (?:his|her|their|the) password|reset password/.test(lower) && /email|link/.test(lower)) return "Advised that the customer will receive a reset email and must complete the reset link and remaining instructions.";
  if (/step\s*(?:1|one).*step\s*(?:7|seven)|follow step|follow.*password-reset instructions?.*(?:final|last) step/.test(lower)) return "Advised the customer to follow the password-reset instructions through the final step.";
  if (/right account/.test(lower) && /KeepStock/.test(text)) return "Confirmed the correct Grainger.com account should be selected before opening KeepStock.";
  if (/password reset/.test(lower) && /required|request/.test(lower)) return "Confirmed a KeepStock password reset is required.";

  if (/(?:not assigned|aren't assigned|not yet assigned).*(?:program|vending)/.test(lower)) return "Verified the rep was not assigned to the customer's KeepStock programs.";
  if (/grainger\.com/.test(lower) && /keepstock/.test(lower) && /account information/.test(lower) && /(?:select all|assign all|save)/.test(lower)) return "Guided the rep to Grainger.com > KeepStock > Account Information, enter the account number, select all programs, and save to assign them to their profile.";
  if (/keepstock web/.test(lower) && /(?:not the app|the app no|website)/.test(lower)) return "Clarified that program assignment must be completed in KeepStock Web, not the app.";
  if (/(?:osr|account manager)/.test(lower) && /customer/.test(lower) && /transition/.test(lower)) return "Explained that the OSR/account manager and customer would be notified before a Gen 2 transition.";

  if (/grainger\.com/.test(lower) && /keepstock/.test(lower) && /(?:log\s*in|login|go to|open)/.test(lower)) return "Guided the rep to log in to Grainger.com and open KeepStock.";
  if (/(?:user\s*(?:and|&)\s*group\s*management|user\s*group\s*management)/.test(lower) && /create\s+user/.test(lower)) return "Directed the rep to User & Group Management > Users > Create User.";
  if (/under\s+users/.test(lower) && /create\s+user/.test(lower)) return "Directed the rep to User & Group Management > Users > Create User.";
  if (/follow\s+(?:the\s+)?(?:prompts?|prom\b|instructions?)/.test(lower)) return "Advised the rep to follow the prompts to complete the new-user setup.";
  if (/assign(?:ed|ing)?\s+(?:some|the|appropriate|all)?\s*programs?.*(?:new\s+)?user|programs?.*assign(?:ed|ing)?.*(?:new\s+)?user/.test(lower)) return "Instructed the rep to assign the appropriate programs to the new user.";

  if (/\bcreating a conflict\b/.test(lower) && /user group/.test(lower)) return "Identified a configuration conflict between the user-group setting and the program setting.";
  if (/remove.*(?:item|one).*user group.*add it back|remove.*(?:item|one).*add it back/.test(lower)) return "Advised removing the item from the user group and adding it back with the correct weekly dispense limit.";
  if (/after a week.*(?:start over|reset)|weekly.*(?:start over|reset)/.test(lower)) return "Explained that the weekly dispense allowance resets after one week.";
  if (/see how that goes|test.*after|try.*after|retest/.test(lower)) return "Advised testing the configuration after the change.";

  let concise = text
    .replace(/^(?:all right|alright|okay|ok|gotcha|awesome|just a moment|just a second|yeah)[, ]*/i, "")
    .replace(/\b(?:let me know when[^.?!]*|bear with me[^.?!]*)\b/gi, "")
    .replace(/\s+/g, " ").trim();
  if (!concise || isRecorderChatter(concise)) return "";
  if (concise.length > 190) concise = `${concise.slice(0, 187).replace(/\s+\S*$/, "")}...`;
  return sentence(concise);
}

function recorderTranscriptLines(raw) {
  return String(raw || "")
    .replace(/\r/g, "\n")
    .replace(/[\u2022\u00b7]/g, "\n")
    .split(/\n|;|(?<=[.!?])\s+/)
    .map(normalizeRecorderTerms)
    .filter(Boolean);
}

function recorderActionIsMetadata(line) {
  const text = normalizeRecorderTerms(line);
  if (/\bserial\s+cable\b|\bmolex\b/i.test(text)) return false;
  return /^(?:acct|account\s*(?:#|number)\s*[:=#-]|device\s*id|machine\s*serial|serial\s*(?:#|number|:)\s*|crib\s*(?:#|number|id)\s*[:=#-]|program\s*(?:id|name)\s*[:=-]|company\s*name\s*[:=-]|customer\s*name\s*[:=-]|site\s*id|software\s*version|sw\s*version|application\s*version|app\s*version|imei\s*[:=-]|carrier\s*[:=-]|badge\s*reader|model\s*[:=-]|phone\s*model|time\s*issue|order\s*(?:#|number)\s*[:=-]|econnections?\s*status\s*[:=-]|sap\s*status\s*[:=-]|ebu\s*(?:number|#)\s*[:=-]|does\s+user\s+want\s+order\s+reposted\s*[:=-])/i.test(text);
}

function recorderActionSignal(text) {
  const line = normalizeRecorderTerms(text).toLowerCase();
  if (!line || recorderActionIsMetadata(line)) return false;
  return /\b(?:check|checked|checking|confirm|confirmed|confirming|verify|verified|verifying|make sure|review|reviewed|reviewing|look up|looked up|looking up|pull(?:ed)? up|inspect|inspected|test|tested|testing|retest|try|tried|log(?:ged)? in|login|sign(?:ed)? in|go to|went to|navigate|navigated|open|opened|click|clicked|select|selected|enter|entered|type|typed|submit|submitted|search|searched|locate|located|find|found|identify|identified|determine|determined|unplug|unplugged|plug|plugged|reseat|reseated|reconnect|reconnected|disconnect|disconnected|connect|connected|power cycle|power cycled|power cycling|restart|restarted|reboot|rebooted|reset|resetting|clear|cleared|refresh|refreshed|reinstall|reinstalled|update|updated|change|changed|configure|configured|set to|remove|removed|add|added|assign|assigned|save|saved|sync|synced|run|ran|ping|pinged|pinging|scan|scanned|replace|replaced|enable|enabled|disable|disabled|turn on|turned on|turn off|turned off|send|sent|email|emailed|message|messaged|call|called|contact|contacted|escalate|escalated|forward|forwarded|advise|advised|instruct|instructed|guide|guided|explain|explained|train|trained|walk through|walked through|asked|had (?:the )?(?:user|rep|caller|customer)|diagnos|investigat|conflict|not assigned|working now|returned to|back to|resolved|fixed|restored|issue cleared|no longer|successful|failed|error message)\b/i.test(line);
}

function recorderSplitActionClauses(text) {
  const normalized = normalizeRecorderTerms(text)
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  return normalized
    .split(/\s+(?:and then|then|after that|next|finally)\s+|,\s*(?=(?:we|i)\s+(?:checked|confirmed|verified|reviewed|tested|retested|restarted|rebooted|reset|power cycled|reseated|reconnected|changed|updated|removed|added|assigned|saved|synced|opened|logged in)\b)/i)
    .map((part) => part.replace(/^(?:and then|then|after that|next|finally)[, ]*/i, "").trim())
    .filter(Boolean);
}

function recorderGenericActionStep(text) {
  let clean = normalizeRecorderTerms(text)
    .replace(/^(?:all right|alright|okay|ok|gotcha|awesome|yeah|yep|so|and|then|next|after that|finally)[, ]*/i, "")
    .replace(/\b(?:bear with me|just a moment|just a second|let me know when[^.?!]*)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean || recorderActionIsMetadata(clean)) return "";
  const lower = clean.toLowerCase();

  // Do not turn the problem statement alone into a troubleshooting step.
  if (/^(?:the )?(?:issue|problem|error|machine|customer|user|rep)\b/i.test(clean) && !/\b(?:checked|confirmed|verified|found|identified|reviewed|tested|changed|reset|restarted|rebooted|reseated|resolved|fixed)\b/i.test(clean)) return "";

  if (/^(?:we|i)\s+(?:are|'re|am|'m)\s+/.test(lower)) clean = clean.replace(/^(?:we|i)\s+(?:are|'re|am|'m)\s+/i, "");
  if (/^(?:we|i)\s+/.test(lower)) clean = clean.replace(/^(?:we|i)\s+/i, "");

  if (/\bworking now\b/i.test(clean) && /\bconfirm(?:ed)?\b/i.test(clean) && /\bresolved\b/i.test(clean)) {
    return "Confirmed the system was working and the issue was resolved.";
  }

  const afterAction = clean.match(/^after\s+(.+?)\s+(?:we|i)\s+(checked|confirmed|verified|reviewed|tested|retested|restarted|rebooted|reset|power cycled|reseated|reconnected|changed|updated|removed|added|assigned|saved|synced|opened|logged in)\s+(.+)$/i);
  if (afterAction) {
    const [, rawContextText, actionVerb, rawObjectText] = afterAction;
    const contextText = rawContextText.replace(/[.!?]+$/g, "");
    const objectText = rawObjectText.replace(/[.!?]+$/g, "");
    const pastMap = {
      checked:"Checked", confirmed:"Confirmed", verified:"Verified", reviewed:"Reviewed", tested:"Tested", retested:"Retested",
      restarted:"Restarted", rebooted:"Rebooted", reset:"Reset", "power cycled":"Power cycled", reseated:"Reseated",
      reconnected:"Reconnected", changed:"Changed", updated:"Updated", removed:"Removed", added:"Added", assigned:"Assigned",
      saved:"Saved", synced:"Synced", opened:"Opened", "logged in":"Logged in"
    };
    return sentence(`${pastMap[actionVerb.toLowerCase()] || actionVerb} ${objectText} after ${contextText}`);
  }

  const transforms = [
    [/^(?:check|checking)\b/i, "Checked"],
    [/^(?:confirm|confirming|make sure)\b/i, "Confirmed"],
    [/^(?:verify|verifying)\b/i, "Verified"],
    [/^(?:review|reviewing)\b/i, "Reviewed"],
    [/^(?:look up|looking up)\b/i, "Looked up"],
    [/^(?:pull up|pulling up)\b/i, "Pulled up"],
    [/^(?:inspect|inspecting)\b/i, "Inspected"],
    [/^(?:test|testing)\b/i, "Tested"],
    [/^retest\b/i, "Retested"],
    [/^(?:restart|restarting)\b/i, "Restarted"],
    [/^(?:reboot|rebooting)\b/i, "Rebooted"],
    [/^(?:reset|resetting)\b/i, "Reset"],
    [/^(?:power cycle|power cycling)\b/i, "Power cycled"],
    [/^(?:reseat|reseating)\b/i, "Reseated"],
    [/^(?:reconnect|reconnecting)\b/i, "Reconnected"],
    [/^(?:disconnect|disconnecting)\b/i, "Disconnected"],
    [/^(?:connect|connecting)\b/i, "Connected"],
    [/^(?:remove|removing)\b/i, "Removed"],
    [/^(?:add|adding)\b/i, "Added"],
    [/^(?:assign|assigning)\b/i, "Assigned"],
    [/^(?:change|changing)\b/i, "Changed"],
    [/^(?:configure|configuring)\b/i, "Configured"],
    [/^(?:save|saving)\b/i, "Saved"],
    [/^(?:sync|syncing)\b/i, "Synced"],
    [/^(?:ping|pinged|pinging)\b/i, "Pinged"],
    [/^(?:scan|scanning)\b/i, "Scanned"],
    [/^(?:run|running)\b/i, "Ran"],
    [/^(?:replace|replacing)\b/i, "Replaced"],
    [/^(?:enable|enabling)\b/i, "Enabled"],
    [/^(?:disable|disabling)\b/i, "Disabled"],
    [/^(?:unplug|unplugging)\b/i, "Unplugged"],
    [/^(?:plug in|plugging in|plug)\b/i, "Plugged in"],
    [/^(?:send|sending)\b/i, "Sent"],
    [/^(?:contact|contacting)\b/i, "Contacted"],

    [/^(?:open|opening)\b/i, "Opened"],
    [/^(?:click|clicking)\b/i, "Clicked"],
    [/^(?:select|selecting)\b/i, "Selected"],
    [/^(?:enter|entering)\b/i, "Entered"],
    [/^(?:submit|submitting)\b/i, "Submitted"],
    [/^(?:log in|logging in|login)\b/i, "Logged in"],
    [/^(?:go to|going to|navigate to|navigating to)\b/i, "Navigated to"],
    [/^(?:explain|explaining)\b/i, "Explained"],
    [/^(?:advise|advising)\b/i, "Advised"],
    [/^(?:instruct|instructing)\b/i, "Instructed"],
    [/^(?:guide|guiding)\b/i, "Guided"],
    [/^(?:train|training)\b/i, "Trained"],
    [/^(?:identify|identifying)\b/i, "Identified"],
    [/^(?:find|finding)\b/i, "Found"],
  ];
  for (const [pattern, replacement] of transforms) {
    if (pattern.test(clean)) {
      clean = clean.replace(pattern, replacement);
      break;
    }
  }

  // Imperative guidance is an action even when spoken directly to the caller.
  if (/^(?:you need to|you have to|you should|i need you to|i'm going to need you to|i am going to need you to)\b/i.test(clean)) {
    clean = `Instructed the rep to ${clean.replace(/^(?:you need to|you have to|you should|i need you to|i'm going to need you to|i am going to need you to)\s*/i, "")}`;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  const incompleteEnding = /\b(?:the|a|an|to|and|or|that|this|it|you|we|i|for|on|in|with|from|of|will|would|should|could|can|is|are|was|were|be)\.?$/i.test(clean);
  const conciseTechnicalAction = words.length >= 2 && /^(?:Pinged|Scanned|Ran|Replaced|Enabled|Disabled|Unplugged|Plugged in|Sent|Contacted|Restarted|Rebooted|Reset|Synced|Submitted)\b/i.test(clean);
  if (incompleteEnding || (words.length < 3 && !conciseTechnicalAction)) return "";

  if (/^(?:checked|confirmed|verified|reviewed|looked up|pulled up|inspected|tested|retested|restarted|rebooted|reset|power cycled|reseated|reconnected|disconnected|connected|removed|added|assigned|changed|configured|saved|synced|opened|clicked|selected|entered|submitted|logged in|navigated to|explained|advised|instructed|guided|trained|identified|found|sent|emailed|contacted|escalated|pinged|scanned|ran|replaced|enabled|disabled|unplugged|plugged in)\b/i.test(clean)) {
    return sentence(clean);
  }

  // Findings that describe a configuration/state are useful troubleshooting evidence.
  if (/\b(?:not assigned|set to|dispensing|conflict|returned to|back to|working now|resolved|fixed|restored|successful)\b/i.test(clean)) {
    return sentence(clean);
  }
  return "";
}

function recorderStepTokens(text) {
  const stop = new Set(["the","a","an","to","and","or","of","in","on","for","with","after","before","then","that","this","we","i","rep","user","customer","caller","was","were","is","are","be","been","being","it"]);
  return normalizeRecorderTerms(text).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((token) => token.length > 2 && !stop.has(token)).map((token) => token.replace(/(?:ing|ed)$/i, "").replace(/ies$/i, "y").replace(/s$/i, ""));
}

function recorderStepsOverlap(a, b) {
  const left = new Set(recorderStepTokens(a));
  const right = new Set(recorderStepTokens(b));
  if (!left.size || !right.size) return false;
  let shared = 0;
  left.forEach((token) => { if (right.has(token)) shared += 1; });
  const ratio = shared / Math.min(left.size, right.size);
  const aKey = String(a).toLowerCase().replace(/[^a-z0-9]/g, "");
  const bKey = String(b).toLowerCase().replace(/[^a-z0-9]/g, "");
  return aKey === bKey || (Math.min(aKey.length, bKey.length) > 24 && (aKey.includes(bKey) || bKey.includes(aKey))) || (shared >= 5 && ratio >= 0.85);
}

function recorderIsCanonicalStep(step) {
  return /^(?:Confirmed both machines had power|Checked and reseated the serial\/Molex cable connections|Checked the serial\/Molex cable connections|Power cycled the PC|Confirmed the PC returned to the login screen|Logged back in and confirmed|Sent the KeepStock password-reset job aid|Directed the caller to submit a ClearSpider|Advised that the customer will receive a reset email|Advised the customer to follow the password-reset instructions|Confirmed the correct Grainger\.com account|Confirmed a KeepStock password reset is required|Verified the rep was not assigned|Guided the rep to Grainger\.com|Clarified that program assignment|Explained that the OSR|Guided the rep to log in to Grainger\.com|Directed the rep to User & Group Management|Advised the rep to follow the prompts|Instructed the rep to assign the appropriate programs|Identified a configuration conflict|Advised removing the item from the user group|Explained that the weekly dispense allowance|Advised testing the configuration)/i.test(sentence(step));
}

function recorderBuildActionLedger(raw) {
  const lines = recorderTranscriptLines(raw);
  const candidates = [];
  const add = (index, text, priority = 1) => {
    const step = sentence(text);
    if (!step || isRecorderChatter(step) || recorderActionIsMetadata(step)) return;
    candidates.push({ index, text: step, priority });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (recorderActionIsMetadata(line)) continue;

    const window2 = [line, lines[i + 1]].filter(Boolean).join(" ");
    const window3 = [line, lines[i + 1], lines[i + 2]].filter(Boolean).join(" ");

    // Feed overlapping windows through the domain-aware summarizer. This catches
    // Deepgram fragments such as "make sure both machine" + "got power".
    [window3, window2].forEach((windowText) => {
      if (!recorderActionSignal(windowText)) return;
      const summarized = summarizeRecorderStep(windowText);
      if (summarized && recorderIsCanonicalStep(summarized)) add(i, summarized, 3);
    });

    if (!recorderActionSignal(line)) continue;
    const clauses = recorderSplitActionClauses(line);
    (clauses.length ? clauses : [line]).forEach((clause) => {
      if (!recorderActionSignal(clause)) return;
      const specialized = summarizeRecorderStep(clause);
      const generic = recorderGenericActionStep(clause);
      if (specialized && recorderIsCanonicalStep(specialized)) add(i, specialized, 3);
      if (generic) add(i, generic, 1);
    });
  }

  // Prefer the most specific wording for the same underlying action while retaining
  // all distinct actions. Sorting by source index keeps the call chronology.
  candidates.sort((a, b) => a.index - b.index || b.priority - a.priority);
  const kept = [];
  candidates.forEach((candidate) => {
    const duplicateIndex = kept.findIndex((item) => Math.abs(item.index - candidate.index) <= 3 && recorderStepsOverlap(item.text, candidate.text));
    if (duplicateIndex === -1) {
      kept.push(candidate);
      return;
    }
    const existing = kept[duplicateIndex];
    if (candidate.priority > existing.priority || (candidate.priority === existing.priority && candidate.text.length > existing.text.length)) {
      kept[duplicateIndex] = candidate;
    }
  });

  // Remove generic fragments when a stronger canonical step for the same concept exists.
  const texts = kept.map((item) => item.text);
  const has = (re) => texts.some((text) => re.test(text));
  return kept
    .filter((item) => {
      const lower = item.text.toLowerCase();
      if (has(/confirmed both machines had power/i) && /(?:checked|confirmed).*power/i.test(lower) && !/both machines had power/i.test(lower)) return false;
      if (has(/checked and reseated the serial\/molex cable connections/i) && /(?:serial|molex|cable connection)/i.test(lower) && !/checked and reseated/i.test(lower)) return false;
      if (has(/power cycled the pc/i) && /power cycl/i.test(lower) && !/^power cycled the pc\.?$/i.test(item.text)) return false;
      if (has(/returned to the login screen/i) && /login screen/i.test(lower) && !/returned to the login screen/i.test(lower)) return false;
      return true;
    })
    .sort((a, b) => a.index - b.index)
    .map((item) => item.text);
}

function recorderPreferCanonicalSteps(steps) {
  const has = (re) => steps.some((step) => re.test(step));
  return steps.filter((step) => {
    const lower = step.toLowerCase();
    if (has(/Confirmed both machines had power/i) && /(?:both machines?|both machine)|^Checked (?:for )?(?:the )?power\b|^Confirmed (?:the )?power\b/i.test(step) && !/Confirmed both machines had power/i.test(step)) return false;
    if (has(/Checked and reseated the serial\/Molex cable connections/i) && /(?:serial|molex|cable connection)/i.test(step) && !/Checked and reseated/i.test(step)) return false;
    if (has(/Power cycled the PC/i) && /^Power cycl/i.test(step) && !/^Power cycled the PC\.?$/i.test(step)) return false;
    if (has(/Confirmed the PC returned to the login screen/i) && /login screen/i.test(step) && !/Confirmed the PC returned/i.test(step)) return false;
    if (has(/Logged back in and confirmed the machine communication issue was resolved/i) && /(?:\blogged (?:back )?in\b|\bresolved\b)/i.test(step) && !/Logged back in and confirmed/i.test(step)) return false;

    if (has(/Guided the rep to log in to Grainger\.com and open KeepStock/i) && /(?:grainger\.com|navigated to KeepStock|open KeepStock|go login)/i.test(step) && !/Guided the rep to log in/i.test(step)) return false;
    if (has(/Directed the rep to User & Group Management > Users > Create User/i) && /(?:user.*group management|create user)/i.test(step) && !/Directed the rep to User & Group Management/i.test(step)) return false;
    if (has(/Advised the rep to follow the prompts/i) && /follow.*prompt/i.test(step) && !/Advised the rep/i.test(step)) return false;
    if (has(/Instructed the rep to assign the appropriate programs/i) && /assign.*program/i.test(step) && !/Instructed the rep/i.test(step)) return false;

    if (has(/Confirmed the correct Grainger\.com account should be selected/i) && /right account|correct.*account/i.test(step) && !/Confirmed the correct Grainger\.com account/i.test(step)) return false;
    if (has(/Sent the KeepStock password-reset job aid via Teams/i) && /(?:teams|job aid|message)/i.test(step) && !/Sent the KeepStock password-reset/i.test(step)) return false;
    if (has(/Directed the caller to submit a ClearSpider password-reset request/i) && /(?:clearspider|submit.*request|email address)/i.test(step) && !/Directed the caller to submit/i.test(step)) return false;
    if (has(/Advised that the customer will receive a reset email/i) && /(?:receive.*email|reset.*password|reset link)/i.test(step) && !/Advised that the customer will receive/i.test(step)) return false;
    if (has(/Advised the customer to follow the password-reset instructions/i) && /(?:follow step|page number|step one|step 1)/i.test(step) && !/Advised the customer to follow/i.test(step)) return false;
    if (has(/(?:ClearSpider password-reset request|reset email|password-reset instructions)/i) && /^Reset\s+\w+\.?$/i.test(step)) return false;

    if (has(/Checked the program dispensing setting/i) && /program.*dispens|dispens.*program/i.test(step) && !/Checked the program dispensing setting/i.test(step) && !/^Identified a configuration conflict/i.test(step)) return false;
    if (has(/Identified a configuration conflict:/i) && /(?:conflict|confusion).*(?:user group|program)|user group.*conflict/i.test(step) && !/Identified a configuration conflict:/i.test(step)) return false;
    if (has(/Advised removing the item from the user group, adding it back, and setting the user-group limit/i) && /Advised removing the item from the user group and adding it back/i.test(step) && !/setting the user-group limit/i.test(step)) return false;
    if (has(/Advised removing the item from the user group/i) && /^(?:Removed|Added).*\b(?:item|back)|(?:remove|removed|add|added).*(?:item|user group)/i.test(step) && !/Advised removing the item/i.test(step)) return false;
    if (has(/Explained that the weekly dispense allowance resets/i) && /(?:week|weekly).*(?:reset|start over)/i.test(step) && !/Explained that the weekly/i.test(step)) return false;
    return true;
  });
}

function recorderMergeTroubleshootingSteps(raw, contextualSteps, ledgerSteps) {
  const sourceLines = recorderTranscriptLines(raw);
  const sourceIndex = (step, fallback) => {
    const conceptPatterns = [
      [/Confirmed both machines had power/i, /both\s+machines?.*power|make sure.*both\s+machine|got power/i],
      [/serial\/Molex cable connections/i, /serial\s+cable|molex|cable connections/i],
      [/Power cycled the PC/i, /power\s*cycl.*pc/i],
      [/returned to the login screen/i, /back to the login screen|returned.*login screen/i],
      [/Logged back in and confirmed/i, /logging in|logged.*in|resolved/i],
      [/log in to Grainger\.com and open KeepStock/i, /grainger\.com.*KeepStock|login.*Grainger\.com/i],
      [/User & Group Management/i, /user.*group management|under users.*create user/i],
      [/follow the prompts/i, /follow.*prom/i],
      [/assign the appropriate programs/i, /assign.*program/i],
      [/password-reset job aid via Teams/i, /teams/i],
      [/ClearSpider password-reset request/i, /ClearSpider.*email|submit request/i],
      [/receive a reset email/i, /receive.*email|reset.*email/i],
      [/follow the password-reset instructions/i, /follow step|step one|step 1/i],
      [/program dispensing setting/i, /(?:it is|it\'s|program.*is).*dispensing/i],
      [/configuration conflict:/i, /conflict|confusion/i],
      [/removing the item from the user group/i, /remove.*item|add it back/i],
      [/limited to .* batteries per week/i, /only.*dispense.*batter.*week/i],
      [/weekly dispense allowance resets/i, /after a week.*start over|weekly.*reset/i],
      [/testing the updated user-group configuration/i, /see how that goes|retest|test.*after/i],
      [/Guest with limited vending-machine access/i, /guest user.*vending|only a guest user/i],
      [/open KeepStock Web and access the user's profile/i, /KeepStock(?: Stock)? Web.*profile|go to (?:his|her|their) profile/i],
      [/update the user's role to Admin/i, /update.*role.*admin|updated.*to an admin/i],
      [/Systems access for Vending and Inventory Management/i, /vending and inventory management|KeepStock Web admin/i],
      [/locate the user under Users using the company ID/i, /once you go to users|go to users.*company ID|type in the company ID|search(?: up)? by.*first.*last.*name/i],
      [/edit the user profile/i, /edit button|edit (?:him|her|them|the user)/i],
      [/Saved the user profile/i, /email address|save it/i],
      [/user now showed as Admin with KeepStock Web access/i, /looks like.*admin|updated.*admin|given.*access to KeepStock Web/i],
      [/log out of Grainger\.com, log back in/i, /log out.*log back|Grainger\.com.*KeepStock/i],
      [/password reset is only needed/i, /if.*still.*(?:unable|asks|prompt)|password reset.*(?:call us back|assistance)/i],
    ];
    for (const [stepPattern, sourcePattern] of conceptPatterns) {
      if (!stepPattern.test(step)) continue;
      const direct = sourceLines.findIndex((line, index) => sourcePattern.test([line, sourceLines[index + 1], sourceLines[index + 2]].filter(Boolean).join(" ")));
      if (direct >= 0) return direct;
    }
    const tokens = new Set(recorderStepTokens(step));
    let bestIndex = fallback;
    let bestScore = 0;
    for (let i = 0; i < sourceLines.length; i += 1) {
      const window = [sourceLines[i], sourceLines[i + 1], sourceLines[i + 2]].filter(Boolean).join(" ");
      const windowTokens = new Set(recorderStepTokens(window));
      let score = 0;
      tokens.forEach((token) => { if (windowTokens.has(token)) score += 1; });
      if (score > bestScore) { bestScore = score; bestIndex = i; }
    }
    return bestIndex;
  };

  const entries = [];
  ledgerSteps.forEach((text, index) => entries.push({ text: sentence(text), index: sourceIndex(text, index), priority: 1 }));
  contextualSteps.forEach((text, index) => entries.push({ text: sentence(text), index: sourceIndex(text, sourceLines.length + index), priority: 3 }));
  entries.sort((a, b) => a.index - b.index || b.priority - a.priority);

  const kept = [];
  entries.forEach((entry) => {
    const duplicateIndex = kept.findIndex((item) => recorderStepsOverlap(item.text, entry.text));
    if (duplicateIndex === -1) {
      kept.push(entry);
      return;
    }
    if (entry.priority > kept[duplicateIndex].priority) kept[duplicateIndex] = entry;
  });
  return recorderPreferCanonicalSteps(kept.sort((a, b) => a.index - b.index).map((entry) => entry.text));
}

function recorderResolutionActionPhrase(step) {
  let text = sentence(step).replace(/[.!?]+$/, "");
  const replacements = [
    [/^Power cycled\b/i, "power cycling"], [/^Restarted\b/i, "restarting"], [/^Rebooted\b/i, "rebooting"],
    [/^Reset\b/i, "resetting"], [/^Reseated\b/i, "reseating"], [/^Reconnected\b/i, "reconnecting"],
    [/^Changed\b/i, "changing"], [/^Configured\b/i, "configuring"], [/^Updated\b/i, "updating"],
    [/^Removed\b/i, "removing"], [/^Added\b/i, "adding"], [/^Assigned\b/i, "assigning"],
    [/^Reinstalled\b/i, "reinstalling"], [/^Cleared\b/i, "clearing"], [/^Synced\b/i, "syncing"],
    [/^Enabled\b/i, "enabling"], [/^Disabled\b/i, "disabling"], [/^Replaced\b/i, "replacing"],
    [/^Tested\b/i, "testing"], [/^Retested\b/i, "retesting"]
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function recorderResolutionFromActions(explicitResolution, steps) {
  if (!explicitResolution) return "";
  const resolutionText = normalizeRecorderTerms(explicitResolution);
  const vague = /\b(?:resolved|fixed|working now|issue cleared|successful)\b/i.test(resolutionText) && resolutionText.split(/\s+/).length < 18;
  if (!vague) return summarizeRecorderStep(resolutionText) || sentence(resolutionText);

  const fixSteps = steps.filter((step) => /\b(?:reseated|reconnected|restarted|rebooted|reset|power cycled|changed|configured|updated|removed|added|assigned|reinstalled|cleared|synced|enabled|disabled|replaced)\b/i.test(step));
  if (!fixSteps.length) return summarizeRecorderStep(resolutionText) || sentence(resolutionText);
  const recent = fixSteps.slice(-2).map(recorderResolutionActionPhrase);
  if (recent.length === 1) return `Resolved the issue after ${recent[0]}.`;
  return `Resolved the issue after ${recent[0]} and ${recent[1]}.`;
}

function recorderSections(raw = value("newRawNotes")) {
  const cleaned = cleanNotesText(raw);
  const lines = cleaned.split(/\n+/).map(normalizeRecorderTerms).filter(Boolean);
  const metadata = /^(?:acct|account\s*(?:#|number)\s*[:=#-]|device\s*id|machine\s*serial|serial|crib|program\s*(?:id|name)\s*[:=-]|company\s*name\s*[:=-]|customer\s*name\s*[:=-]|site\s*id|software\s*version|sw\s*version|application\s*version|app\s*version|imei|carrier\s*[:=-]|badge\s*reader|model\s*[:=-]|phone\s*model|time\s*issue|order\s*(?:#|number)|econnections?\s*status|sap\s*status|ebu\s*(?:number|#)|does\s+user\s+want\s+order\s+reposted)/i;
  const resolutionRe = /(resolved|fixed|restored|working now|sync successful|synced successfully|successful|completed|issue cleared|no longer|customer confirmed|user confirmed)/i;
  const actionRe = /\b(confirmed|verified|checked|located|looked|pulled up|unplugged|plugged|pressed|restarted|rebooted|reset|synced|cleared|tested|opened|closed|sent|forwarded|advised|explained|asked|reviewed|contacted|power cycled|had user|investigated|escalated|click|clicked|submit|requested|receive an email|follow step|follow|right account|assigned|assign|select all|save|log into|log in|login|go to|open|create user|user and group management|account information|change|remove|add it back|dispens|conflict|per week|start over|pack of)\b/i;

  const narrative = lines.filter((line) => {
    // "serial" can be a metadata field, but "serial cable" is a troubleshooting
    // instruction and must remain in the narrative.
    if (/\bserial\s+cable\b|\bmolex\b/i.test(line)) return true;
    return !metadata.test(line);
  });
  const meaningful = narrative.filter((line) => !isRecorderChatter(line));
  const combined = meaningful.join(" ");
  const rawCombined = normalizeRecorderTerms(String(raw || "").replace(/\s*\n\s*/g, " "));
  const explicitResolution = [...meaningful].reverse().find((line) => resolutionRe.test(line));

  const gen2Context = meaningful.some((line) => /transition(?:ed|ing)?.*gen\s*2|gen\s*2.*transition/i.test(line));
  const workstationCheck = meaningful.some((line) => /(?:don't|do not|didn't|did not).*see.*workstation|workstation.*(?:don't|do not|didn't|did not).*see/i.test(line));
  const programUnassigned = meaningful.some((line) => /not assigned.*(?:program|vending)|(?:program|vending).*not assigned/i.test(line));
  const programGuidance = meaningful.some((line) => /grainger\.com.*keepstock.*account information|account information.*select all.*save/i.test(line));
  const keepstockWeb = meaningful.some((line) => /keepstock web/i.test(line));
  const passwordResetContext = meaningful.some((line) => /password reset|reset email|ClearSpider/i.test(line));
  const passwordResetConditionalContext = /(?:if|unless)[^.]{0,220}(?:still unable|still asks|still prompt|prompts?|unable to access)[^.]{0,220}password reset|password reset[^.]{0,220}(?:if|unless)[^.]{0,160}(?:still unable|still asks|still prompt|prompts?)/i.test(rawCombined);
  const passwordResetPerformedContext = /ClearSpider|reset email|emailed? reset|submitted?.*reset|password-reset request|reset link|sent.*reset/i.test(rawCombined) && !passwordResetConditionalContext;

  const userAccessManagementContext = /(?:guest user|role to an admin|role.*admin|KeepStock Web admin|vending and inventory management)/i.test(rawCombined) && /(?:user|profile|access)/i.test(rawCombined);
  const userWasGuest = /guest user[^.]{0,160}(?:vending|access)|only a guest user/i.test(rawCombined);
  const userProfileStep = /(?:go to|open)[^.]{0,100}(?:KeepStock(?: Stock)? Web|KeepStock Web)[^.]{0,120}(?:profile|user profile)|go to (?:his|her|their) profile/i.test(rawCombined);
  const userSearchStep = /(?:go to|once you go to)[^.]{0,100}users|type in the company id|search(?: up)? by (?:his|her|their)[^.]{0,80}first[^.]{0,80}last[^.]{0,80}name/i.test(rawCombined);
  const userEditStep = /edit button|edit (?:him|her|them|the user|user profile)/i.test(rawCombined);
  const userRoleAdminStep = /(?:update|change|set)[^.]{0,100}(?:role|user)[^.]{0,100}admin|updated[^.]{0,100}to an admin/i.test(rawCombined);
  const userSystemsStep = /vending and inventory management/i.test(rawCombined) || /vending machines?[^.]{0,160}KeepStock Web admin/i.test(rawCombined);
  const userSaveStep = /(?:input|enter)[^.]{0,120}email address[^.]{0,160}save|save it/i.test(rawCombined);
  const userAdminVerified = /looks like (?:he|she|they)(?:'s| is) an admin|updated (?:him|her|them)[^.]{0,100}admin|given (?:him|her|them)[^.]{0,140}access to KeepStock Web/i.test(rawCombined);
  const userRelogStep = /log out[^.]{0,180}log back[^.]{0,180}Grainger\.com[^.]{0,180}KeepStock|log out[^.]{0,180}log back[^.]{0,180}KeepStock/i.test(rawCombined);

  // Machine / auxiliary-locker calls are commonly captured from the agent side only.
  // Treat the agent's checks, reseats, reboots and verification statements as the
  // authoritative troubleshooting sequence even when the caller is not recorded.
  const machineCommunicationContext =
    (/initialization[^.]{0,120}(?:fail|failed)/i.test(combined) && /unable to communicate/i.test(combined)) ||
    (/unable to communicate/i.test(combined) && /(?:auxiliary|aux)\s+locker/i.test(combined));
  const machinePowerConfirmed = /(?:both\s+machines?|both\s+machine).*\bpower\b|(?:check|confirm|make sure).*\bpower\b.*(?:both\s+machines?|both\s+machine)/i.test(combined);
  const machineCableChecked = /(?:serial|molex).*cable|cable.*(?:serial|molex)/i.test(combined);
  const machineCableReseated = /reseat|reseating|reseated/i.test(combined);
  const machinePowerCycled = /power\s*cycl(?:e|ed|ing).*\bpc\b|\bpc\b.*power\s*cycl(?:e|ed|ing)/i.test(combined);
  const machineLoginRestored = /(?:got|back|returned).*login screen|login screen.*(?:back|returned)/i.test(combined);
  const machineVerifiedResolved = /(?:after\s+logging\s+in|logged\s+(?:back\s+)?in)[^.]{0,120}\bresolved\b|confirm(?:ed)?[^.]{0,120}\bresolved\b/i.test(combined);
  const createUserContext = meaningful.some((line) =>
    /(?:need|needs|assistance|help|how to|want to).*(?:create|add).*(?:new\s+)?user.*keepstock/i.test(line) ||
    /(?:create|add).*(?:new\s+)?user.*keepstock/i.test(line)
  );
  const createUserLoginStep = meaningful.some((line) => /grainger\.com/i.test(line) && /keepstock/i.test(line) && /(?:log\s*in|login|go to|open)/i.test(line));
  const createUserMenuStep = meaningful.some((line) => /(?:user\s*(?:and|&)\s*group\s*management|user\s*group\s*management)/i.test(line) && /create\s+user/i.test(line));
  const createUserPromptStep = meaningful.some((line) => /follow\s+(?:the\s+)?(?:prompts?|prom\b|instructions?)/i.test(line));
  const createUserAssignStep = meaningful.some((line) => /assign(?:ed|ing)?\s+(?:some|the|appropriate|all)?\s*programs?.*(?:new\s+)?user|programs?.*assign(?:ed|ing)?.*(?:new\s+)?user/i.test(line));

  const dispenseConflictContext = /\bconflict\b/i.test(combined) && /\buser group\b/i.test(combined) && /\b(?:program|dispens|batter)\b/i.test(combined);
  const affectedUserGroup = recorderUserGroupFromLines(lines);
  const packMatch = combined.match(/\bpack of\s+(\d+)\b/i);
  const packSize = packMatch ? packMatch[1] : "";
  const itemCode = recorderItemCodeFromLines(lines);
  const programDispenseLine = meaningful.find((line) => /\b(?:it is|it's|program.*is).*dispensing\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(line)) || "";
  const programDispense = recorderSpokenNumber(programDispenseLine);
  const groupLimitLine = meaningful.find((line) => /\bthinking\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+batter(?:y|ies).*week\b/i.test(line)) || "";
  const groupLimit = recorderSpokenNumber(groupLimitLine);
  const readdContext = /remove.*(?:item|one).*add it back/i.test(combined) || /remove.*user group.*add/i.test(combined);
  const weeklyLimitContext = /only.*dispense.*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten).*batter(?:y|ies).*week/i.test(combined);
  const weeklyResetContext = /after a week.*(?:start over|dispense)|week.*(?:start over|reset)/i.test(combined);
  const retestContext = /see how that goes|retest|test.*after|try.*after/i.test(combined);
  const lookedUpProgram = meaningful.some((line) => /got that pulled up|pulled (?:it|that) up|look(?:ed)? it up/i.test(line));

  const contextualSteps = [];

  if (machineCommunicationContext) {
    if (machinePowerConfirmed) contextualSteps.push("Confirmed both machines had power.");
    if (machineCableChecked) contextualSteps.push(machineCableReseated
      ? "Checked and reseated the serial/Molex cable connections."
      : "Checked the serial/Molex cable connections.");
    if (machinePowerCycled) contextualSteps.push("Power cycled the PC.");
    if (machineLoginRestored) contextualSteps.push("Confirmed the PC returned to the login screen after the power cycle.");
    if (machineVerifiedResolved) contextualSteps.push("Logged back in and confirmed the machine communication issue was resolved.");
  }

  if (gen2Context && workstationCheck) contextualSteps.push("Checked Workstation and found no indication the account had transitioned to Gen 2.");
  if (gen2Context && meaningful.some((line) => /(?:osr|account manager)/i.test(line) && /customer/i.test(line) && /transition/i.test(line))) contextualSteps.push("Explained that the OSR/account manager and customer would be notified before a Gen 2 transition.");
  if (programUnassigned) contextualSteps.push("Verified the rep was not assigned to the customer's KeepStock programs.");
  if (programGuidance) contextualSteps.push("Guided the rep to Grainger.com > KeepStock > Account Information, enter the account number, select all programs, and save to assign them to their profile.");
  if (keepstockWeb && meaningful.some((line) => /app|website/i.test(line))) contextualSteps.push("Clarified that program assignment must be completed in KeepStock Web, not the app.");
  if (createUserContext && createUserLoginStep) contextualSteps.push("Guided the rep to log in to Grainger.com and open KeepStock.");
  if (createUserContext && createUserMenuStep) contextualSteps.push("Directed the rep to User & Group Management > Users > Create User.");
  if (createUserContext && createUserPromptStep) contextualSteps.push("Advised the rep to follow the prompts to complete the new-user setup.");
  if (createUserContext && createUserAssignStep) contextualSteps.push("Instructed the rep to assign the appropriate programs to the new user.");

  if (userAccessManagementContext) {
    if (userWasGuest) contextualSteps.push("Confirmed the user was a Guest with limited vending-machine access.");
    if (userProfileStep) contextualSteps.push("Guided the rep to open KeepStock Web and access the user's profile.");
    if (userRoleAdminStep) contextualSteps.push("Instructed the rep to update the user's role to Admin.");
    if (userSystemsStep) contextualSteps.push("Configured Systems access for Vending and Inventory Management and KeepStock Web Admin.");
    if (userSearchStep) contextualSteps.push("Instructed the rep to locate the user under Users using the company ID and first/last name.");
    if (userEditStep) contextualSteps.push("Guided the rep to edit the user profile.");
    if (userSaveStep) contextualSteps.push("Saved the user profile after entering the required email address.");
    if (userAdminVerified) contextualSteps.push("Verified the user now showed as Admin with KeepStock Web access.");
    if (userRelogStep) contextualSteps.push("Instructed the customer to log out of Grainger.com, log back in, open KeepStock, and verify KeepStock Web access.");
    if (passwordResetConditionalContext) contextualSteps.push("Explained that a password reset is only needed if the customer is still prompted for a KeepStock user ID/password; support can assist with the reset.");
  }

  if (dispenseConflictContext) {
    const crib = value("cribProgramId");
    const program = value("programName");
    if (lookedUpProgram && (crib || program)) {
      const target = [crib ? `Crib/Program ${crib}` : "", program ? `for ${program}` : ""].filter(Boolean).join(" ");
      contextualSteps.push(`Pulled up ${target}.`);
    }
    if (affectedUserGroup) contextualSteps.push(`Confirmed the affected user group is ${affectedUserGroup}.`);
    if (packSize) contextualSteps.push(`Confirmed the item is a pack of ${packSize}.`);
    if (itemCode) contextualSteps.push(`Reviewed item ${itemCode}.`);
    if (programDispense) contextualSteps.push(`Checked the program dispensing setting and confirmed it is set to dispense ${programDispense} each.`);
    if (groupLimit && programDispense) contextualSteps.push(`Identified a configuration conflict: the user group was set to ${groupLimit} battery per week while the program was set to ${programDispense}.`);
    else contextualSteps.push("Identified a configuration conflict: the user-group dispensing limit did not match the program dispensing setting.");
    if (readdContext) contextualSteps.push(`Advised removing the item from the user group, adding it back, and setting the user-group limit to ${programDispense ? `${programDispense} batteries per week` : "match the program's configured quantity"}.`);
    if (weeklyLimitContext && programDispense) contextualSteps.push(`Confirmed the user should be limited to ${programDispense} batteries per week.`);
    if (weeklyResetContext) contextualSteps.push("Explained that the weekly dispense allowance resets after one week.");
    if (retestContext) contextualSteps.push("Advised testing the updated user-group configuration after the change.");
  }

  const ledgerSteps = recorderBuildActionLedger(raw);
  const steps = recorderMergeTroubleshootingSteps(raw, contextualSteps, ledgerSteps);

  let resolution = "";
  if (machineCommunicationContext && machineVerifiedResolved && (machinePowerCycled || machineCableChecked)) {
    if (machinePowerCycled && machineCableChecked) {
      resolution = "Resolved the machine initialization/communication issue by reseating the serial/Molex cable connections and power cycling the PC; login and machine communication were verified afterward.";
    } else if (machinePowerCycled) {
      resolution = "Resolved the machine initialization/communication issue by power cycling the PC; login and machine communication were verified afterward.";
    } else {
      resolution = "Resolved the machine initialization/communication issue by reseating the serial/Molex cable connections and verifying machine communication afterward.";
    }
  } else if (userAccessManagementContext && userAdminVerified) {
    resolution = `Updated the user's role to Admin and granted Vending and Inventory Management plus KeepStock Web Admin access. ${userRelogStep ? "Customer was instructed to log out and back in through Grainger.com > KeepStock to verify access." : ""}${passwordResetConditionalContext ? " Password reset is only required if the KeepStock credential prompt remains." : ""}`.replace(/\s+/g, " ").trim();
  } else if (userAccessManagementContext) {
    resolution = `Rep was trained on updating the user's KeepStock Web role and required system access.${userRelogStep ? " Customer was instructed to log out and back in to verify access." : ""}${passwordResetConditionalContext ? " Password reset is only required if the KeepStock credential prompt remains." : ""}`.replace(/\s+/g, " ").trim();
  } else if (explicitResolution) {
    resolution = recorderResolutionFromActions(explicitResolution, steps);
  } else if (dispenseConflictContext && readdContext) {
    const amount = programDispense || "the program's configured quantity";
    resolution = `Identified a dispensing-limit conflict between the user group and program. Rep was instructed to remove and re-add the item in the user group with a weekly limit of ${programDispense ? `${programDispense} batteries per week` : amount} to match the program, then retest.`;
  } else if (dispenseConflictContext) {
    resolution = "Identified a dispensing-limit conflict between the user group and program; user-group settings need to be aligned with the program configuration.";
  } else if (createUserContext && createUserAssignStep) {
    resolution = "Rep was trained on creating a new user in KeepStock Web and assigning programs to the user's profile.";
  } else if (createUserContext) {
    resolution = "Rep was trained on creating a new user in KeepStock Web.";
  } else if (passwordResetPerformedContext) {
    resolution = "Customer to complete the KeepStock password reset using the emailed reset link.";
  } else if (gen2Context && (programUnassigned || programGuidance || keepstockWeb)) {
    resolution = "Confirmed the account does not appear to have transitioned to Gen 2. Rep was trained on KeepStock Web program management.";
  } else if (programUnassigned || programGuidance || keepstockWeb) {
    resolution = "Rep was trained on KeepStock Web program management and program assignment.";
  } else if (gen2Context && workstationCheck) {
    resolution = "Rep was advised the account does not appear to have transitioned to Gen 2.";
  }

  const issueSummary = recorderIssueSummary(meaningful);
  const issue = value("newSubcategory") || issueSummary || "";
  return { cleaned, lines, issue, issueSummary, steps, resolution };
}
function normalizeRecorderRoute(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}
function recorderDetailedTemplateKind(category = value("newCategory"), subcategory = value("newSubcategory")) {
  const cat = normalizeRecorderRoute(category);
  const sub = normalizeRecorderRoute(subcategory);
  if (cat === "keepstock - onsite" || cat === "keepstock canada - onsite") return "onsite";
  if (cat === "keepstock - seaga / cm" || [
    "keepstock - cm - ams toolbox", "keepstock - cm - locker", "keepstock - cm - carousel",
    "keepstock - seaga - coil", "keepstock - seaga - locker"
  ].includes(cat)) return "machine";
  if (cat === "keepstock - cm - pc/data" && sub === "network issue - cellular") return "cellular";
  if (cat === "keepstock - cm - pc/data" && ["hardware issue - existing badge reader", "hardware issue - new badge reader"].includes(sub)) return "badge";
  return "standard";
}
function recorderIdentityTemplate() {
  return `Template Header (DO NOT REMOVE)
**Delete any unused sections below**
${RECORDER_TEMPLATE_DIVIDER}
Slack Thread URL:

Parent/PRB Template: [Update/add to section below with all required data from Parents/PRB's]

Crib/Program id: ${value("cribProgramId")}
Program name: ${value("programName")}
Company name: ${value("companyName")}
Site ID (If Applicable): ${value("siteId")}
Acct #: ${value("accountNumber")}`;
}
function recorderMachineTemplate() {
  return `${recorderIdentityTemplate()}


Software Version: ${value("softwareVersion")}
Device ID (Affected): ${value("deviceId")}
Machine Serial Number(s): ${value("machineSerial")}`;
}
function buildRecorderDetailedDescription() {
  const kind = recorderDetailedTemplateKind();
  if (kind === "onsite") return recorderIdentityTemplate();
  if (kind === "machine") return recorderMachineTemplate();
  if (kind === "cellular") {
    return `${recorderMachineTemplate()}

Cradlepoint Serial Number: ${value("cradlepointSerial")}
IMEI: ${value("imei")}
Carrier: ${value("carrier")}`;
  }
  if (kind === "badge") {
    return `${recorderMachineTemplate()}


Badge Reader: ${value("badgeReader")}
Model: ${value("model")}`;
  }
  return `${recorderMachineTemplate()}

Cradlepoint Serial Number: ${value("cradlepointSerial")}
IMEI: ${value("imei")}
Carrier: ${value("carrier")}

Badge Reader: ${value("badgeReader")}
Model: ${value("model")}

Phone Model: ${value("phoneModel")}
Phone Software Version: ${value("phoneSoftwareVersion")}
Application: ${value("application")}
Application Version: ${value("applicationVersion")}
Time issue occurred: ${value("timeIssueOccurred")}

Order #: ${value("orderNumber")}
eConnections Status: ${value("econnectionsStatus")}
SAP Status/EBU Number: ${value("sapStatusEbu")}
Does user want order reposted: ${value("orderReposted")}`;
}
function applyRecorderRoutingTemplate() {
  const el = $("detailedDescription");
  if (!el) return;
  el.value = buildRecorderDetailedDescription();
  updateRecorderCounter("detailedDescription", "detailedCounter");
}
function buildRecorderWorkNotes(sections = recorderSections()) {
  const steps = sections.steps.map((line) => `- ${sentence(line)}`).join("\n");
  const escalation = /escalat|t2|tier 2/i.test(sections.cleaned) ? "Escalated for additional investigation." : "";
  return `Issue:\n${value("newSubcategory") || sentence(sections.issue)}\n\nTroubleshooting Steps:\n${steps}\n\nResolution:\n${sentence(sections.resolution)}\n\nReason for Escalation:\n${escalation}`;
}
function buildRecorderShortDescription(sections = recorderSections()) {
  const account = value("accountNumber");
  let issue = normalizeRecorderTerms(sections.issueSummary || "")
    .replace(/^(?:issue|problem|reason for (?:the )?call)\s*[:\-]\s*/i, "")
    .replace(/^(?:caller|customer|user|rep)\s+(?:wanted to|needs? to|is trying to|reported that|reported)\s+/i, "")
    .replace(/^(?:caller|customer|rep)\s+/i, "")
    .replace(/^user\s+(?!group\b)/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!issue) issue = "Issue not identified from rough notes";
  issue = issue.replace(/[.!?]+$/, "");
  if (issue) issue = issue[0].toUpperCase() + issue.slice(1);
  return `Acct #: ${account} | issue - ${issue}`.slice(0, 180);
}
function refreshRecorderDescriptions({ cleanNotes=false }={}) {
  if (cleanNotes) $("newRawNotes").value=cleanNotesText($("newRawNotes").value);
  extractRecorderDetails(false);
  const sections=recorderSections();
  const generatedTitle=buildRecorderShortDescription(sections);
  const titleEl=$("newTitle");
  const currentTitle=value("newTitle");
  const looksAutoGenerated = !currentTitle || titleEl?.dataset?.autoGenerated === "true" || /^Acct #:\s*.*\| issue - /i.test(currentTitle);
  if (looksAutoGenerated && titleEl) {
    titleEl.value=generatedTitle;
    titleEl.dataset.autoGenerated="true";
  }
  $("detailedDescription").value=buildRecorderDetailedDescription(sections);
  $("workNotes").value=buildRecorderWorkNotes(sections);
  updateRecorderCounters();
  return sections;
}
function workersAiEndpoint() {
  const tokenEndpoint=deepgramEndpoint();
  if(!tokenEndpoint)return "";
  try{
    const url=new URL(tokenEndpoint);
    url.pathname="/analyze";url.search="";url.hash="";
    return url.toString();
  }catch(error){return "";}
}

function recorderCompletedRequestResolution(analysis, fallbackSections, documentedSteps = []) {
  const notes=value("newRawNotes");
  const combined=[
    value("newCategory"), value("newSubcategory"),
    analysis?.issue_summary, fallbackSections?.issueSummary,
    notes, ...documentedSteps
  ].filter(Boolean).join(" ");

  const partsContext=/\b(?:parts? assistance|parts? request|mrf|tray harness|part number|replacement part)\b/i.test(combined);
  if(!partsContext)return "";

  const linkCompleted=/\b(?:sent|shared|provided|emailed|messaged)\b[^.\n]{0,100}\b(?:link|form|request)\b/i.test(combined)
    || /\b(?:link|form)\b[^.\n]{0,100}\b(?:sent|shared|provided)\b/i.test(combined);

  const partMatch=notes.match(/\bpart\s*(?:number|#|no\.?)[\s:,-]*(?:for\s+(?:the\s+)?)?([A-Za-z][A-Za-z0-9 /_-]{1,60}?)\s+(?:is|was)\s+([A-Z0-9-]{3,})\b/i);
  let partName=partMatch?String(partMatch[1]||"").trim().replace(/\s+/g," "):"";
  let partNumber=partMatch?String(partMatch[2]||"").trim():"";
  if(!partNumber){
    const stepWithPart=documentedSteps.find((step)=>/\bpart\s*(?:number|#|no\.?)\b/i.test(step));
    const numberMatch=String(stepWithPart||"").match(/\b([A-Z]{1,6}[A-Z0-9-]*\d[A-Z0-9-]*)\b/i);
    if(numberMatch)partNumber=numberMatch[1];
  }
  if(!linkCompleted&&!partNumber)return "";

  const viaTeams=/\bteams\b/i.test(combined);
  const pieces=[];
  if(linkCompleted)pieces.push(`Provided the parts-request link${viaTeams?" via Teams":""}`);
  if(partNumber){
    partName=partName.replace(/^(?:a|an|the)\s+/i,"").trim();
    pieces.push(`supplied ${partName?`${partName} `:""}part number ${partNumber}`);
  }
  return sentence(pieces.join(" and "));
}

function normalizeWorkersAiAnalysis(analysis, fallbackSections) {
  const cleanStep=(text)=>sentence(normalizeRecorderTerms(String(text||"").replace(/^[-*\s]+/,"").trim()));
  const steps=Array.isArray(analysis?.troubleshooting_steps)
    ? analysis.troubleshooting_steps.map(cleanStep).filter(Boolean)
    : [];
  const conditional=Array.isArray(analysis?.conditional_next_steps)
    ? analysis.conditional_next_steps.map(cleanStep).filter(Boolean)
    : [];
  const documented=[...steps];
  conditional.forEach((step)=>{
    const text=/^conditional/i.test(step)?step:`Conditional next step: ${step}`;
    if(!documented.some((existing)=>existing.toLowerCase()===text.toLowerCase()))documented.push(text);
  });
  const aiAccount=String(analysis?.account_number||"").replace(/\D/g, "");
  if (!value("accountNumber") && /^\d{4,}$/.test(aiAccount)) $("accountNumber").value=aiAccount;
  const aiResolution=sentence(normalizeRecorderTerms(String(analysis?.resolution||"").trim()));
  const completedRequestResolution=!aiResolution
    ? recorderCompletedRequestResolution(analysis,fallbackSections,documented)
    : "";
  const finalResolution=aiResolution||completedRequestResolution||sentence(normalizeRecorderTerms(String(fallbackSections?.resolution||"").trim()));
  return {
    ...fallbackSections,
    issue:normalizeRecorderTerms(String(analysis?.issue_summary||fallbackSections.issue||"").trim()),
    issueSummary:normalizeRecorderTerms(String(analysis?.issue_summary||fallbackSections.issueSummary||"").trim()),
    steps:documented.length?documented:fallbackSections.steps,
    resolution:finalResolution,
    aiGenerated:true,
    aiResolved:Boolean(analysis?.resolved||completedRequestResolution)
  };
}
async function analyzeRecorderWithWorkersAi() {
  const endpoint=workersAiEndpoint();
  if(!endpoint)throw new Error("Cloudflare Worker endpoint is not configured");
  const rawNotes=value("newRawNotes").trim();
  if(!rawNotes)throw new Error("Add rough notes before generating the ticket");
  const response=await fetch(endpoint,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      rough_notes:rawNotes,
      category:value("newCategory"),
      subcategory:value("newSubcategory")
    })
  });
  let payload={};
  try{payload=await response.json();}catch(error){}
  if(!response.ok)throw new Error(payload?.error||`Workers AI analysis failed (${response.status})`);
  if(!payload?.analysis)throw new Error("Workers AI returned no ticket analysis");
  return payload.analysis;
}
function applyRecorderSectionsToTicket(sections, sourceLabel="Local parser") {
  const generatedTitle=buildRecorderShortDescription(sections);
  const titleEl=$("newTitle");
  const currentTitle=value("newTitle");
  const looksAutoGenerated=!currentTitle||titleEl?.dataset?.autoGenerated==="true"||/^Acct #:\s*.*\| issue - /i.test(currentTitle);
  if(looksAutoGenerated&&titleEl){titleEl.value=generatedTitle;titleEl.dataset.autoGenerated="true";}
  $("detailedDescription").value=buildRecorderDetailedDescription(sections);
  $("workNotes").value=buildRecorderWorkNotes(sections);
  const ticket=`Short Description:\n${value("newTitle",generatedTitle)}\n\nDetailed Description:\n${value("detailedDescription")}\n\nWork Notes:\n${value("workNotes")}`;
  $("generatedTicket").value=ticket;
  $("recorderTimeSaved").textContent=`Generated ${new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})} · ${sourceLabel}`;
  updateRecorderCounters();
  setRecorderSaveStatus("Generated");
}
async function generateTicketFromForm() {
  const button=$("generateTicketBtn");
  const originalText=button?.innerHTML;
  if(button){button.disabled=true;button.textContent="Analyzing call…";}
  extractRecorderDetails(false);
  const fallbackSections=recorderSections();
  try{
    const analysis=await analyzeRecorderWithWorkersAi();
    const sections=normalizeWorkersAiAnalysis(analysis,fallbackSections);
    applyRecorderSectionsToTicket(sections,"Cloudflare AI");
    showToast("Ticket generated with Cloudflare Workers AI.");
    return sections;
  }catch(error){
    console.warn("Workers AI ticket analysis failed; using local action ledger",error);
    applyRecorderSectionsToTicket(fallbackSections,"Local fallback");
    const message=String(error?.message||"");
    showToast(message?`Cloudflare AI unavailable; local fallback used. ${message}`:"Cloudflare AI unavailable; local fallback used.");
    return fallbackSections;
  }finally{
    if(button){button.disabled=false;if(originalText)button.innerHTML=originalText;refreshIcons();}
  }
}


function updateRecorderCounter(id,counterId) {
  const max=$(id).maxLength > 0 ? $(id).maxLength : 4000;
  $(counterId).textContent=`${Math.max(0,max-$(id).value.length)} characters remaining`;
}
function updateRecorderCounters(){ updateRecorderCounter("detailedDescription","detailedCounter"); updateRecorderCounter("workNotes","workCounter"); }

function getRecorderFormData() {
  const data={};
  RECORDER_FORM_IDS.forEach((id)=>{ const el=$(id); if(el) data[id]=el.value; });
  data.rawNotes=data.newRawNotes || "";
  data.shortDescription=data.newTitle || "";
  data.category=data.newCategory || "";
  data.subcategory=data.newSubcategory || "";
  data.state=data.recorderState || "New";
  data.assignedTo=data.newAssignedTo || "";
  data.location=data.newLocation || "";
  data.ticketOutput=data.generatedTicket || "";
  return data;
}

function setRecorderFormData(data={}) {
  const category=data.newCategory || data.category;
  populateRecorderCategories(category);
  if (data.newSubcategory || data.subcategory) populateRecorderSubcategories(data.newSubcategory || data.subcategory);
  RECORDER_FORM_IDS.forEach((id)=>{ const el=$(id); if(!el || id==="newCategory" || id==="newSubcategory" || el.disabled) return; if(data[id]!==undefined) el.value=data[id] || ""; });
  if (data.rawNotes!==undefined) $("newRawNotes").value=data.rawNotes || "";
  if (data.shortDescription!==undefined) $("newTitle").value=data.shortDescription || "";
  if (data.location!==undefined) $("newLocation").value=data.location || "";
  if (data.ticketOutput!==undefined) $("generatedTicket").value=data.ticketOutput || "";
  renderRecorderDetectedSummary(); updateRecorderCounters(); refreshIcons();
}

function getRecorderDrafts(){ try{return JSON.parse(localStorage.getItem(RECORDER_DRAFT_STORAGE_KEY))||[];}catch(e){return [];} }
function saveRecorderDraft(){
  const data=getRecorderFormData();
  const draft={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now())),createdAt:new Date().toISOString(),data};
  localStorage.setItem(RECORDER_DRAFT_STORAGE_KEY,JSON.stringify([draft,...getRecorderDrafts()].slice(0,20)));
  saveRecorderSettings(); renderRecorderDrafts(); setRecorderSaveStatus("Saved"); showToast("Draft saved in this browser.");
}
function renderRecorderDrafts(){
  const drafts=getRecorderDrafts(); const el=$("recorderDraftList"); if(!el)return;
  if(!drafts.length){el.textContent="No saved drafts yet.";return;}
  el.innerHTML=drafts.map((draft)=>{const d=draft.data||{}; const title=d.shortDescription||d.newTitle||d.programName||d.category||"Untitled incident"; const preview=(d.rawNotes||d.workNotes||"No notes saved.").slice(0,120); return `<article class="recorder-draft-card"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(new Date(draft.createdAt).toLocaleString())} · ${escapeHtml(d.state||"New")} · ${escapeHtml(d.priority||"No priority")}</p><p>${escapeHtml(preview)}${preview.length>=120?"...":""}</p></div><div class="recorder-draft-actions"><button type="button" data-recorder-draft-action="load" data-id="${escapeHtml(draft.id)}">Load</button><button class="danger-text" type="button" data-recorder-draft-action="delete" data-id="${escapeHtml(draft.id)}">Delete</button></div></article>`;}).join("");
}
function handleRecorderDraftAction(action,id){
  const drafts=getRecorderDrafts(); const draft=drafts.find((d)=>d.id===id);
  if(action==="load"&&draft){setRecorderFormData(draft.data);setRecorderSaveStatus("Loaded");showToast("Draft loaded.");}
  if(action==="delete"){localStorage.setItem(RECORDER_DRAFT_STORAGE_KEY,JSON.stringify(drafts.filter((d)=>d.id!==id)));renderRecorderDrafts();showToast("Draft deleted.");}
}
function deleteRecorderDrafts(){ if(!getRecorderDrafts().length)return; if(!confirm("Delete all saved IncidentRecorder drafts from this browser?"))return; localStorage.removeItem(RECORDER_DRAFT_STORAGE_KEY);renderRecorderDrafts();setRecorderSaveStatus("Drafts deleted"); }
function setRecorderSaveStatus(text){ const el=$("recorderSaveStatus"); if(el)el.textContent=text; }

function nextIncidentId() {
  const nums = appState.incidents.map((incident) => Number(String(incident.id).match(/(\d+)$/)?.[1] || 0));
  return `INC-${String(Math.max(6, ...nums) + 1).padStart(3, "0")}`;
}
function recorderSeverity(){ return "medium"; }
function recorderStatus(forcedState=""){ const state=String(forcedState||"New").toLowerCase(); if(state.includes("resolved")||state.includes("closed"))return "resolved"; if(state.includes("hold"))return "pending"; return "investigating"; }

async function saveNewIncident(event, forcedState) {
  if(event?.preventDefault) event.preventDefault();
  if(!value("newTitle") || !value("detailedDescription") || !value("workNotes")) await generateTicketFromForm();
  const title=value("newTitle");
  if(!title){showToast("Add rough notes or a short description before saving.");$("newTitle").focus();return;}
  if(!value("newSubcategory")){showToast("Choose a subcategory before saving the incident.");$("newSubcategory").focus();return;}
  if(!value("generatedTicket")) await generateTicketFromForm();
  const incident={
    id:nextIncidentId(), title, severity:recorderSeverity(), date:new Date().toISOString().slice(0,10), status:recorderStatus(forcedState),
    assignedTo:appState.settings?.name || "Clowie Moscare", category:value("newCategory","Technical / Other"), location:value("newLocation","Not provided"),
    notes:value("generatedTicket")||value("detailedDescription")||value("newRawNotes"), account:value("accountNumber"), device:value("deviceId"), subcategory:value("newSubcategory"), priority:value("priority"), rawNotes:value("newRawNotes"), detailedDescription:value("detailedDescription"), workNotes:value("workNotes")
  };
  appState.incidents.unshift(incident); saveAppState(); saveRecorderSettings(); renderIncidents(); updateMetrics(); stopRecorderVoiceNotes(); $("newIncidentDialog").close(); navigate("incidents"); showToast(`${incident.id} saved to the dashboard.`);
}

function resetRecorder(){
  if(!confirm("Reset all New Incident fields, rough notes, and generated ticket?"))return;
  stopRecorderVoiceNotes(); $("newIncidentForm").reset(); $("generatedTicket").value=""; applyRecorderDefaults(); setRecorderSaveStatus("Not saved"); showToast("New Incident workspace reset.");
}

function appendRecorderNote(text){ const current=value("newRawNotes"); $("newRawNotes").value=current?`${current}\n${text}`:text; setRecorderSaveStatus("Unsaved changes"); }
function isLocalFilePage(){ return window.location.protocol==="file:"; }

function deepgramRecorder() { return window.IncidentRecorderDeepgram || null; }
function deepgramEndpoint() { return String(appState.settings?.deepgramTokenEndpoint || "").trim(); }
function isDeepgramConfigured() {
  const dg=deepgramRecorder();
  if(!dg || !deepgramEndpoint())return false;
  return Boolean(dg.setTokenEndpoint(deepgramEndpoint()));
}
function updateVoiceProviderUi(){
  const badge=$("voiceProviderBadge"),hint=$("deepgramRecorderHint");
  if(isDeepgramConfigured()){
    if(badge)badge.textContent="Deepgram Nova-3";
    if(hint)hint.textContent="Secure Deepgram transcription is configured. Your permanent API key stays in the token Worker, not in this page.";
  }else{
    if(badge)badge.textContent="Browser fallback";
    if(hint)hint.textContent="Configure the secure Deepgram token endpoint in Settings. Until then, voice notes use the browser speech recognizer.";
  }
}
function clearRecorderVoiceRestartTimer(){
  if(recorderVoiceRestartTimer){clearTimeout(recorderVoiceRestartTimer);recorderVoiceRestartTimer=null;}
}
function updateRecorderVoiceControls(mode){
  const start=$("startVoiceBtn"),pause=$("pauseVoiceBtn"),stop=$("stopVoiceBtn"),dot=$("voiceDot");
  if(!start||!pause||!stop||!dot)return;
  if(mode==="listening"||mode==="reconnecting"){
    start.disabled=true;pause.disabled=false;stop.disabled=false;dot.classList.add("ready","listening");
  }else if(mode==="paused"){
    start.disabled=false;pause.disabled=true;stop.disabled=false;dot.classList.add("ready");dot.classList.remove("listening");
  }else{
    start.disabled=isLocalFilePage();pause.disabled=true;stop.disabled=true;dot.classList.remove("listening");
  }
}
function applyDeepgramVoiceState(state){
  if(state==="listening"){recorderVoiceListening=true;recorderVoiceStarting=false;updateRecorderVoiceControls("listening");}
  else if(state==="reconnecting"){recorderVoiceListening=false;recorderVoiceStarting=true;updateRecorderVoiceControls("reconnecting");}
  else if(state==="paused"){recorderVoiceListening=false;recorderVoiceStarting=false;updateRecorderVoiceControls("paused");}
  else if(state==="stopped"||state==="error"){recorderVoiceListening=false;recorderVoiceStarting=false;updateRecorderVoiceControls("stopped");}
}
function recorderDeepgramCallbacks(){
  return {
    onFinal:(text)=>{if(text)appendRecorderNote(text);recorderVoicePendingInterim="";if($("interimTranscript"))$("interimTranscript").textContent="Listening for the next part of the call…";},
    onInterim:(text)=>{recorderVoicePendingInterim=String(text||"").trim();if($("interimTranscript"))$("interimTranscript").textContent=recorderVoicePendingInterim||"Listening for the next part of the call…";},
    onStatus:(text)=>{if($("voiceStatus"))$("voiceStatus").textContent=text;},
    onState:applyDeepgramVoiceState,
    onError:(error)=>{console.warn("Deepgram voice transcription error",error);if($("voiceStatus"))$("voiceStatus").textContent=`Deepgram interrupted (${error?.message||"connection error"}). Reconnecting automatically until you click Stop.`;}
  };
}
function scheduleRecorderVoiceRestart(reason="session ended"){
  if(!recorderShouldRestartVoice||recorderVoicePaused||recorderVoiceFatalError||!recorderRecognition)return;
  clearRecorderVoiceRestartTimer();
  const delay=Math.min(250+(recorderVoiceRestartAttempts*250),1500);
  updateRecorderVoiceControls("reconnecting");
  if($("voiceStatus"))$("voiceStatus").textContent=`Browser voice recognition reconnecting (${reason}). Only Stop ends voice notes.`;
  recorderVoiceRestartTimer=setTimeout(()=>{
    recorderVoiceRestartTimer=null;
    if(!recorderShouldRestartVoice||recorderVoicePaused||recorderVoiceFatalError||recorderVoiceListening||recorderVoiceStarting)return;
    try{
      recorderVoiceStarting=true;
      recorderVoiceRestartAttempts+=1;
      recorderRecognition.start();
    }catch(error){
      recorderVoiceStarting=false;
      scheduleRecorderVoiceRestart("retrying microphone");
    }
  },delay);
}
function setupRecorderVoiceNotes(){
  clearRecorderVoiceRestartTimer();
  recorderRecognition=null;recorderShouldRestartVoice=false;recorderVoiceListening=false;recorderVoiceStarting=false;recorderVoicePaused=false;recorderVoiceFatalError=false;recorderVoiceRestartAttempts=0;recorderVoicePendingInterim="";
  const dot=$("voiceDot"),start=$("startVoiceBtn"),pause=$("pauseVoiceBtn"),stop=$("stopVoiceBtn");
  if(!dot||!start||!pause||!stop)return;
  dot.classList.remove("ready","listening");pause.disabled=true;stop.disabled=true;
  updateVoiceProviderUi();
  if(isLocalFilePage()){$("voiceStatus").textContent="Voice notes need HTTPS or localhost. Upload to GitHub Pages to use the microphone.";start.disabled=true;return;}
  if(isDeepgramConfigured()){
    dot.classList.add("ready");start.disabled=false;$("voiceStatus").textContent="Deepgram Nova-3 is ready. Click Start voice notes; it will reconnect automatically until you click Stop.";return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){$("voiceStatus").textContent="Deepgram is not configured and browser voice notes are unavailable. Configure Deepgram in Settings.";start.disabled=true;return;}
  dot.classList.add("ready");start.disabled=false;$("voiceStatus").textContent="Deepgram is not configured. Browser voice fallback is ready and reconnects until you click Stop.";
}
function initRecorderBrowserVoiceNotes(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR||isLocalFilePage())return false;if(recorderRecognition)return true;
  recorderRecognition=new SR();recorderRecognition.continuous=true;recorderRecognition.interimResults=true;recorderRecognition.maxAlternatives=1;recorderRecognition.lang="en-US";
  recorderRecognition.onstart=()=>{
    recorderVoiceStarting=false;recorderVoiceListening=true;recorderVoiceRestartAttempts=0;updateRecorderVoiceControls("listening");
    $("voiceStatus").textContent="Listening with the browser fallback. It will reconnect automatically until you click Stop.";
  };
  recorderRecognition.onresult=(event)=>{
    let interim="",finalText="";
    for(let i=event.resultIndex;i<event.results.length;i++){
      const t=event.results[i][0].transcript.trim();
      if(event.results[i].isFinal)finalText+=`${t}\n`;else interim+=`${t} `;
    }
    if(finalText.trim()){appendRecorderNote(finalText.trim());recorderVoicePendingInterim="";}
    recorderVoicePendingInterim=interim.trim();
    $("interimTranscript").textContent=recorderVoicePendingInterim||"Listening for the next part of the call…";
  };
  recorderRecognition.onerror=(event)=>{
    recorderVoiceStarting=false;
    const fatal=["not-allowed","service-not-allowed","audio-capture"].includes(event.error);
    if(fatal){recorderVoiceFatalError=true;recorderShouldRestartVoice=false;clearRecorderVoiceRestartTimer();updateRecorderVoiceControls("stopped");$("voiceStatus").textContent="Microphone access was blocked or unavailable. Allow microphone access, then click Start voice notes again.";return;}
    if(recorderShouldRestartVoice&&!recorderVoicePaused){updateRecorderVoiceControls("reconnecting");$("voiceStatus").textContent=`Browser voice recognition paused briefly (${event.error}). Reconnecting automatically…`;}
  };
  recorderRecognition.onend=()=>{
    recorderVoiceStarting=false;recorderVoiceListening=false;$("voiceDot").classList.remove("listening");
    if(recorderVoicePendingInterim){appendRecorderNote(recorderVoicePendingInterim);recorderVoicePendingInterim="";}
    $("interimTranscript").textContent="Interim transcript will appear here while listening.";
    if(recorderShouldRestartVoice&&!recorderVoicePaused&&!recorderVoiceFatalError)scheduleRecorderVoiceRestart("browser session ended");
    else if(recorderVoicePaused){updateRecorderVoiceControls("paused");$("voiceStatus").textContent="Voice notes paused. Click Start voice notes to resume, or Stop to end the session.";}
    else if(!recorderVoiceFatalError){updateRecorderVoiceControls("stopped");$("voiceStatus").textContent="Voice notes stopped.";}
  };
  return true;
}
async function startRecorderVoiceNotes(){
  if(isLocalFilePage()){setupRecorderVoiceNotes();showToast("Voice notes need HTTPS or localhost. They will work on GitHub Pages.");return;}
  recorderVoiceFatalError=false;recorderVoicePaused=false;recorderShouldRestartVoice=true;clearRecorderVoiceRestartTimer();
  if(isDeepgramConfigured()){
    if(recorderVoiceListening||recorderVoiceStarting)return;
    recorderVoiceStarting=true;updateRecorderVoiceControls("reconnecting");$("voiceStatus").textContent="Starting Deepgram Nova-3…";
    try{
      await deepgramRecorder().start(recorderDeepgramCallbacks());
      return;
    }catch(error){
      recorderVoiceStarting=false;console.warn("Could not start Deepgram; trying browser fallback",error);showToast("Deepgram could not start, so browser voice fallback is being used.");
    }
  }
  if(!initRecorderBrowserVoiceNotes()){setupRecorderVoiceNotes();return;}
  if(recorderVoiceListening||recorderVoiceStarting)return;
  try{recorderVoiceStarting=true;updateRecorderVoiceControls("reconnecting");$("voiceStatus").textContent="Starting browser voice fallback…";recorderRecognition.start();}
  catch(error){recorderVoiceStarting=false;scheduleRecorderVoiceRestart("starting microphone");}
}
async function pauseRecorderVoiceNotes(){
  recorderVoicePaused=true;recorderShouldRestartVoice=false;clearRecorderVoiceRestartTimer();
  if(deepgramRecorder()?.isActive?.()){
    await deepgramRecorder().pause();recorderVoicePendingInterim="";return;
  }
  if(recorderVoicePendingInterim){appendRecorderNote(recorderVoicePendingInterim);recorderVoicePendingInterim="";}
  if(recorderRecognition&&(recorderVoiceListening||recorderVoiceStarting)){try{recorderRecognition.stop();}catch(error){}}
  recorderVoiceListening=false;recorderVoiceStarting=false;updateRecorderVoiceControls("paused");$("voiceStatus").textContent="Voice notes paused. Click Start voice notes to resume, or Stop to end the session.";
}
async function stopRecorderVoiceNotes(){
  recorderShouldRestartVoice=false;recorderVoicePaused=false;recorderVoiceFatalError=false;clearRecorderVoiceRestartTimer();
  if(deepgramRecorder()?.isActive?.())await deepgramRecorder().stop();
  if(recorderVoicePendingInterim&&!isDeepgramConfigured()){appendRecorderNote(recorderVoicePendingInterim);}
  recorderVoicePendingInterim="";
  if(recorderRecognition&&(recorderVoiceListening||recorderVoiceStarting)){try{recorderRecognition.stop();}catch(error){}}
  recorderVoiceListening=false;recorderVoiceStarting=false;recorderVoiceRestartAttempts=0;
  if($("startVoiceBtn"))$("startVoiceBtn").disabled=isLocalFilePage();if($("pauseVoiceBtn"))$("pauseVoiceBtn").disabled=true;if($("stopVoiceBtn"))$("stopVoiceBtn").disabled=true;if($("voiceDot"))$("voiceDot").classList.remove("listening");if($("interimTranscript"))$("interimTranscript").textContent="Interim transcript will appear here while listening.";if($("voiceStatus"))$("voiceStatus").textContent=isLocalFilePage()?"Voice notes need HTTPS or localhost.":"Voice notes stopped.";
}

function syncDeepgramSettingsUi(){
  const endpoint=deepgramEndpoint();
  const input=$("deepgramTokenEndpoint"),status=$("deepgramSettingsStatus");
  if(input && document.activeElement!==input)input.value=endpoint;
  if(deepgramRecorder())deepgramRecorder().setTokenEndpoint(endpoint);
  if(status)status.textContent=endpoint?"Endpoint saved · ready to test":"Not configured";
  updateVoiceProviderUi();
  syncWorkersAiSettingsUi();
}
function saveDeepgramSettings(){
  const input=$("deepgramTokenEndpoint");
  const raw=String(input?.value||"").trim();
  const normalized=raw?deepgramRecorder()?.setTokenEndpoint(raw):"";
  if(raw&&!normalized){showToast("Enter a valid HTTPS Deepgram token endpoint.");if($("deepgramSettingsStatus"))$("deepgramSettingsStatus").textContent="Invalid endpoint";return false;}
  appState.settings={...(appState.settings||{}),deepgramTokenEndpoint:normalized||""};saveAppState();syncDeepgramSettingsUi();showToast(normalized?"Deepgram endpoint saved securely.":"Deepgram endpoint cleared; browser fallback will be used.");return true;
}
async function testDeepgramSettings(){
  const input=$("deepgramTokenEndpoint"),status=$("deepgramSettingsStatus"),btn=$("testDeepgramBtn");
  const raw=String(input?.value||deepgramEndpoint()).trim();
  const normalized=raw?deepgramRecorder()?.setTokenEndpoint(raw):"";
  if(!normalized){if(status)status.textContent="Enter an HTTPS token endpoint first";showToast("Configure the Deepgram token endpoint first.");return;}
  if(btn)btn.disabled=true;if(status)status.textContent="Testing secure token endpoint…";
  try{
    await deepgramRecorder().testTokenEndpoint(normalized);
    appState.settings={...(appState.settings||{}),deepgramTokenEndpoint:normalized};saveAppState();
    if(status)status.textContent="Connected · temporary token received";updateVoiceProviderUi();showToast("Deepgram token endpoint is working.");
  }catch(error){console.warn("Deepgram endpoint test failed",error);if(status)status.textContent=`Connection failed: ${error?.message||"unknown error"}`;showToast("Deepgram connection test failed. Check the Worker URL and secret.");}
  finally{if(btn)btn.disabled=false;}
}

function syncWorkersAiSettingsUi(){
  const status=$("workersAiSettingsStatus");
  if(!status)return;
  status.textContent=workersAiEndpoint()?"Uses the same Cloudflare Worker · ready to test":"Save the Deepgram Worker endpoint first";
}
async function testWorkersAiSettings(){
  const status=$("workersAiSettingsStatus"),btn=$("testWorkersAiBtn"),endpoint=workersAiEndpoint();
  if(!endpoint){if(status)status.textContent="Save the Worker /token endpoint first";showToast("Configure the Cloudflare Worker endpoint first.");return;}
  if(btn)btn.disabled=true;if(status)status.textContent="Testing Cloudflare Workers AI…";
  try{
    const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      rough_notes:"Checked machine power. Reseated the cable. Power cycled the PC. Logged back in and confirmed communication was restored.",
      category:"Keepstock - Onsite",
      subcategory:"Machine communication"
    })});
    let payload={};try{payload=await response.json();}catch(error){}
    if(!response.ok)throw new Error(payload?.error||`Workers AI test failed (${response.status})`);
    if(!payload?.analysis?.troubleshooting_steps)throw new Error("Workers AI returned an incomplete test response");
    if(status)status.textContent=`Connected · ${payload.model||"Workers AI"} ready`;
    showToast("Cloudflare Workers AI ticket analysis is working.");
  }catch(error){
    console.warn("Workers AI settings test failed",error);
    if(status)status.textContent=`Connection failed: ${error?.message||"unknown error"}`;
    showToast("Workers AI test failed. Check the AI binding and updated Worker code.");
  }finally{if(btn)btn.disabled=false;}
}

async function copyText(text, message = "Copied to clipboard.") {
  if (!text) { showToast("There is nothing to copy yet."); return; }
  try { await navigator.clipboard.writeText(text); showToast(message); }
  catch (error) {
    const area = document.createElement("textarea"); area.value = text; document.body.append(area); area.select(); document.execCommand("copy"); area.remove(); showToast(message);
  }
}

function downloadText(text, filename) {
  if (!text) { showToast("There is nothing to download yet."); return; }
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function updateMetrics() {
  const localAdded = Math.max(0, appState.incidents.filter((item) => !seedIncidents.some((seed) => seed.id === item.id)).length);
  const resolvedLocal = appState.incidents.filter((item) => item.status === "resolved" && !seedIncidents.some((seed) => seed.id === item.id)).length;
  const pendingLocal = localAdded - resolvedLocal;
  $("metricTotal").textContent = 200 + localAdded;
  $("metricResolved").textContent = 156 + resolvedLocal;
  $("metricPending").textContent = 44 + pendingLocal;
  const total = 200 + localAdded;
  const resolved = 156 + resolvedLocal;
  $("metricResolvedNote").textContent = `${Math.round((resolved / total) * 100)}% resolution rate`;
  $("metricPendingNote").textContent = `${Math.round(((44 + pendingLocal) / total) * 100)}% pending review`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
}

function canvasContext(id) {
  const canvas = $(id); if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

function drawGrid(ctx, w, h, pad, yTicks = 4) {
  ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  for (let i = 0; i <= yTicks; i++) { const y = pad.top + ((h - pad.top - pad.bottom) * i / yTicks); ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke(); }
  ctx.setLineDash([]);
}

function drawLineChart(id, labels, values, options = {}) {
  const c = canvasContext(id); if (!c) return; const { ctx, w, h } = c;
  const pad = { left: 44, right: 18, top: 18, bottom: 34 }; const max = options.max || Math.ceil(Math.max(...values, 1) / 10) * 10;
  drawGrid(ctx, w, h, pad, 4);
  ctx.font = "11px Inter, system-ui"; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center";
  labels.forEach((label, i) => { const x = pad.left + (w - pad.left - pad.right) * (labels.length === 1 ? .5 : i / (labels.length - 1)); ctx.fillText(label, x, h - 10); });
  ctx.textAlign = "right"; for (let i = 0; i <= 4; i++) { const value = Math.round(max * (4 - i) / 4); const y = pad.top + (h - pad.top - pad.bottom) * i / 4; ctx.fillText(value, pad.left - 8, y + 4); }
  const points = values.map((v, i) => ({ x: pad.left + (w - pad.left - pad.right) * i / Math.max(1, values.length - 1), y: pad.top + (h - pad.top - pad.bottom) * (1 - v / max) }));
  if (options.fill) { const gradient = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom); gradient.addColorStop(0, "rgba(59,130,246,.28)"); gradient.addColorStop(1, "rgba(59,130,246,0)"); ctx.beginPath(); ctx.moveTo(points[0].x, h - pad.bottom); points.forEach((p) => ctx.lineTo(p.x,p.y)); ctx.lineTo(points.at(-1).x, h - pad.bottom); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill(); }
  ctx.strokeStyle = options.color || "#3b82f6"; ctx.lineWidth = 2; ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.stroke();
  points.forEach((p)=>{ ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fillStyle="#3b82f6"; ctx.fill(); ctx.beginPath(); ctx.arc(p.x,p.y,1.5,0,Math.PI*2); ctx.fillStyle="#dbeafe"; ctx.fill(); });
}

function drawBarChart(id, labels, values, colors, horizontal = false) {
  const c = canvasContext(id); if (!c) return; const { ctx, w, h } = c;
  const pad = horizontal ? { left: 112, right: 20, top: 16, bottom: 26 } : { left: 44, right: 18, top: 18, bottom: 36 };
  const max = Math.ceil(Math.max(...values, 1) / 20) * 20;
  drawGrid(ctx,w,h,pad,4); ctx.font="11px Inter, system-ui"; ctx.fillStyle="#94a3b8";
  if (horizontal) {
    const rowH = (h-pad.top-pad.bottom)/labels.length;
    labels.forEach((label,i)=>{ const y=pad.top+rowH*i+rowH*.2; const barH=rowH*.55; ctx.textAlign="right"; ctx.fillText(label,pad.left-8,y+barH*.65); ctx.fillStyle=colors?.[i]||"#3b82f6"; roundRect(ctx,pad.left,y,(w-pad.left-pad.right)*(values[i]/max),barH,5); ctx.fill(); ctx.fillStyle="#94a3b8"; });
  } else {
    const slot=(w-pad.left-pad.right)/labels.length; const barW=Math.min(90,slot*.45);
    labels.forEach((label,i)=>{ const barH=(h-pad.top-pad.bottom)*(values[i]/max); const x=pad.left+slot*i+(slot-barW)/2; const y=h-pad.bottom-barH; ctx.fillStyle=colors?.[i]||"#3b82f6"; roundRect(ctx,x,y,barW,barH,6); ctx.fill(); ctx.fillStyle="#94a3b8"; ctx.textAlign="center"; ctx.fillText(label,pad.left+slot*i+slot/2,h-11); });
  }
}

function roundRect(ctx,x,y,w,h,r) { if(w<=0||h<=0)return; const rr=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,y,w,h,rr) : ctx.rect(x,y,w,h); }

function drawDonutChart(id, data, legendId) {
  const c=canvasContext(id); if(!c)return; const {ctx,w,h}=c; const total=data.reduce((s,d)=>s+d.value,0); const cx=w/2,cy=h/2,r=Math.min(w,h)*.33,inner=r*.58; let start=-Math.PI/2;
  data.forEach((d)=>{ const angle=Math.PI*2*(d.value/total); ctx.beginPath(); ctx.arc(cx,cy,r,start,start+angle); ctx.arc(cx,cy,inner,start+angle,start,true); ctx.closePath(); ctx.fillStyle=d.color; ctx.fill(); start+=angle; });
  ctx.fillStyle="#f8fafc"; ctx.font="600 17px Inter, system-ui"; ctx.textAlign="center"; ctx.fillText(total,cx,cy-1); ctx.fillStyle="#94a3b8"; ctx.font="11px Inter, system-ui"; ctx.fillText("total",cx,cy+16);
  const legend=$(legendId); if(legend) legend.innerHTML=data.map((d)=>`<div class="legend-row"><span class="legend-dot" style="background:${d.color}"></span><span>${escapeHtml(d.name)} · ${Math.round(d.value/total*100)}%</span></div>`).join("");
}

function drawAllCharts() {
  drawLineChart("incidentTrendChart", ["Jan 1","Jan 2","Jan 3","Jan 4","Jan 5","Jan 6","Jan 7"], [12,8,15,10,18,14,11], { max:20 });
  drawDonutChart("severityChart", [{name:"High",value:35,color:"#ef4444"},{name:"Medium",value:45,color:"#f59e0b"},{name:"Low",value:20,color:"#10b981"}], "severityLegend");
  drawBarChart("resolutionChart", ["Resolved","Unresolved"], [156,44], ["#3b82f6","#64748b"]);
  drawLineChart("analyticsTrendChart", analyticsData.months, analyticsData.trend, { max:80, fill:true });
  drawDonutChart("categoryChart", analyticsData.categories, "categoryLegend");
  drawBarChart("resolutionTimeChart", ["< 1 hour","1-4 hours","4-24 hours","> 24 hours"], [45,78,52,25], ["#8b5cf6","#8b5cf6","#8b5cf6","#8b5cf6"]);
  drawBarChart("locationChart", ["Main Entrance","Parking Lot A","Building B","Warehouse","Perimeter"], [42,38,31,27,22], ["#3b82f6","#3b82f6","#3b82f6","#3b82f6","#3b82f6"], true);
}

function wireEvents() {
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]"); if (nav) navigate(nav.dataset.nav);
    const opener = event.target.closest("[data-open-new]"); if (opener) openNewIncident();
    const close = event.target.closest("[data-close-dialog]"); if (close) $(close.dataset.closeDialog).close();
    const incidentBtn = event.target.closest("[data-view-incident]"); if (incidentBtn) openIncidentDetails(incidentBtn.dataset.viewIncident);
    const videoBtn = event.target.closest("[data-view-video]"); if (videoBtn) openVideo(videoBtn.dataset.viewVideo);
    const statusBtn = event.target.closest("[data-status-change]"); if (statusBtn) changeIncidentStatus(statusBtn.dataset.id, statusBtn.dataset.statusChange);
    const copyIncident = event.target.closest("[data-copy-incident]"); if (copyIncident) { const incident=appState.incidents.find((i)=>i.id===copyIncident.dataset.copyIncident); copyText(incident?.notes,"Incident notes copied."); }
  });

  $("sidebarToggle").addEventListener("click", () => { $("sidebar").classList.toggle("collapsed"); setTimeout(drawAllCharts,260); });
  $("mobileMenuBtn").addEventListener("click", openMobileMenu); $("mobileOverlay").addEventListener("click", closeMobileMenu);
  ["severityFilter","statusFilter"].forEach((id)=>$(id).addEventListener("change",renderIncidents)); $("incidentSearch").addEventListener("input",renderIncidents);

  const zone=$("dropZone"), input=$("videoFileInput");
  zone.addEventListener("click", (e)=>{ if(!e.target.closest("button")) input.click(); });
  zone.addEventListener("keydown", (e)=>{ if(e.key==="Enter"||e.key===" "){e.preventDefault();input.click();} });
  $("selectFilesBtn").addEventListener("click", (e)=>{ e.stopPropagation(); input.click(); }); input.addEventListener("change",()=>simulateUpload(input.files));
  ["dragenter","dragover"].forEach((name)=>zone.addEventListener(name,(e)=>{e.preventDefault();zone.classList.add("dragging");}));
  ["dragleave","drop"].forEach((name)=>zone.addEventListener(name,(e)=>{e.preventDefault();zone.classList.remove("dragging");})); zone.addEventListener("drop",(e)=>simulateUpload(e.dataTransfer.files));

  $("cleanNotesBtn").addEventListener("click",()=>{ $("newRawNotes").value=cleanNotesText($("newRawNotes").value); setRecorderSaveStatus("Unsaved changes"); showToast("Rough notes cleaned."); });
  $("extractDetailsBtn").addEventListener("click",()=>{ extractRecorderDetails(false); const sections=recorderSections(); $("detailedDescription").value=buildRecorderDetailedDescription(sections); updateRecorderCounters(); showToast("Details extracted. Review anything that looks wrong."); });
  $("generateTicketBtn").addEventListener("click",generateTicketFromForm);
  $("saveRecorderDraftBtn").addEventListener("click",saveRecorderDraft);
  $("submitIncidentBtn").addEventListener("click",()=>saveNewIncident(null,"In Progress"));
  $("resolveIncidentBtn").addEventListener("click",()=>saveNewIncident(null,"Resolved"));
  $("saveIncidentBtn").addEventListener("click",()=>saveNewIncident(null));
  $("resetRecorderBtn").addEventListener("click",resetRecorder);
  $("newIncidentForm").addEventListener("submit",saveNewIncident);

  $("startVoiceBtn").addEventListener("click",startRecorderVoiceNotes);
  $("pauseVoiceBtn").addEventListener("click",pauseRecorderVoiceNotes);
  $("stopVoiceBtn").addEventListener("click",stopRecorderVoiceNotes);

  $("recorderDraftList").addEventListener("click",(event)=>{ const btn=event.target.closest("[data-recorder-draft-action]"); if(!btn)return; handleRecorderDraftAction(btn.dataset.recorderDraftAction,btn.dataset.id); });
  $("deleteRecorderDraftsBtn").addEventListener("click",deleteRecorderDrafts);

  $("newCategory").addEventListener("change",()=>{ populateRecorderSubcategories(); applyRecorderRoutingTemplate(); saveRecorderSettings(); setRecorderSaveStatus("Unsaved changes"); });
  $("newSubcategory").addEventListener("change",()=>{ applyRecorderRoutingTemplate(); saveRecorderSettings(); setRecorderSaveStatus("Unsaved changes"); });
  RECORDER_FORM_IDS.forEach((id)=>{ const el=$(id); if(!el)return; el.addEventListener("input",()=>{ setRecorderSaveStatus("Unsaved changes"); if(RECORDER_DETAIL_FIELDS.some(([fieldId])=>fieldId===id))renderRecorderDetectedSummary(); }); });
  $("detailedDescription").addEventListener("input",()=>updateRecorderCounter("detailedDescription","detailedCounter"));
  $("workNotes").addEventListener("input",()=>updateRecorderCounter("workNotes","workCounter"));

  $("resetDetailedBtn").addEventListener("click",()=>{ $("detailedDescription").value=RECORDER_RESET_DETAIL_TEMPLATE; updateRecorderCounters(); showToast("Original detailed description template restored."); });
  $("resetWorkBtn").addEventListener("click",()=>{ $("workNotes").value=RECORDER_WORK_NOTES_TEMPLATE; updateRecorderCounters(); showToast("Work notes template reset."); });
  $("copyDetailedBtn").addEventListener("click",()=>copyText($("detailedDescription").value,"Detailed description copied."));
  $("copyWorkBtn").addEventListener("click",()=>copyText($("workNotes").value,"Work notes copied."));
  $("copyGeneratedBtn").addEventListener("click",()=>copyText($("generatedTicket").value,"Generated ticket copied."));
  $("copyWorkFromOutputBtn").addEventListener("click",()=>copyText($("workNotes").value,"Work notes copied."));
  $("copyShortFromOutputBtn").addEventListener("click",()=>copyText($("newTitle").value,"Short description copied."));
  $("copyDetailedFromOutputBtn").addEventListener("click",()=>copyText($("detailedDescription").value,"Detailed description copied."));
  $("downloadGeneratedBtn").addEventListener("click",()=>downloadText($("generatedTicket").value,`${(value("newTitle","incident").replace(/[^a-z0-9]+/gi,"-").toLowerCase())}-ticket.txt`));

  $("newIncidentDialog").addEventListener("close",stopRecorderVoiceNotes);
  document.addEventListener("keydown",(event)=>{ if(!$("newIncidentDialog").open || !(event.ctrlKey||event.metaKey))return; if(event.key==="Enter"){event.preventDefault();generateTicketFromForm();} if(event.key.toLowerCase()==="s"){event.preventDefault();saveRecorderDraft();} if(event.shiftKey&&event.key.toLowerCase()==="c"){event.preventDefault();copyText($("generatedTicket").value,"Generated ticket copied.");} });

  $("saveProfileBtn").addEventListener("click",()=>{ appState.settings={...(appState.settings||{}),name:value("profileName"),email:value("profileEmail")}; saveAppState(); showToast("Profile settings saved locally."); });
  $("saveDeepgramBtn").addEventListener("click",saveDeepgramSettings);
  $("testDeepgramBtn").addEventListener("click",testDeepgramSettings);
  $("testWorkersAiBtn").addEventListener("click",testWorkersAiSettings);
  $("updatePasswordBtn").addEventListener("click",()=>showToast("Static demo: password changes require a backend identity provider."));
  $("exportDataBtn").addEventListener("click",()=>downloadText(JSON.stringify(appState,null,2),"incident-recorder-data.json"));

  $$(`dialog`).forEach((dialog)=>dialog.addEventListener("click",(event)=>{ if(event.target===dialog) dialog.close(); }));
  window.addEventListener("resize", debounce(drawAllCharts,120));
}

function debounce(fn, delay) { let timer; return (...args)=>{ clearTimeout(timer); timer=setTimeout(()=>fn(...args),delay); }; }

function initialize() {
  wireEvents(); renderIncidents(); renderVideos(); updateMetrics();
  if (appState.settings?.name) $("profileName").value=appState.settings.name;
  if (appState.settings?.email) $("profileEmail").value=appState.settings.email;
  syncDeepgramSettingsUi();
  refreshIcons(); requestAnimationFrame(drawAllCharts);
}

document.addEventListener("DOMContentLoaded", initialize);
