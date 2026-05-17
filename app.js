const STORAGE_KEY = "incidentRecorderDraftsV1";

const fields = [
  "callerName",
  "callbackNumber",
  "department",
  "device",
  "service",
  "priority",
  "category",
  "status",
  "rawNotes"
];

const elements = {
  form: document.getElementById("incidentForm"),
  ticketOutput: document.getElementById("ticketOutput"),
  saveStatus: document.getElementById("saveStatus"),
  draftList: document.getElementById("draftList"),
  generateBtn: document.getElementById("generateBtn"),
  saveBtn: document.getElementById("saveBtn"),
  clearBtn: document.getElementById("clearBtn"),
  copyBtn: document.getElementById("copyBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  deleteAllDraftsBtn: document.getElementById("deleteAllDraftsBtn")
};

function getValue(id) {
  const element = document.getElementById(id);
  return element.value.trim();
}

function displayValue(value) {
  return value && value.trim() ? value.trim() : "Not provided";
}

function getFormData() {
  const data = {};
  fields.forEach((field) => {
    data[field] = getValue(field);
  });
  data.ticketOutput = elements.ticketOutput.value.trim();
  return data;
}

function setFormData(data) {
  fields.forEach((field) => {
    const element = document.getElementById(field);
    element.value = data[field] || "";
  });
  elements.ticketOutput.value = data.ticketOutput || "";
}

function splitNotes(rawNotes) {
  return rawNotes
    .split(/\n|\r|\.|;|•|-/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function findFirstMatch(lines, patterns) {
  return lines.find((line) => patterns.some((pattern) => pattern.test(line))) || "";
}

function findAllMatches(lines, patterns) {
  return lines.filter((line) => patterns.some((pattern) => pattern.test(line)));
}

function uniqueLines(lines) {
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

function bulletList(lines) {
  const cleaned = uniqueLines(lines);
  if (!cleaned.length) {
    return "- Not provided.";
  }
  return cleaned.map((line) => `- ${capitalizeSentence(line)}`).join("\n");
}

function capitalizeSentence(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildGeneratedTicket() {
  const data = getFormData();
  const lines = splitNotes(data.rawNotes);

  const issuePatterns = [
    /user\s+(says|said|reports|reported|states|stated)/i,
    /issue|problem|error/i,
    /cannot|can't|unable|not able/i,
    /not working|keeps|stuck|failed|failure/i
  ];

  const impactPatterns = [
    /impact|affect|affected/i,
    /cannot|can't|unable|not able/i,
    /down|outage|no access|blocked/i,
    /all users|multiple users|only user/i
  ];

  const troubleshootingPatterns = [
    /checked|verified|confirmed|reviewed/i,
    /had user|asked user|walked user/i,
    /restart|restarted|reboot|rebooted/i,
    /clear|cleared|reset|removed|reinstalled|installed|updated/i,
    /tested|ran|opened|closed|logged|signed/i,
    /enabled|disabled|connected|disconnected/i,
    /ping|ipconfig|nslookup|tracert/i
  ];

  const findingPatterns = [
    /found|noticed|observed|confirmed|verified/i,
    /active|inactive|locked|disabled|expired/i,
    /same issue|still|error|working|not working/i,
    /successful|failed|failure/i
  ];

  const resolutionPatterns = [
    /resolved|fixed|restored|completed/i,
    /working now|now working|able to|success/i,
    /confirmed.*(working|resolved|connected|syncing)/i,
    /no further action|no further issues/i
  ];

  const issue = findFirstMatch(lines, issuePatterns) || lines[0] || "Not provided.";
  const impact = findFirstMatch(lines, impactPatterns) || "Not provided.";
  const troubleshooting = findAllMatches(lines, troubleshootingPatterns);
  const findings = findAllMatches(lines, findingPatterns);
  const resolution = findFirstMatch(lines.slice().reverse(), resolutionPatterns) || "Not provided.";

  const createdAt = new Date().toLocaleString();

  return `Incident Ticket Draft
Created: ${createdAt}

Caller Information:
Caller Name: ${displayValue(data.callerName)}
Callback Number: ${displayValue(data.callbackNumber)}
Department / Location: ${displayValue(data.department)}
Device / Asset: ${displayValue(data.device)}
Application / Service: ${displayValue(data.service)}
Category: ${displayValue(data.category)}
Priority: ${displayValue(data.priority)}
Status: ${displayValue(data.status)}

Issue:
${capitalizeSentence(displayValue(issue))}

Impact:
${capitalizeSentence(displayValue(impact))}

Troubleshooting Performed:
${bulletList(troubleshooting)}

Findings:
${bulletList(findings)}

Resolution:
${capitalizeSentence(displayValue(resolution))}

Next Steps:
${data.status === "Resolved" ? "No further action required at this time." : "Follow up as needed or escalate if the issue remains unresolved."}

Raw Notes:
${displayValue(data.rawNotes)}`;
}

function generateTicket() {
  elements.ticketOutput.value = buildGeneratedTicket();
  setSaveStatus("Generated");
}

async function copyTicket() {
  const ticket = elements.ticketOutput.value.trim();
  if (!ticket) {
    alert("Generate or type a ticket before copying.");
    return;
  }

  try {
    await navigator.clipboard.writeText(ticket);
    setSaveStatus("Copied");
  } catch (error) {
    elements.ticketOutput.select();
    document.execCommand("copy");
    setSaveStatus("Copied");
  }
}

function downloadTicket() {
  const ticket = elements.ticketOutput.value.trim();
  if (!ticket) {
    alert("Generate or type a ticket before downloading.");
    return;
  }

  const caller = getValue("callerName") || "incident";
  const safeCaller = caller.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const filename = `${safeCaller || "incident"}-ticket.txt`;
  const blob = new Blob([ticket], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function saveDraft() {
  const data = getFormData();
  const existingDrafts = getDrafts();
  const draft = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    data
  };

  const updatedDrafts = [draft, ...existingDrafts].slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDrafts));
  setSaveStatus("Saved");
  renderDrafts();
}

function getDrafts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function renderDrafts() {
  const drafts = getDrafts();

  if (!drafts.length) {
    elements.draftList.className = "draft-list empty";
    elements.draftList.innerHTML = "No saved drafts yet.";
    return;
  }

  elements.draftList.className = "draft-list";
  elements.draftList.innerHTML = drafts
    .map((draft) => {
      const data = draft.data;
      const title = data.callerName || data.service || "Untitled incident";
      const created = new Date(draft.createdAt).toLocaleString();
      const issuePreview = (data.rawNotes || "No notes saved.").slice(0, 100);

      return `
        <article class="draft-card">
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p class="draft-meta">${escapeHtml(created)} · ${escapeHtml(data.status || "Open")} · ${escapeHtml(data.priority || "No priority")}</p>
            <p class="draft-meta">${escapeHtml(issuePreview)}${issuePreview.length >= 100 ? "..." : ""}</p>
          </div>
          <div class="draft-actions">
            <button type="button" data-action="load" data-id="${draft.id}">Load</button>
            <button type="button" class="danger-text" data-action="delete" data-id="${draft.id}">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function handleDraftClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const drafts = getDrafts();
  const draft = drafts.find((item) => item.id === id);

  if (action === "load" && draft) {
    setFormData(draft.data);
    setSaveStatus("Loaded");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (action === "delete") {
    const updatedDrafts = drafts.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDrafts));
    renderDrafts();
    setSaveStatus("Draft deleted");
  }
}

function deleteAllDrafts() {
  if (!getDrafts().length) return;
  const confirmed = confirm("Delete all saved drafts from this browser?");
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  renderDrafts();
  setSaveStatus("Drafts deleted");
}

function clearForm() {
  elements.form.reset();
  document.getElementById("status").value = "Open";
  elements.ticketOutput.value = "";
  setSaveStatus("Not saved");
}

function setSaveStatus(message) {
  elements.saveStatus.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

elements.generateBtn.addEventListener("click", generateTicket);
elements.copyBtn.addEventListener("click", copyTicket);
elements.saveBtn.addEventListener("click", saveDraft);
elements.clearBtn.addEventListener("click", clearForm);
elements.downloadBtn.addEventListener("click", downloadTicket);
elements.draftList.addEventListener("click", handleDraftClick);
elements.deleteAllDraftsBtn.addEventListener("click", deleteAllDrafts);

fields.forEach((field) => {
  document.getElementById(field).addEventListener("input", () => setSaveStatus("Unsaved changes"));
});

elements.ticketOutput.addEventListener("input", () => setSaveStatus("Unsaved changes"));

renderDrafts();
