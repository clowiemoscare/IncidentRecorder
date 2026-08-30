import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractFields } from "../src/ticket/extractor.js";
import { analyzeLocally } from "../src/ticket/local-analyzer.js";
import { generateTicketModel } from "../src/ticket/generator.js";
import { GEN2_RESET_TEMPLATE, STANDARD_RESET_TEMPLATE, renderDetailedDescription } from "../src/ticket/templates.js";
import { subcategoryLabel } from "../src/config/ticket-routing.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(here, "fixtures", name), "utf8"));

test("tray harness ticket keeps leading-zero account and completed resolution", () => {
  const data = fixture("tray-harness.json");
  const fields = extractFields(data.roughNotes);
  const ticket = generateTicketModel({
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId,
    subcategoryLabel: subcategoryLabel(data.categoryId, data.subcategoryId),
    fields,
    analysis: data.analysis
  });
  assert.equal(ticket.shortDescription, "Acct #: 0888512630 | issue - Ordering new tray harness");
  assert.match(ticket.workNotes, /EL950/);
  assert.match(ticket.workNotes, /Provided the parts-request link via Teams/);
  assert.doesNotMatch(ticket.detailedDescription, /Software Version:/);
});

test("local machine fallback captures power, cable, power cycle and resolution", () => {
  const data = fixture("machine-communication.json");
  const analysis = analyzeLocally(data.roughNotes);
  const combined = analysis.troubleshootingSteps.join(" ");
  assert.match(combined, /both machines had power/i);
  assert.match(combined, /serial\/Molex cable/i);
  assert.match(combined, /Power cycled the PC/i);
  assert.match(analysis.resolution, /power cycling the PC|power cycled the PC/i);
});

test("conditional password reset stays conditional in local fallback", () => {
  const data = fixture("pepsi-access.json");
  const analysis = analyzeLocally(data.roughNotes);
  assert.ok(analysis.conditionalNextSteps.some((step) => /password reset/i.test(step)));
  assert.doesNotMatch(analysis.resolution, /password reset/i);
  assert.match(analysis.resolution, /Admin/i);
});

test("standard reset template matches the new full standard template", () => {
  assert.match(STANDARD_RESET_TEMPLATE, /Slack Thread URL:\n\nParent\/PRB Template:/);
  assert.match(STANDARD_RESET_TEMPLATE, /Acct #:\n\n\nSoftware Version:/);
  assert.match(STANDARD_RESET_TEMPLATE, /Cradlepoint Serial Number:\nIMEI:\nCarrier:/);
  assert.match(STANDARD_RESET_TEMPLATE, /Badge Reader:\nModel:/);
  assert.match(STANDARD_RESET_TEMPLATE, /Phone Model:\nPhone Software Version:/);
});

test("Gen2 reset template contains all four system blocks and closing fields", () => {
  for (const value of ["•Workstation:", "•Onsite App:", "•GVEND3:", "•KS WEB Customer:", "Root Cause:", "Issue Type:", "Why are we making changes to the data:"]) {
    assert.match(GEN2_RESET_TEMPLATE, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("GCOM detailed template contains phone/app fields without machine fields", () => {
  const detail = renderDetailedDescription({
    categoryId: "keepstock_gcom_mobile_app",
    subcategoryId: "gcom_cart",
    fields: { accountNumber: "001234", phoneModel: "iPhone", application: "KeepStock" }
  });
  assert.match(detail, /Phone Model: iPhone/);
  assert.match(detail, /Application: KeepStock/);
  assert.doesNotMatch(detail, /Machine Serial Number/);
});

test("PC Data detailed template contains machine, cellular and badge sections only", () => {
  const detail = renderDetailedDescription({
    categoryId: "keepstock_cm_pc_data",
    subcategoryId: "cm_network_cellular",
    fields: {}
  });
  assert.match(detail, /Machine Serial Number\(s\):/);
  assert.match(detail, /Cradlepoint Serial Number:/);
  assert.match(detail, /Badge Reader:/);
  assert.doesNotMatch(detail, /Phone Model:/);
});

test("Gen2 category templates keep only the requested systems", () => {
  const onsite = renderDetailedDescription({ categoryId: "keepstock_gen2_onsite_mobile_app", subcategoryId: "gen2_onsite_mobile_other", fields: {} });
  assert.match(onsite, /•Onsite App:/);
  assert.doesNotMatch(onsite, /•GVEND3:/);
  assert.doesNotMatch(onsite, /•KS WEB Customer:/);

  const web = renderDetailedDescription({ categoryId: "keepstock_gen2_web_customer", subcategoryId: "gen2_web_customer_other", fields: {} });
  assert.match(web, /•KS WEB Customer:/);
  assert.doesNotMatch(web, /•Onsite App:/);
  assert.doesNotMatch(web, /•GVEND3:/);

  const workstation = renderDetailedDescription({ categoryId: "keepstock_gen2_workstation", subcategoryId: "gen2_workstation_access_login", fields: {} });
  assert.match(workstation, /•Workstation:/);
  assert.doesNotMatch(workstation, /•Onsite App:/);
  assert.doesNotMatch(workstation, /•GVEND3:/);

  const gvend = renderDetailedDescription({ categoryId: "keepstock_gen2_gvend3", subcategoryId: "gen2_gvend3_other", fields: {} });
  assert.match(gvend, /•GVEND3:/);
  assert.match(gvend, /•KS WEB Customer:/);
});

test("Gen2 generated detailed description carries AI issue, troubleshooting and resolution", () => {
  const ticket = generateTicketModel({
    categoryId: "keepstock_gen2_onsite_mobile_app",
    subcategoryId: "gen2_onsite_mobile_other",
    subcategoryLabel: "other",
    fields: { siteName: "Test Site", accountNumber: "001234", currentTask: "Inventory" },
    analysis: {
      issueSummary: "Onsite app unable to load task",
      troubleshootingSteps: ["Confirmed the current task", "Restarted the app"],
      conditionalNextSteps: [],
      resolution: "App loaded after restart",
      accountNumber: "001234"
    }
  });
  assert.match(ticket.detailedDescription, /Issue: Onsite app unable to load task/);
  assert.match(ticket.detailedDescription, /- Confirmed the current task/);
  assert.match(ticket.detailedDescription, /Resolution: App loaded after restart/);
});

test("Create User workflow keeps all training actions and the training resolution", () => {
  const data = fixture("create-user.json");
  const ticket = generateTicketModel({
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId,
    subcategoryLabel: subcategoryLabel(data.categoryId, data.subcategoryId),
    fields: {},
    analysis: data.analysis
  });
  for (const expected of ["Grainger.com", "User & Group Management", "Create User", "required user prompts", "Assigned the required programs"]) {
    assert.match(ticket.workNotes, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(ticket.workNotes, /trained on creating a new user/i);
});

test("battery dispensing workflow does not collapse distinct troubleshooting steps", () => {
  const data = fixture("battery-limit.json");
  const ticket = generateTicketModel({
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId,
    subcategoryLabel: subcategoryLabel(data.categoryId, data.subcategoryId),
    fields: { cribProgramId: "218-126", programName: "Joya corporate HQ" },
    analysis: data.analysis
  });
  const bullets = ticket.workNotes.split("\n").filter((line) => line.startsWith("- "));
  assert.equal(bullets.length, 10);
  assert.match(ticket.workNotes, /1 per week/i);
  assert.match(ticket.workNotes, /4 per week/i);
  assert.match(ticket.workNotes, /resets after one week/i);
  assert.match(ticket.workNotes, /retesting dispensing/i);
});
