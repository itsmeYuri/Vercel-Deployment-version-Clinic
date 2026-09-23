"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "public/assets/js/main.js"), "utf8");
const api = fs.readFileSync(path.join(root, "api/index.php"), "utf8");
const shell = fs.readFileSync(path.join(root, "app/views/pages/app-shell.php"), "utf8");
const css = fs.readFileSync(path.join(root, "public/assets/css/styles.css"), "utf8");

for (const label of [
  "Laboratory Requests Today",
  "Pending Results",
  "Awaiting Verification",
  "Completed Results",
  "Critical Results",
  "Average Turnaround Time",
  "Recent Laboratory Results",
  "Laboratory Turnaround Time",
  "Laboratory Department Activity",
  "Requires Attention",
]) assert.match(main, new RegExp(label));

assert.doesNotMatch(main, /<h3 class="card-title">Laboratory Workflow<\/h3>/);
assert.doesNotMatch(main, /<h3 class="card-title">Quick Actions<\/h3>/);

assert.match(main, /dashboard: role === "Admin" \? \["users", "facilities", "tests", "orders", "results", "notifications", "audit"\]/);
assert.match(api, /'dashboard' => \$role === 'Admin' \? \['users', 'facilities', 'tests', 'orders', 'results', 'notifications', 'audit'\]/);
assert.match(shell, /Search patients, laboratory requests, results\.\.\./);
assert.match(main, /criticalValues\(result\)/);
assert.match(main, /data-admin-turnaround-period/);
assert.match(css, /@media \(max-width: 620px\)/);

console.log("Admin laboratory dashboard contract tests passed.");
