"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const main = read("public/assets/js/main.js");
const css = read("public/assets/css/styles.css");
const shell = read("app/views/pages/app-shell.php");
const register = read("public/auth/register.php");
const footer = read("app/views/layouts/footer.php");
const envExample = read(".env.example");

assert.match(main, /data-add-result-parameter/);
assert.match(main, /data-remove-result-parameter/);
assert.match(main, /application\/pdf/);
assert.match(main, /data-rotate-result-image/);
assert.match(main, /data-remove-result-source/);
assert.match(main, /data-include-result-source/);
assert.match(main, /OCR confidence/);
assert.match(main, /startNotificationPolling/);
assert.match(main, /glassDialog/);
assert.match(css, /\.maintenance-module-grid/);
assert.match(css, /@media \(max-width: 620px\)/);
assert.doesNotMatch(shell, /\['section' => 'My account'\]/);
assert.doesNotMatch(register, /Secure &amp; Private|All in One Place|Stay Informed/);
assert.doesNotMatch(footer, /vendor\/tesseract\/tesseract\.min\.js/);
assert.match(envExample, /URL_ENCODED_DATABASE_PASSWORD/);
assert.doesNotMatch(envExample, /postgresql:\/\/[^:\s]+:[^@\s]+@(?:db\.|aws-)/);
assert.doesNotMatch(envExample, /eyJhbGciOi/);

console.log("UI contract tests passed.");
