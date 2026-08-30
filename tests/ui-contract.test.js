import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "src/ui/app.js"), "utf8");

test("Category and Subcategory are required controls", () => {
  assert.match(html, /<select id="newCategory" required/);
  assert.match(html, /<select id="newSubcategory" required/);
});

test("Reset template validates routing and offers both master templates", () => {
  assert.match(app, /resetDetailedTemplate\(\)[\s\S]*ensureRoutingSelected\(\)/);
  assert.match(html, /id="chooseStandardTemplateBtn"/);
  assert.match(html, /id="chooseGen2TemplateBtn"/);
});

test("Rough Notes is configured at twice the interim minimum height", () => {
  const css = fs.readFileSync(path.join(root, "styles/recorder.css"), "utf8");
  assert.match(css, /\.interim \{ min-height: 48px; \}/);
  assert.match(css, /#newRawNotes \{ min-height: 96px; height: 96px;/);
});
