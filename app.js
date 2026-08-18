const APP_STORAGE_KEY = "incidentRecorderDashboardV1";
const LEGACY_DRAFT_KEYS = ["incidentRecorderDraftsV10UxFlow", "incidentRecorderDraftsV1"];

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

const RECORDER_DRAFT_STORAGE_KEY = "incidentRecorderDraftsV10UxFlow";
const RECORDER_SETTINGS_KEY = "incidentRecorderSettingsV10";
const RECORDER_WORK_NOTES_TEMPLATE = `Issue:\n\n\nTroubleshooting Steps:\n\n\nResolution:\n\n\nReason for Escalation: [Only if escalated to T2]`;
const RECORDER_SNIPPETS = [
  "Confirmed machine is connected to a cradlepoint",
  "Located CP in NetCloud",
  "Confirmed CP is offline",
  "Unplugged power cable",
  "Pressed reset",
  "Confirmed martini glass is solid green",
  "Synced machine",
  "Verified account is active",
  "Cleared app cache",
  "Had user retry"
];
const RECORDER_CATEGORY_MAP = {
  "Keepstock - MobileCast": ["Access/login", "Routing", "other"],
  "Keepstock - GCOM Mobile App": ["access/login", "Barcode label", "Bluetooth Scanner", "Camera Scanner", "Cart", "Ks Items", "other"],
  "Keepstock Canada - Onsite": ["Access/Login", "CS Software", "Email notification", "Item Data", "Item maintenance", "MRF Issue", "MRF required", "order approval", "program maintenance", "other"],
  "Keepstock - CM - AMS toolbox": ["Hardware issue: - Drop sensor", "Hardware issue: - lightning", "Hardware issue: - transformer", "Hardware issue: - Fuses", "Hardware issue: - Internal Keypad", "Hardware issue: - Main board", "Hardware issue: - Main harness", "Hardware issue: - Motors", "Hardware issue: - Power supply", "Hardware issue: - Tray", "Hardware issue: - Tray harness", "Hardware issue: - Machine Replacement Request", "physical damage", "Product sizing", "other"],
  "Keepstock - CM - Locker": ["Hardware issue: - Main board", "Hardware issue: - Motors", "Hardware issue: - Power supply", "Hardware issue: - Machine Replacement Request", "physical damage", "other"],
  "Keepstock - CM - Carousel": ["Hardware issue: - Main board", "Hardware issue: - Motors", "Hardware issue: - Power supply", "Hardware issue: - Machine Replacement Request", "physical damage", "other"],
  "Keepstock - Seaga - Coil": ["Hardware issue: - Main board", "Hardware issue: - Motors", "Hardware issue: - Power supply", "Hardware issue: - Machine Replacement Request", "physical damage", "other"],
  "Keepstock - Seaga - Locker": ["Hardware issue: - Main board", "Hardware issue: - Motors", "Hardware issue: - Power supply", "Hardware issue: - Machine Replacement Request", "physical damage", "other"],
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
  "newRawNotes", "cribProgramId", "programName", "companyName", "siteId", "accountNumber", "softwareVersion", "deviceId", "machineSerial", "cradlepointSerial", "imei", "carrier", "badgeReader", "model", "phoneModel", "phoneSoftwareVersion", "application", "applicationVersion", "timeIssueOccurred", "orderNumber", "econnectionsStatus", "sapStatusEbu", "orderReposted", "newCategory", "newSubcategory", "recorderState", "businessImpact", "userImpact", "urgency", "priority", "assignmentGroup", "newAssignedTo", "service", "serviceOffering", "configurationItem", "channel", "newLocation", "partsRequest", "deviceAsset", "applicationService", "relatedSearch", "knowledgeScope", "watchList", "resolutionCode", "closeNotes", "newTitle", "detailedDescription", "workNotes", "generatedTicket"
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
  renderRecorderSnippets();
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
  select.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  select.value = categories.includes(preferred) ? preferred : categories.includes(settings.category) ? settings.category : "Keepstock - Seaga - PC/Data";
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
  localStorage.setItem(RECORDER_SETTINGS_KEY, JSON.stringify({ category:value("newCategory"), subcategory:value("newSubcategory"), assignmentGroup:value("assignmentGroup"), assignedTo:value("newAssignedTo") }));
}

function applyRecorderDefaults() {
  const settings = getRecorderSettings();
  populateRecorderCategories(settings.category);
  $("recorderState").value = "New";
  $("businessImpact").value = "Minor";
  $("userImpact").value = "Single User: 1 user";
  $("urgency").value = "Low";
  $("assignmentGroup").value = settings.assignmentGroup || "T1 KeepStock";
  $("newAssignedTo").value = settings.assignedTo || appState.settings?.name || "Clowie Moscare";
  $("channel").value = "Phone";
  $("knowledgeScope").value = "Knowledge & Catalog (All)";
  updateRecorderPriority();
  $("detailedDescription").value = buildRecorderDetailedDescription({ issue:"", steps:[], resolution:"" });
  $("workNotes").value = RECORDER_WORK_NOTES_TEMPLATE;
  renderRecorderDetectedSummary();
  updateRecorderCounters();
}

function updateRecorderPriority() {
  const business = value("businessImpact", "Minor");
  const user = value("userImpact", "Single User: 1 user");
  const urgency = value("urgency", "Low");
  let score = 4;
  if (business === "Critical" || urgency === "Critical" || user === "Enterprise-wide") score = 1;
  else if (business === "Major" || urgency === "High" || user === "Site-wide") score = 2;
  else if (business === "Moderate" || urgency === "Medium" || user.includes("Department")) score = 3;
  $("priority").value = `${score} - ${["Critical","High","Moderate","Low"][score-1]}`;
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

  if (/teams/.test(lower) && /(?:job|document|message|sent)/.test(lower)) return "Sent the KeepStock password-reset job aid via Teams.";
  if (/clearspider/.test(lower) && /email/.test(lower) && /(?:submit|request|input|enter)/.test(lower)) return "Directed the caller to submit a ClearSpider password-reset request using the customer's email.";
  if (/receive an email|reset (?:his|her|their|the) password|reset password/.test(lower) && /email|link/.test(lower)) return "Advised that the customer will receive a reset email and must complete the reset link and remaining instructions.";
  if (/step\s*(?:1|one).*step\s*(?:7|seven)|follow step/.test(lower)) return "Advised the customer to follow the password-reset instructions through the final step.";
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
function recorderSections(raw = value("newRawNotes")) {
  const cleaned = cleanNotesText(raw);
  const lines = cleaned.split(/\n+/).map(normalizeRecorderTerms).filter(Boolean);
  const metadata = /^(?:acct|account\s*(?:#|number)\s*[:=#-]|device\s*id|machine\s*serial|serial|crib|program\s*(?:id|name)\s*[:=-]|company\s*name\s*[:=-]|customer\s*name\s*[:=-]|site\s*id|software\s*version|sw\s*version|application\s*version|app\s*version|imei|carrier\s*[:=-]|badge\s*reader|model\s*[:=-]|phone\s*model|time\s*issue|order\s*(?:#|number)|econnections?\s*status|sap\s*status|ebu\s*(?:number|#)|does\s+user\s+want\s+order\s+reposted)/i;
  const resolutionRe = /(resolved|fixed|restored|working now|sync successful|synced successfully|successful|completed|issue cleared|no longer|customer confirmed|user confirmed)/i;
  const actionRe = /\b(confirmed|verified|checked|located|looked|pulled up|unplugged|plugged|pressed|restarted|rebooted|reset|synced|cleared|tested|opened|closed|sent|forwarded|advised|explained|asked|reviewed|contacted|power cycled|had user|investigated|escalated|click|clicked|submit|requested|receive an email|follow step|follow|right account|assigned|assign|select all|save|log into|log in|login|go to|open|create user|user and group management|account information|change|remove|add it back|dispens|conflict|per week|start over|pack of)\b/i;

  const narrative = lines.filter((line) => !metadata.test(line));
  const meaningful = narrative.filter((line) => !isRecorderChatter(line));
  const combined = meaningful.join(" ");
  const explicitResolution = [...meaningful].reverse().find((line) => resolutionRe.test(line));

  const gen2Context = meaningful.some((line) => /transition(?:ed|ing)?.*gen\s*2|gen\s*2.*transition/i.test(line));
  const workstationCheck = meaningful.some((line) => /(?:don't|do not|didn't|did not).*see.*workstation|workstation.*(?:don't|do not|didn't|did not).*see/i.test(line));
  const programUnassigned = meaningful.some((line) => /not assigned.*(?:program|vending)|(?:program|vending).*not assigned/i.test(line));
  const programGuidance = meaningful.some((line) => /grainger\.com.*keepstock.*account information|account information.*select all.*save/i.test(line));
  const keepstockWeb = meaningful.some((line) => /keepstock web/i.test(line));
  const passwordResetContext = meaningful.some((line) => /password reset|reset email|ClearSpider/i.test(line));
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
  if (gen2Context && workstationCheck) contextualSteps.push("Checked Workstation and found no indication the account had transitioned to Gen 2.");
  if (gen2Context && meaningful.some((line) => /(?:osr|account manager)/i.test(line) && /customer/i.test(line) && /transition/i.test(line))) contextualSteps.push("Explained that the OSR/account manager and customer would be notified before a Gen 2 transition.");
  if (programUnassigned) contextualSteps.push("Verified the rep was not assigned to the customer's KeepStock programs.");
  if (programGuidance) contextualSteps.push("Guided the rep to Grainger.com > KeepStock > Account Information, enter the account number, select all programs, and save to assign them to their profile.");
  if (keepstockWeb && meaningful.some((line) => /app|website/i.test(line))) contextualSteps.push("Clarified that program assignment must be completed in KeepStock Web, not the app.");
  if (createUserContext && createUserLoginStep) contextualSteps.push("Guided the rep to log in to Grainger.com and open KeepStock.");
  if (createUserContext && createUserMenuStep) contextualSteps.push("Directed the rep to User & Group Management > Users > Create User.");
  if (createUserContext && createUserPromptStep) contextualSteps.push("Advised the rep to follow the prompts to complete the new-user setup.");
  if (createUserContext && createUserAssignStep) contextualSteps.push("Instructed the rep to assign the appropriate programs to the new user.");

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
    else contextualSteps.push("Identified a configuration conflict between the user-group dispensing limit and the program dispensing setting.");
    if (readdContext) contextualSteps.push(`Advised removing the item from the user group, adding it back, and setting the user-group limit to ${programDispense ? `${programDispense} batteries per week` : "match the program's configured quantity"}.`);
    if (weeklyLimitContext && programDispense) contextualSteps.push(`Confirmed the user should be limited to ${programDispense} batteries per week.`);
    if (weeklyResetContext) contextualSteps.push("Explained that the weekly dispense allowance resets after one week.");
    if (retestContext) contextualSteps.push("Advised testing the updated user-group configuration after the change.");
  }

  const rawSteps = meaningful.filter((line) => {
    if (!actionRe.test(line) || line === explicitResolution) return false;
    if (programUnassigned && /\b(?:not assigned|aren't assigned|not yet assigned)\b/i.test(line)) return false;
    if (programGuidance && /grainger\.com|account information|select all|assign all|\bsave\b/i.test(line)) return false;
    if (keepstockWeb && /keepstock web|\bapp\b|website/i.test(line)) return false;
    if (gen2Context && /transition|gen\s*2|workstation|\bosr\b|account manager/i.test(line)) return false;
    if (createUserContext && /grainger\.com.*keepstock|user\s*(?:and|&)\s*group\s*management|under\s+users.*create\s+user|follow\s+(?:the\s+)?(?:prompts?|prom\b|instructions?)|assign(?:ed|ing)?\s+(?:some|the|appropriate|all)?\s*programs?.*(?:new\s+)?user/i.test(line)) return false;
    if (dispenseConflictContext && /user group|dispens|batter|pack of|conflict|remove.*(?:item|one)|add it back|after a week|see how that goes|pulled up|look(?:ed)? it up/i.test(line)) return false;
    return true;
  });
  const steps = unique([...contextualSteps, ...rawSteps.map(summarizeRecorderStep).filter(Boolean)]);

  let resolution = "";
  if (explicitResolution) {
    resolution = summarizeRecorderStep(explicitResolution) || sentence(explicitResolution);
  } else if (dispenseConflictContext && readdContext) {
    const amount = programDispense || "the program's configured quantity";
    resolution = `Identified a dispensing-limit conflict between the user group and program. Rep was instructed to remove and re-add the item in the user group with a weekly limit of ${programDispense ? `${programDispense} batteries per week` : amount} to match the program, then retest.`;
  } else if (dispenseConflictContext) {
    resolution = "Identified a dispensing-limit conflict between the user group and program; user-group settings need to be aligned with the program configuration.";
  } else if (createUserContext && createUserAssignStep) {
    resolution = "Rep was trained on creating a new user in KeepStock Web and assigning programs to the user's profile.";
  } else if (createUserContext) {
    resolution = "Rep was trained on creating a new user in KeepStock Web.";
  } else if (passwordResetContext) {
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
function isRecorderOnsiteCategory(category = value("newCategory")) {
  const normalized = String(category || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized === "keepstockonsite" || normalized === "keepstockcanadaonsite";
}
function buildRecorderDetailedDescription(sections = recorderSections()) {
  // US and Canada Onsite tickets intentionally use only these five fields.
  if (isRecorderOnsiteCategory()) {
    return `Crib/Program id: ${value("cribProgramId")}
Program name: ${value("programName")}
Company name: ${value("companyName")}
Site ID (If Applicable): ${value("siteId")}
Acct #: ${value("accountNumber")}`;
  }

  const meta = RECORDER_DETAIL_FIELDS
    .map(([id, label]) => `${label}: ${value(id)}`)
    .join("\n");

  const routing = [
    ["Category", value("newCategory")],
    ["Subcategory", value("newSubcategory")],
    ["Channel", value("channel")],
    ["Location", value("newLocation")]
  ].map(([label, fieldValue]) => `${label}: ${fieldValue}`).join("\n");

  const steps = sections.steps.map((line) => `- ${sentence(line)}`).join("\n");
  const issue = value("newSubcategory") || sentence(sections.issue);
  const resolution = sentence(sections.resolution);

  return `Template Header (DO NOT REMOVE)
**Delete any unused sections below**

------------------------------------------------------------
Slack Thread URL:

Parent/PRB Template:

${meta}

${routing}

Issue:
${issue}

Troubleshooting Steps:
${steps}

Resolution / Next Step:
${resolution}`;
}
function buildRecorderWorkNotes(sections = recorderSections()) {
  const steps = sections.steps.map((line) => `- ${sentence(line)}`).join("\n");
  const escalation = /escalat|t2|tier 2/i.test(sections.cleaned) ? "Escalated for additional investigation." : "";
  return `Issue:\n${value("newSubcategory") || sentence(sections.issue)}\n\nTroubleshooting Steps:\n${steps}\n\nResolution:\n${sentence(sections.resolution)}\n\nReason for Escalation:\n${escalation}`;
}
function buildRecorderShortDescription(sections = recorderSections()) {
  const subcategory = value("newSubcategory");
  let issue = normalizeRecorderTerms(sections.issueSummary || "");
  issue = issue
    .replace(/^(?:caller|customer|user|rep)\s+(?:wanted to|needs? to|is trying to)\s+/i, "")
    .replace(/^(?:caller|customer|rep)\s+/i, "")
    .replace(/^user\s+(?!group\b)/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (issue) issue = issue[0].toUpperCase() + issue.slice(1);
  if (!issue && subcategory) issue = subcategory;
  if (subcategory && issue && issue.toLowerCase() !== subcategory.toLowerCase()) return `${subcategory} - ${issue}`.slice(0, 180);
  return (issue || subcategory || "Incident support request").slice(0, 180);
}
function refreshRecorderDescriptions({ cleanNotes=false }={}) {
  if (cleanNotes) $("newRawNotes").value=cleanNotesText($("newRawNotes").value);
  extractRecorderDetails(false);
  const sections=recorderSections();
  const generatedTitle=buildRecorderShortDescription(sections);
  const titleEl=$("newTitle");
  const currentTitle=value("newTitle");
  const subcategory=value("newSubcategory");
  const looksAutoGenerated = !currentTitle || titleEl?.dataset?.autoGenerated === "true" || (subcategory && (currentTitle === subcategory || currentTitle.startsWith(`${subcategory} - `)));
  if (looksAutoGenerated && titleEl) {
    titleEl.value=generatedTitle;
    titleEl.dataset.autoGenerated="true";
  }
  $("detailedDescription").value=buildRecorderDetailedDescription(sections);
  $("workNotes").value=buildRecorderWorkNotes(sections);
  updateRecorderCounters();
  return sections;
}
function generateTicketFromForm() {
  const sections=refreshRecorderDescriptions({cleanNotes:false});
  const ticket=`Short Description:\n${value("newTitle",buildRecorderShortDescription(sections))}\n\nDetailed Description:\n${value("detailedDescription")}\n\nWork Notes:\n${value("workNotes")}`;
  $("generatedTicket").value=ticket;
  $("recorderTimeSaved").textContent=`Generated ${new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})}`;
  setRecorderSaveStatus("Generated");
  showToast("Concise ticket generated from the call notes.");
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
  if (data.state!==undefined) $("recorderState").value=data.state || "New";
  if (data.assignedTo!==undefined) $("newAssignedTo").value=data.assignedTo || "";
  if (data.location!==undefined) $("newLocation").value=data.location || "";
  if (data.ticketOutput!==undefined) $("generatedTicket").value=data.ticketOutput || "";
  updateRecorderPriority(); renderRecorderDetectedSummary(); updateRecorderCounters(); refreshIcons();
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
function recorderSeverity(){ const p=value("priority"); if(/^1|^2/.test(p)||/critical|high/i.test(value("urgency")))return "high"; if(/^4/.test(p)&&/low/i.test(value("urgency")))return "low"; return "medium"; }
function recorderStatus(){ const state=value("recorderState","New").toLowerCase(); if(state.includes("resolved")||state.includes("closed"))return "resolved"; if(state.includes("hold"))return "pending"; return "investigating"; }

function saveNewIncident(event, forcedState) {
  if(event?.preventDefault) event.preventDefault();
  if(forcedState) $("recorderState").value=forcedState;
  if(!value("newTitle") || !value("detailedDescription") || !value("workNotes")) generateTicketFromForm();
  const title=value("newTitle");
  if(!title){showToast("Add rough notes or a short description before saving.");$("newTitle").focus();return;}
  if(!value("newSubcategory")){showToast("Choose a subcategory before saving the incident.");$("newSubcategory").focus();return;}
  if(!value("generatedTicket")) generateTicketFromForm();
  const incident={
    id:nextIncidentId(), title, severity:recorderSeverity(), date:new Date().toISOString().slice(0,10), status:recorderStatus(),
    assignedTo:value("newAssignedTo","Clowie Moscare"), category:value("newCategory","Technical / Other"), location:value("newLocation","Not provided"),
    notes:value("generatedTicket")||value("detailedDescription")||value("newRawNotes"), account:value("accountNumber"), device:value("deviceId"), subcategory:value("newSubcategory"), priority:value("priority"), rawNotes:value("newRawNotes"), detailedDescription:value("detailedDescription"), workNotes:value("workNotes")
  };
  appState.incidents.unshift(incident); saveAppState(); saveRecorderSettings(); renderIncidents(); updateMetrics(); stopRecorderVoiceNotes(); $("newIncidentDialog").close(); navigate("incidents"); showToast(`${incident.id} saved to the dashboard.`);
}

function resetRecorder(){
  if(!confirm("Reset all New Incident fields, rough notes, and generated ticket?"))return;
  stopRecorderVoiceNotes(); $("newIncidentForm").reset(); $("generatedTicket").value=""; applyRecorderDefaults(); setRecorderSaveStatus("Not saved"); showToast("New Incident workspace reset.");
}

function appendRecorderNote(text){ const current=value("newRawNotes"); $("newRawNotes").value=current?`${current}\n${text}`:text; setRecorderSaveStatus("Unsaved changes"); }
function renderRecorderSnippets(){ const el=$("snippetRow"); if(el)el.innerHTML=RECORDER_SNIPPETS.map((s)=>`<button type="button" data-recorder-snippet="${escapeHtml(s)}">+ ${escapeHtml(s)}</button>`).join(""); }
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

  $("snippetRow").addEventListener("click",(event)=>{ const btn=event.target.closest("[data-recorder-snippet]"); if(!btn)return; appendRecorderNote(btn.dataset.recorderSnippet); showToast("Snippet added to rough notes."); });
  $("recorderDraftList").addEventListener("click",(event)=>{ const btn=event.target.closest("[data-recorder-draft-action]"); if(!btn)return; handleRecorderDraftAction(btn.dataset.recorderDraftAction,btn.dataset.id); });
  $("deleteRecorderDraftsBtn").addEventListener("click",deleteRecorderDrafts);

  $("newCategory").addEventListener("change",()=>{ populateRecorderSubcategories(); saveRecorderSettings(); setRecorderSaveStatus("Unsaved changes"); });
  $("newSubcategory").addEventListener("change",()=>{ saveRecorderSettings(); setRecorderSaveStatus("Unsaved changes"); });
  ["businessImpact","userImpact","urgency"].forEach((id)=>$(id).addEventListener("change",()=>{ updateRecorderPriority(); setRecorderSaveStatus("Unsaved changes"); }));
  RECORDER_FORM_IDS.forEach((id)=>{ const el=$(id); if(!el)return; el.addEventListener("input",()=>{ setRecorderSaveStatus("Unsaved changes"); if(RECORDER_DETAIL_FIELDS.some(([fieldId])=>fieldId===id))renderRecorderDetectedSummary(); }); });
  $("detailedDescription").addEventListener("input",()=>updateRecorderCounter("detailedDescription","detailedCounter"));
  $("workNotes").addEventListener("input",()=>updateRecorderCounter("workNotes","workCounter"));

  $("resetDetailedBtn").addEventListener("click",()=>{ $("detailedDescription").value=buildRecorderDetailedDescription(recorderSections()); updateRecorderCounters(); showToast("Detailed description template reset."); });
  $("resetWorkBtn").addEventListener("click",()=>{ $("workNotes").value=RECORDER_WORK_NOTES_TEMPLATE; updateRecorderCounters(); showToast("Work notes template reset."); });
  $("copyDetailedBtn").addEventListener("click",()=>copyText($("detailedDescription").value,"Detailed description copied."));
  $("copyWorkBtn").addEventListener("click",()=>copyText($("workNotes").value,"Work notes copied."));
  $("copyGeneratedBtn").addEventListener("click",()=>copyText($("generatedTicket").value,"Generated ticket copied."));
  $("copyWorkFromOutputBtn").addEventListener("click",()=>copyText($("workNotes").value,"Work notes copied."));
  $("copyDetailedFromOutputBtn").addEventListener("click",()=>copyText($("detailedDescription").value,"Detailed description copied."));
  $("downloadGeneratedBtn").addEventListener("click",()=>downloadText($("generatedTicket").value,`${(value("newTitle","incident").replace(/[^a-z0-9]+/gi,"-").toLowerCase())}-ticket.txt`));

  $("newIncidentDialog").addEventListener("close",stopRecorderVoiceNotes);
  document.addEventListener("keydown",(event)=>{ if(!$("newIncidentDialog").open || !(event.ctrlKey||event.metaKey))return; if(event.key==="Enter"){event.preventDefault();generateTicketFromForm();} if(event.key.toLowerCase()==="s"){event.preventDefault();saveRecorderDraft();} if(event.shiftKey&&event.key.toLowerCase()==="c"){event.preventDefault();copyText($("generatedTicket").value,"Generated ticket copied.");} });

  $("saveProfileBtn").addEventListener("click",()=>{ appState.settings={...(appState.settings||{}),name:value("profileName"),email:value("profileEmail")}; saveAppState(); showToast("Profile settings saved locally."); });
  $("saveDeepgramBtn").addEventListener("click",saveDeepgramSettings);
  $("testDeepgramBtn").addEventListener("click",testDeepgramSettings);
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
