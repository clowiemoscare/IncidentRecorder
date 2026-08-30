import test from "node:test";
import assert from "node:assert/strict";
import { extractFields } from "../src/ticket/extractor.js";

test("account extraction preserves leading zero", () => {
  const fields = extractFields("Account number is 0888512630. The customer needs a tray harness.");
  assert.equal(fields.accountNumber, "0888512630");
});

test("manual values are not overwritten", () => {
  const fields = extractFields("Account number is 0888512630. Company name: New Company.", { accountNumber: "00001234", companyName: "Manual Company" });
  assert.equal(fields.accountNumber, "00001234");
  assert.equal(fields.companyName, "Manual Company");
});

test("Gen2 field extraction captures site, app, customer admin and storage fields", () => {
  const fields = extractFields(`Site Name: Stone Mountain\nAccount Number: 00872093141\nCurrent Task: Replenishment\nTime of Issue: 2:15 PM\nIOS Version: 18.5\nApp Version: 4.2.1\nCustomer Admin Name: Pat Smith\nCustomer Admin Email: pat@example.com\nBrowser: Edge\nStorage Unit: GV3-07\nRoot Cause: Knowledge gap\nIssue Type: Knowledge Gap\nWhy are we making changes to the data: Correct program assignment`);
  assert.equal(fields.siteName, "Stone Mountain");
  assert.equal(fields.accountNumber, "00872093141");
  assert.equal(fields.currentTask, "Replenishment");
  assert.equal(fields.iosVersion, "18.5");
  assert.equal(fields.appVersion, "4.2.1");
  assert.equal(fields.customerAdminEmail, "pat@example.com");
  assert.equal(fields.storageUnit, "GV3-07");
  assert.equal(fields.issueType, "Knowledge Gap");
});
