"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "public/assets/js/main.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public/assets/css/styles.css"), "utf8");
const shell = fs.readFileSync(path.join(root, "app/views/pages/app-shell.php"), "utf8");

for (const label of [
  "Critical Results",
  "Recent Patient Results",
  "Priority Work Queue",
  "Awaiting Verification",
  "Specimen Issues",
  "Current Request Status",
  "Available Results",
  "Required Actions",
  "Recent Laboratory Requests",
]) assert.match(main, new RegExp(label));

assert.doesNotMatch(main, /My Request Workflow/);
assert.doesNotMatch(main, />Quick Actions</);
assert.doesNotMatch(main, /renderLabOperations|Assigned Operations/);
assert.doesNotMatch(shell, /Assigned Operations/);
assert.match(main, /function renderFacilities/);
assert.match(main, /function renderDoctorFacilities/);
assert.match(main, /function renderLabFacilities/);
assert.match(main, /Facility Details|Save Facility/);
assert.match(shell, /'label' => 'Facilities'/);
assert.match(shell, /'label' => 'Assigned Facilities'/);
assert.equal(fs.existsSync(path.join(root, "public/admin/facilities.php")), true);
assert.equal(fs.existsSync(path.join(root, "public/doctor/facilities.php")), true);
assert.equal(fs.existsSync(path.join(root, "public/laboratory/facilities.php")), true);

assert.match(main, /function renderDoctorDashboard/);
assert.match(main, /function renderLabDashboard/);
assert.match(main, /function renderPatientDashboard/);
assert.match(main, /function filteredTable/);
assert.match(main, /Patients with laboratory activity, shown before their results/);
assert.match(main, /Requests available for result upload", "Search request, patient, or test"/);
assert.match(main, /class="upload-queue-section"/);
assert.match(css, /\.upload-layout \.upload-panel \{ position: static;/);
assert.match(main, /goPage: "facilities"/);
assert.match(main, /goPage: "tests"/);
assert.match(main, /table-filter-scope/);
assert.match(main, /function sortTable/);
assert.match(main, /data-table-sort/);
assert.match(main, /aria-sort="none"/);
assert.match(css, /\.table-sort/);
assert.match(css, /\.role-dashboard-stats/);
assert.match(css, /\.patient-progress/);
assert.match(css, /@media \(max-width: 620px\)/);

console.log("Role dashboard contract tests passed.");
