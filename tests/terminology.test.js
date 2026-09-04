import test from "node:test";
import assert from "node:assert/strict";
import { DEEPGRAM_KEYTERMS, normalizeKeepStockTerminology } from "../src/config/terminology.js";
import { analyzeLocally, inferCallerRole } from "../src/ticket/local-analyzer.js";

test("KeepStock glossary normalization is conservative and idempotent", () => {
  const raw = "keep stock web, crib master, g vend, service now, clear spider, cradle point, maintenance request form, Jagger, pine shot";
  const once = normalizeKeepStockTerminology(raw);
  const twice = normalizeKeepStockTerminology(once);
  assert.equal(twice, once);
  for (const term of ["KeepStock Web", "CribMaster", "GVEND", "ServiceNow", "ClearSpider", "Cradlepoint", "Maintenance Request Form (MRF)", "Jaggaer", "Punch Out"]) {
    assert.match(once, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("Deepgram keyterms include high-value glossary terminology and stay below the platform cap", () => {
  assert.ok(DEEPGRAM_KEYTERMS.length <= 100);
  for (const term of ["KeepStock", "KSHD", "OSR", "CribMaster", "GVEND", "MRF", "PRF", "Jaggaer", "Cradlepoint", "ServiceNow", "RPO", "OHB"]) {
    assert.ok(DEEPGRAM_KEYTERMS.includes(term), `missing keyterm ${term}`);
  }
});

test("glossary support roles improve caller-role detection without defaulting all calls to customer", () => {
  assert.equal(inferCallerRole("OSR called because the machine is offline."), "rep");
  assert.equal(inferCallerRole("Caller is an OSS and needs help with GVEND."), "rep");
  assert.equal(inferCallerRole("Cust caller needs help with KeepStock Web."), "customer");
  assert.equal(inferCallerRole("The user cannot log in and I am checking the account."), "caller");
});

test("historical MobileCast pattern preserves separate guidance details and a completed rep outcome", () => {
  const analysis = analyzeLocally("OSR has a new phone and needs to sign into Mobile Cast. Advised their Device ID is their 10 digit phone number. ID is their RACK ID in caps. No password. Mobile Cast sign in completed successfully.");
  assert.equal(analysis.callerRole, "rep");
  const combined = analysis.troubleshootingSteps.join(" ");
  assert.match(combined, /10 digit phone number/i);
  assert.match(combined, /RACK ID/i);
  assert.match(combined, /No password/i);
  assert.match(analysis.resolution, /Rep signed into Mobile Cast successfully/i);
});

test("historical MRF pattern distinguishes the form from a parts-request link and avoids claiming future data changes", () => {
  const analysis = analyzeLocally("OSR needed to complete an MRF to mass update and assign users to the KeepStock program. Provided the Maintenance Request Form URL. OSR completed the MRF.");
  assert.equal(analysis.callerRole, "rep");
  assert.match(analysis.resolution, /Maintenance Request Form \(MRF\) link/i);
  assert.match(analysis.resolution, /MRF was completed/i);
  assert.doesNotMatch(analysis.resolution, /users (?:were|are) mass assigned/i);
});

test("historical network diagnostic pattern stays high recall", () => {
  const notes = "Caller is an OSR. Ran ipconfig and confirmed default gateway 10.115.40.1. Pinged 10.115.40.1 and destination host unreachable. Pinged google.com and the host could not be found. Opened Windows Device Manager. Uninstalled the Realtek PCIe GbE Family Controller. Scanned for hardware changes and Windows automatically reinstalled the device and drivers. Rep can now access Ethernet Properties to set the customer static IP information.";
  const analysis = analyzeLocally(notes);
  const combined = analysis.troubleshootingSteps.join(" ");
  for (const expected of ["ipconfig", "destination host unreachable", "Device Manager", "Uninstalled", "hardware changes", "Ethernet Properties"]) {
    assert.match(combined, new RegExp(expected, "i"));
  }
  assert.ok(analysis.troubleshootingSteps.length >= 6);
  assert.match(analysis.resolution, /can now access Ethernet Properties/i);
});

test("standalone Deepgram client carries the curated glossary keyterms", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../deepgram.js", import.meta.url), "utf8");
  for (const term of ["KSHD", "CribMaster", "GVEND", "MRF", "PRF", "Jaggaer", "Cradlepoint", "RPO", "OHB"]) {
    assert.match(source, new RegExp(`"${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(source, /params\.append\("keyterm", term\)/);
});
