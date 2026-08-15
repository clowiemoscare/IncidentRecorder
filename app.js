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
  ["applicationVersion", "Application Version"], ["timeIssueOccurred", "Time issue occurred"]
];
const RECORDER_FORM_IDS = [
  "newRawNotes", "cribProgramId", "programName", "companyName", "siteId", "accountNumber", "softwareVersion", "deviceId", "machineSerial", "cradlepointSerial", "imei", "carrier", "badgeReader", "model", "phoneModel", "phoneSoftwareVersion", "application", "applicationVersion", "timeIssueOccurred", "newCategory", "newSubcategory", "recorderState", "businessImpact", "userImpact", "urgency", "priority", "assignmentGroup", "newAssignedTo", "service", "serviceOffering", "configurationItem", "channel", "newLocation", "partsRequest", "deviceAsset", "applicationService", "relatedSearch", "knowledgeScope", "watchList", "resolutionCode", "closeNotes", "newTitle", "detailedDescription", "workNotes", "generatedTicket"
];

let recorderRecognition = null;
let recorderShouldRestartVoice = false;
let recorderVoiceListening = false;

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

function cleanNotesText(raw) {
  const filler = /^(hi|hello|hey|thanks|thank you|okay|ok|um|uh|hmm|so|basically|you know|good morning|good afternoon|good evening)\b/i;
  const lines = String(raw || "")
    .replace(/\r/g, "\n")
    .replace(/[\u2022\u00b7]/g, "\n")
    .split(/\n|;|(?<=[.!?])\s+/)
    .map(normalizeRecorderLine)
    .filter(Boolean)
    .filter((line) => !filler.test(line));
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
  const clean = normalizeRecorderLine(text);
  if (!clean) return "Not provided.";
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
  const text = value("newRawNotes");
  const defs = [
    ["cribProgramId", /\b(?:crib\s*\/\s*program\s*(?:id|#)|crib\s*(?:id|#)|program\s*(?:id|#))\s*[:=#-]?\s*([A-Z0-9-]+)/i],
    ["accountNumber", /\b(?:acct|account)\s*(?:#|number|num)?\s*[:=#-]?\s*([A-Z0-9-]{5,})/i],
    ["deviceId", /\bdevice\s*id(?:\s*\(affected\))?\s*[:=#-]?\s*([A-Z0-9-]{4,})/i],
    ["machineSerial", /\b(?:machine\s*)?serial(?:\s*number)?(?:\(s\))?\s*[:=#-]?\s*([A-Z0-9-]{5,})/i],
    ["cradlepointSerial", /\b(?:cradlepoint|cp)\s*serial(?:\s*number)?\s*[:=#-]?\s*([A-Z0-9-]{5,})/i],
    ["siteId", /\bsite\s*id\s*[:=#-]?\s*([A-Z0-9-]{3,})/i],
    ["softwareVersion", /\b(?:software|sw)\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)/i],
    ["applicationVersion", /\b(?:application|app)\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)/i],
    ["phoneSoftwareVersion", /\bphone\s*(?:software|sw)\s*version\s*[:=#-]?\s*([A-Z0-9._-]+)/i],
    ["imei", /\bimei\s*[:=#-]?\s*([0-9]{8,20})/i],
    ["carrier", /\bcarrier\s*[:=-]?\s*([A-Za-z][A-Za-z0-9 &.-]{1,30})/i],
    ["badgeReader", /\bbadge\s*reader\s*[:=-]?\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,30})/i],
    ["phoneModel", /\bphone\s*model\s*[:=-]?\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,40})/i],
    ["model", /\bmodel\s*[:=-]?\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,40})/i],
    ["application", /\b(?:application|app)\s*[:=-]\s*([A-Za-z0-9][A-Za-z0-9 _.-]{1,40})/i],
    ["timeIssueOccurred", /\b(?:time issue occurred|issue time)\s*[:=-]?\s*([^\n.;]+)/i],
    ["programName", /\bprogram\s*name\s*[:=-]?\s*([^\n.;]+)/i],
    ["companyName", /\b(?:company|customer)\s*name\s*[:=-]?\s*([^\n.;]+)/i]
  ];
  defs.forEach(([id, regex]) => {
    const match=text.match(regex); if(!match) return;
    if (overwrite || !value(id)) $(id).value = normalizeRecorderLine(match[1]).replace(/\s+(?:and|then)$/i, "");
  });
  renderRecorderDetectedSummary();
  setRecorderSaveStatus("Unsaved changes");
  return Object.fromEntries(RECORDER_DETAIL_FIELDS.map(([id])=>[id,value(id)]));
}

function renderRecorderDetectedSummary() {
  const found = RECORDER_DETAIL_FIELDS.map(([id,label])=>({label,value:value(id)})).filter((item)=>item.value);
  const box=$("detectedSummary");
  if (!found.length) { box.className="detected-summary"; box.textContent="No details extracted yet."; return; }
  box.className="detected-summary detected-list has-values";
  box.innerHTML=found.map((item)=>`<span class="detected-chip"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</span>`).join("");
}

function recorderSections(raw = value("newRawNotes")) {
  const cleaned=cleanNotesText(raw);
  const lines=cleaned.split(/\n+/).map(normalizeRecorderLine).filter(Boolean);
  const metadata=/^(?:acct|account|device\s*id|machine\s*serial|serial|crib|program\s*(?:id|name)|company|customer\s*name|site\s*id|software\s*version|sw\s*version|application\s*version|app\s*version|imei|carrier|badge\s*reader|model|phone\s*model|time\s*issue)/i;
  const resolutionRe=/(resolved|fixed|restored|working now|sync successful|synced successfully|successful|completed|issue cleared|no longer|customer confirmed|user confirmed)/i;
  const actionRe=/\b(confirmed|verified|checked|located|looked|unplugged|plugged|pressed|restarted|rebooted|reset|synced|cleared|tested|opened|closed|sent|forwarded|advised|explained|asked|reviewed|contacted|power cycled|had user|investigated|escalated)\b/i;
  const narrative=lines.filter((line)=>!metadata.test(line));
  const resolution=([...narrative].reverse().find((line)=>resolutionRe.test(line)) || "Pending investigation or follow-up.");
  const steps=unique(narrative.filter((line)=>actionRe.test(line) && line!==resolution));
  const issue=narrative.find((line)=>!actionRe.test(line) && !resolutionRe.test(line)) || narrative[0] || "No issue description provided.";
  return { cleaned, lines, issue, steps, resolution };
}

function buildRecorderDetailedDescription(sections=recorderSections()) {
  const meta = RECORDER_DETAIL_FIELDS.map(([id,label])=>`${label}: ${value(id,"Not provided")}`).join("\n");
  const steps = sections.steps.length ? sections.steps.map((line)=>`- ${sentence(line)}`).join("\n") : "- No troubleshooting steps captured yet.";
  return `Template Header (DO NOT REMOVE)\n**Delete any unused sections below**\n\n------------------------------------------------------------\nSlack Thread URL:\n\nParent/PRB Template: [Update/add to section below with all required data from Parents/PRB's]\n\n${meta}\n\nCategory: ${value("newCategory","Not provided")}\nSubcategory: ${value("newSubcategory","Not provided")}\nChannel: ${value("channel","Phone")}\nLocation: ${value("newLocation","Not provided")}\n\nIssue:\n${sentence(sections.issue)}\n\nTroubleshooting Steps:\n${steps}\n\nResolution / Next Step:\n${sentence(sections.resolution)}`;
}

function buildRecorderWorkNotes(sections=recorderSections()) {
  const steps = sections.steps.length ? sections.steps.map((line)=>`- ${sentence(line)}`).join("\n") : "- No troubleshooting steps captured yet.";
  const escalation = /escalat|t2|tier 2/i.test(sections.cleaned) ? "Escalated for additional investigation." : "[Only if escalated to T2]";
  return `Issue:\n${sentence(sections.issue)}\n\nTroubleshooting Steps:\n${steps}\n\nResolution:\n${sentence(sections.resolution)}\n\nReason for Escalation: ${escalation}`;
}

function buildRecorderShortDescription(sections=recorderSections()) {
  const prefix=value("programName") || value("companyName") || "";
  const issue=normalizeRecorderLine(sections.issue).replace(/^(caller|customer|user|rep)\s+/i, "");
  const text=prefix ? `${prefix} - ${issue}` : issue;
  return (text || "Incident support request").slice(0,180);
}

function refreshRecorderDescriptions({ cleanNotes=false }={}) {
  if (cleanNotes) $("newRawNotes").value=cleanNotesText($("newRawNotes").value);
  extractRecorderDetails(false);
  const sections=recorderSections();
  if (!value("newTitle")) $("newTitle").value=buildRecorderShortDescription(sections);
  $("detailedDescription").value=buildRecorderDetailedDescription(sections);
  $("workNotes").value=buildRecorderWorkNotes(sections);
  updateRecorderCounters();
  return sections;
}

function generateTicketFromForm() {
  const sections=refreshRecorderDescriptions({cleanNotes:true});
  const ticket=`Short Description:\n${value("newTitle",buildRecorderShortDescription(sections))}\n\nDetailed Description:\n${value("detailedDescription")}\n\nWork Notes:\n${value("workNotes")}`;
  $("generatedTicket").value=ticket;
  $("recorderTimeSaved").textContent=`Generated ${new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})}`;
  setRecorderSaveStatus("Generated");
  showToast("Clean ticket generated from the call notes.");
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

function setupRecorderVoiceNotes(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition; recorderRecognition=null; recorderShouldRestartVoice=false; recorderVoiceListening=false;
  const dot=$("voiceDot"),start=$("startVoiceBtn"),pause=$("pauseVoiceBtn"),stop=$("stopVoiceBtn");
  dot.classList.remove("ready","listening"); pause.disabled=true; stop.disabled=true;
  if(!SR){$("voiceStatus").textContent="Voice notes are not supported in this browser. You can still type rough notes.";start.disabled=true;return;}
  if(isLocalFilePage()){$("voiceStatus").textContent="Voice notes need HTTPS or localhost. Upload to GitHub Pages to use microphone dictation.";start.disabled=true;return;}
  dot.classList.add("ready");start.disabled=false;$("voiceStatus").textContent="Voice notes are off. Click Start voice notes when you are ready to allow microphone access.";
}
function initRecorderVoiceNotes(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR||isLocalFilePage()){setupRecorderVoiceNotes();return false;} if(recorderRecognition)return true;
  recorderRecognition=new SR(); recorderRecognition.continuous=true; recorderRecognition.interimResults=true; recorderRecognition.lang="en-US";
  recorderRecognition.onstart=()=>{recorderVoiceListening=true;$("startVoiceBtn").disabled=true;$("pauseVoiceBtn").disabled=false;$("stopVoiceBtn").disabled=false;$("voiceDot").classList.add("listening");$("voiceStatus").textContent="Listening. Speak short call notes.";};
  recorderRecognition.onresult=(event)=>{let interim="",finalText="";for(let i=event.resultIndex;i<event.results.length;i++){const t=event.results[i][0].transcript.trim();if(event.results[i].isFinal)finalText+=`${t}\n`;else interim+=t;}if(finalText.trim())appendRecorderNote(finalText.trim());$("interimTranscript").textContent=interim||"Interim transcript will appear here while listening.";};
  recorderRecognition.onerror=(event)=>{recorderShouldRestartVoice=false;$("voiceDot").classList.remove("listening");$("startVoiceBtn").disabled=false;$("pauseVoiceBtn").disabled=true;$("stopVoiceBtn").disabled=true;$("voiceStatus").textContent=["not-allowed","service-not-allowed","audio-capture"].includes(event.error)?"Microphone access was blocked or unavailable. You can keep typing rough notes.":`Voice note error: ${event.error}. You can keep typing notes.`;};
  recorderRecognition.onend=()=>{recorderVoiceListening=false;$("voiceDot").classList.remove("listening");$("interimTranscript").textContent="Interim transcript will appear here while listening.";if(recorderShouldRestartVoice){try{recorderRecognition.start();}catch(e){recorderShouldRestartVoice=false;}}else{$("startVoiceBtn").disabled=false;$("pauseVoiceBtn").disabled=true;$("stopVoiceBtn").disabled=true;$("voiceStatus").textContent="Voice notes stopped.";}};
  return true;
}
function startRecorderVoiceNotes(){ if(isLocalFilePage()){setupRecorderVoiceNotes();showToast("Voice notes need HTTPS or localhost. They will work on GitHub Pages.");return;} if(!initRecorderVoiceNotes())return;recorderShouldRestartVoice=true;if(recorderVoiceListening)return;try{recorderRecognition.start();}catch(e){$("voiceStatus").textContent="Voice notes are already starting.";} }
function pauseRecorderVoiceNotes(){recorderShouldRestartVoice=false;if(recorderRecognition){try{recorderRecognition.stop();}catch(e){}}$("voiceStatus").textContent="Voice notes paused.";}
function stopRecorderVoiceNotes(){recorderShouldRestartVoice=false;if(recorderRecognition){try{recorderRecognition.stop();}catch(e){}}recorderVoiceListening=false;if($("startVoiceBtn"))$("startVoiceBtn").disabled=isLocalFilePage();if($("pauseVoiceBtn"))$("pauseVoiceBtn").disabled=true;if($("stopVoiceBtn"))$("stopVoiceBtn").disabled=true;if($("voiceDot"))$("voiceDot").classList.remove("listening");if($("voiceStatus"))$("voiceStatus").textContent=isLocalFilePage()?"Voice notes need HTTPS or localhost.":"Voice notes stopped.";}
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
  refreshIcons(); requestAnimationFrame(drawAllCharts);
}

document.addEventListener("DOMContentLoaded", initialize);
