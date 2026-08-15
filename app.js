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

function openNewIncident() {
  $("newIncidentForm").reset();
  $("newAssignedTo").value = appState.settings?.name || "Clowie Moscare";
  $("generatedTicket").value = "";
  $("newIncidentDialog").showModal();
}

function cleanNotesText(raw) {
  const filler = /^(hi|hello|thanks|thank you|okay|ok|um|uh|so|basically|you know)\b/i;
  const lines = String(raw || "").split(/\n|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  return unique(lines.filter((line) => !filler.test(line)).map((line) => line.replace(/\s+/g, " "))).join("\n");
}

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function generateTicketFromForm() {
  const raw = cleanNotesText($("newRawNotes").value);
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const issue = lines.find((line) => /(unable|cannot|can't|error|failed|attempt|detected|missing|offline|alarm|theft|vandal|suspicious|loiter)/i.test(line)) || lines[0] || "No issue description provided.";
  const actions = lines.filter((line) => /(checked|confirmed|reviewed|located|contacted|reset|restarted|tested|sent|asked|verified|investigat|security|camera|footage|escalat)/i.test(line));
  const resolution = [...lines].reverse().find((line) => /(resolved|fixed|restored|working|completed|left|cleared|successful|closed)/i.test(line)) || "Pending investigation or follow-up.";
  const id = nextIncidentId();
  const today = new Date().toISOString().slice(0, 10);
  const bullets = actions.length ? actions.map((line) => `- ${sentence(line)}`).join("\n") : "- No troubleshooting or response steps captured yet.";
  const ticket = `Incident Ticket Draft\nCreated: ${new Date().toLocaleString()}\n\nIncident ID: ${id}\nTitle: ${value("newTitle", "Not provided")}\nDate: ${today}\nSeverity: ${value("newSeverity", "medium")}\nStatus: ${value("newStatus", "investigating")}\nAssigned To: ${value("newAssignedTo", "Not provided")}\nCategory: ${value("newCategory", "Not provided")}\nLocation: ${value("newLocation", "Not provided")}\nAccount #: ${value("newAccount", "Not provided")}\nDevice ID: ${value("newDevice", "Not provided")}\n\nIssue:\n${sentence(issue)}\n\nActions / Findings:\n${bullets}\n\nResolution / Next Step:\n${sentence(resolution)}\n\nRaw Notes:\n${raw || "Not provided"}`;
  $("newRawNotes").value = raw;
  $("generatedTicket").value = ticket;
  showToast("Ticket draft generated.");
}

function sentence(text) {
  const clean = String(text || "").trim();
  if (!clean) return "Not provided.";
  const capped = clean[0].toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}
function value(id, fallback = "") { return $(id).value.trim() || fallback; }

function nextIncidentId() {
  const nums = appState.incidents.map((incident) => Number(String(incident.id).match(/(\d+)$/)?.[1] || 0));
  return `INC-${String(Math.max(6, ...nums) + 1).padStart(3, "0")}`;
}

function saveNewIncident(event) {
  event.preventDefault();
  const title = value("newTitle");
  if (!title) { showToast("Add a title before saving the incident."); $("newTitle").focus(); return; }
  if (!$("generatedTicket").value.trim()) generateTicketFromForm();
  const incident = {
    id: nextIncidentId(), title,
    severity: $("newSeverity").value,
    date: new Date().toISOString().slice(0, 10),
    status: $("newStatus").value,
    assignedTo: value("newAssignedTo", "Clowie Moscare"),
    category: $("newCategory").value,
    location: value("newLocation", "Not provided"),
    account: value("newAccount"), device: value("newDevice"),
    notes: $("generatedTicket").value.trim() || $("newRawNotes").value.trim()
  };
  appState.incidents.unshift(incident);
  saveAppState();
  renderIncidents();
  $("newIncidentDialog").close();
  navigate("incidents");
  showToast(`${incident.id} saved locally.`);
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

  $("cleanNotesBtn").addEventListener("click",()=>{ $("newRawNotes").value=cleanNotesText($("newRawNotes").value); showToast("Rough notes cleaned."); });
  $("generateTicketBtn").addEventListener("click",generateTicketFromForm); $("newIncidentForm").addEventListener("submit",saveNewIncident);
  $("copyGeneratedBtn").addEventListener("click",()=>copyText($("generatedTicket").value,"Generated ticket copied."));
  $("downloadGeneratedBtn").addEventListener("click",()=>downloadText($("generatedTicket").value,`${(value("newTitle","incident").replace(/[^a-z0-9]+/gi,"-").toLowerCase())}-ticket.txt`));

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
