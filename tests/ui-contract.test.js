import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "src/ui/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles/recorder.css"), "utf8");

function topbarHtml() {
  return html.slice(html.indexOf('<header class="topbar">'), html.indexOf('</header>') + 9);
}

test("Category and Subcategory are required controls", () => {
  assert.match(html, /<select id="newCategory" required/);
  assert.match(html, /<select id="newSubcategory" required/);
});

test("Reset template validates routing and offers both master templates", () => {
  assert.match(app, /resetDetailedTemplate\(\)[\s\S]*ensureRoutingSelected\(\)/);
  assert.match(html, /id="chooseStandardTemplateBtn"/);
  assert.match(html, /id="chooseGen2TemplateBtn"/);
});

test("Rough Notes matches the interim transcript minimum height", () => {
  assert.match(css, /\.interim \{ min-height: 48px; \}/);
  assert.match(css, /#newRawNotes \{ min-height: 48px; height: 48px;/);
  assert.doesNotMatch(css, /#newRawNotes \{ min-height: 96px;/);
});

test("Browser speech is selected by default and Deepgram remains optional", () => {
  assert.doesNotMatch(html, /<option value="auto">/);
  assert.doesNotMatch(html, /-- Select transcription --/);
  assert.match(html, /<option value="browser" selected>Browser speech \(no Deepgram\)<\/option>/);
  assert.match(html, /<option value="deepgram">Deepgram Nova-3<\/option>/);
  assert.match(app, /setProviderPreference\("browser"\)/);
});

test("workspace reset clears Category and Subcategory and returns transcription to Browser speech", () => {
  const block = app.slice(app.indexOf("  async resetWorkspace() {"), app.indexOf("\n  saveEndpoint() {"));
  assert.match(block, /this\.settings\.categoryId = "";/);
  assert.match(block, /this\.settings\.subcategoryId = "";/);
  assert.match(block, /populateCategories\(""\)/);
  assert.match(block, /populateSubcategories\(""\)/);
  assert.match(block, /setProviderPreference\("browser"\)/);
});

test("Cloudflare AI readiness is visible and confirmed before local fallback generation", () => {
  assert.match(html, /id="aiConfigNotice"/);
  assert.match(app, /aiGenerationPlan\(\)/);
  assert.match(app, /Cloudflare AI is not configured[\s\S]*local fallback analyzer instead\. Continue\?/);
});

test("Gen2 AI root cause fills the verified field only when the user has not supplied one", () => {
  assert.match(app, /templateFamilyFor\(\$\("newCategory"\)\.value\) === "gen2" && !fields\.rootCause && analysis\.rootCause/);
  assert.match(app, /fields\.rootCause = analysis\.rootCause;[\s\S]*\$\("rootCause"\)\.value = analysis\.rootCause;/);
});

test("ticket generation keeps one Generate ticket button and asks Initial or Final", () => {
  assert.match(html, /id="generateTicketBtn"[\s\S]*Generate ticket/);
  assert.match(html, /id="generationTypeDialog"/);
  assert.match(html, /id="chooseInitialTicketBtn"[\s\S]*Initial ticket/);
  assert.match(html, /id="chooseFinalTicketBtn"[\s\S]*Final ticket/);
  assert.doesNotMatch(html, /Generate Initial Ticket/);
  assert.doesNotMatch(html, /Generate Ticket Update/);
  assert.doesNotMatch(html, /id="ticketUpdatePanel"/);
  assert.doesNotMatch(html, /id="ticketUpdate"/);
  assert.match(app, /selectedType === "final" && hasPreviousAnalysis \? "update" : "initial"/);
  assert.match(app, /notesSinceSnapshot\(rawWorkspaceNotes, this\.liveSession\)/);
  const generationBlock = app.slice(app.indexOf("  async generateTicket("), app.indexOf("\n  syncGeneratedOutput() {"));
  assert.doesNotMatch(generationBlock, /stopVoice\(/);
});

test("header uses KSHD, new subtitle, and New Incident beside save status", () => {
  const header = topbarHtml();
  assert.match(header, /brand-mark">KSHD</);
  assert.match(header, /Capture the call, verify extracted values, generate the ticket, then save/);
  assert.match(header, /id="saveStatus"[\s\S]*id="newIncidentBtn"/);
  assert.doesNotMatch(html, /<h1>New Incident<\/h1>/);
});

test("workflow Capture Verify Generate Save chips are removed", () => {
  assert.doesNotMatch(html, /class="workflow-steps"/);
});

test("draft form data preserves the live-session checkpoint and previous analysis", () => {
  assert.match(app, /liveSession: createLiveSession\(this\.liveSession\)/);
  assert.match(app, /this\.liveSession = createLiveSession\(data\.liveSession \|\| \{\}\)/);
  assert.match(app, /this\.lastAnalysis = this\.liveSession\.lastAnalysis/);
});
