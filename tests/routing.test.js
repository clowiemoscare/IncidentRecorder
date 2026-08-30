import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryLabel,
  defaultCategoryId,
  getCategory,
  templateKindFor,
  resolveCategoryId,
  verifyFieldIdsFor
} from "../src/config/ticket-routing.js";

const cases = [
  ["keepstock_onsite", "onsite_web_access", "onsite"],
  ["keepstock_canada_onsite", "canada_mrf_required", "onsite"],
  ["keepstock_seaga_cm", "machine_main_harness", "machine"],
  ["keepstock_cm_pc_data", "cm_network_cellular", "pc_data"],
  ["keepstock_cm_pc_data", "cm_badge_existing", "pc_data"],
  ["keepstock_seaga_pc_data", "seaga_network_cellular", "pc_data"],
  ["keepstock_gcom_mobile_app", "gcom_cart", "gcom_app"],
  ["keepstock_gen2_onsite_mobile_app", "gen2_onsite_mobile_other", "gen2_onsite_mobile_app"],
  ["keepstock_gen2_web_customer", "gen2_web_customer_other", "gen2_web_customer"],
  ["keepstock_gen2_workstation", "gen2_workstation_access_login", "gen2_workstation"],
  ["keepstock_gen2_gvend3", "gen2_gvend3_other", "gen2_gvend3"]
];

for (const [category, subcategory, expected] of cases) {
  test(`routing ${category}/${subcategory} -> ${expected}`, () => {
    assert.equal(templateKindFor(category, subcategory), expected);
  });
}

test("fresh workspaces require explicit category selection", () => {
  assert.equal(defaultCategoryId(), "");
});

test("GCOM category uses the requested label", () => {
  assert.equal(categoryLabel("keepstock_gcom_mobile_app"), "Keepstock - GCOM App");
});

test("legacy GCOM Mobile App label migrates to the GCOM App route", () => {
  assert.equal(resolveCategoryId("Keepstock - GCOM Mobile App"), "keepstock_gcom_mobile_app");
});

test("legacy machine categories migrate to combined Seaga/CM route", () => {
  assert.equal(resolveCategoryId("Keepstock - CM - Locker"), "keepstock_seaga_cm");
});

test("Onsite verify fields show identity only", () => {
  assert.deepEqual(verifyFieldIdsFor("keepstock_onsite"), ["cribProgramId", "programName", "companyName", "siteId", "accountNumber"]);
});

test("Seaga/CM verify fields add machine values only", () => {
  const fields = verifyFieldIdsFor("keepstock_seaga_cm");
  for (const id of ["cribProgramId", "programName", "companyName", "siteId", "accountNumber", "softwareVersion", "deviceId", "machineSerial"]) assert.ok(fields.includes(id));
  assert.ok(!fields.includes("cradlepointSerial"));
  assert.ok(!fields.includes("phoneModel"));
});

test("PC/Data verify fields include network and badge values but not phone fields", () => {
  const fields = verifyFieldIdsFor("keepstock_cm_pc_data");
  for (const id of ["softwareVersion", "deviceId", "machineSerial", "cradlepointSerial", "imei", "carrier", "badgeReader", "model"]) assert.ok(fields.includes(id));
  assert.ok(!fields.includes("phoneModel"));
});

test("GCOM verify fields include phone/app fields", () => {
  const fields = verifyFieldIdsFor("keepstock_gcom_mobile_app");
  for (const id of ["phoneModel", "phoneSoftwareVersion", "application", "applicationVersion", "timeIssueOccurred"]) assert.ok(fields.includes(id));
  assert.ok(!fields.includes("machineSerial"));
});

test("Gen2 categories expose only their relevant data-entry fields", () => {
  const onsite = verifyFieldIdsFor("keepstock_gen2_onsite_mobile_app");
  assert.ok(onsite.includes("currentTask"));
  assert.ok(onsite.includes("iosVersion"));
  assert.ok(!onsite.includes("customerAdminEmail"));

  const web = verifyFieldIdsFor("keepstock_gen2_web_customer");
  assert.ok(web.includes("customerAdminEmail"));
  assert.ok(web.includes("browser"));
  assert.ok(!web.includes("storageUnit"));

  const gvend = verifyFieldIdsFor("keepstock_gen2_gvend3");
  assert.ok(gvend.includes("storageUnit"));
  assert.ok(gvend.includes("customerAdminEmail"));
});


test("Gen2 subcategories match the uploaded category source", () => {
  const labels = (categoryId) => getCategory(categoryId).subcategories.map((item) => item.label);
  assert.deepEqual(labels("keepstock_gen2_onsite_mobile_app"), [
    "Check-In/Check-Out", "Digital Storage Connect", "Go-Live Install", "OKTA Access/Login", "On-Hand Balance",
    "Open Stock", "Order Viewer", "Organize Shipment", "RPO-Approve updates", "RPO-Item Quantity", "RPO-Other",
    "RPO-Review/Submit", "Storages", "Task Plan", "Training", "User Management", "Other"
  ]);
  assert.deepEqual(labels("keepstock_gen2_web_customer"), ["Access/Log-in", "Customer Training", "Insights", "System", "Vend History", "Other"]);
  assert.deepEqual(labels("keepstock_gen2_workstation"), ["Access/Login", "Billing Group", "Item Update", "Site Status", "Storage Unit", "User Management", "Other"]);
  assert.deepEqual(labels("keepstock_gen2_gvend3"), [
    "Hardware Issue - Aux Board", "Hardware Issue - Main Board", "Hardware Issue - Relay Board", "Hardware Issue - Drop Sensor",
    "Hardware Issue - Dual Coil Gears", "Hardware Issue - Motors", "Hardware Issue - Power Supply", "Hardware Issue - Tray",
    "Hardware Issue - Main Harness", "Machine Replacement", "Physical Damage", "Product Sizing", "Hardware Issue - Door Issue",
    "Hardware Issue - Door Actuator", "Other"
  ]);
  for (const categoryId of ["keepstock_gen2_onsite_mobile_app", "keepstock_gen2_web_customer", "keepstock_gen2_workstation", "keepstock_gen2_gvend3"]) {
    assert.ok(!labels(categoryId).some((label) => /none/i.test(label)), "required subcategory list should not include a None option");
  }
});

test("Gen2 Workstation exposes only workstation and closing fields", () => {
  const fields = verifyFieldIdsFor("keepstock_gen2_workstation");
  for (const id of ["siteName", "accountNumber", "timeIssueOccurred", "screenshot", "rootCause", "issueType", "whyDataChanges"]) assert.ok(fields.includes(id));
  assert.ok(!fields.includes("currentTask"));
  assert.ok(!fields.includes("customerAdminEmail"));
  assert.ok(!fields.includes("storageUnit"));
});
