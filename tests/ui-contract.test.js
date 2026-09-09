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
const vercelConfig = JSON.parse(read("vercel.json"));
const vercelRouter = read("api/vercel.php");

assert.match(main, /data-add-result-parameter/);
assert.match(main, /data-remove-result-parameter/);
assert.match(main, /application\/pdf/);
assert.match(main, /data-rotate-result-image/);
assert.match(main, /data-remove-result-source/);
assert.match(main, /data-include-result-source/);
assert.match(main, /OCR confidence/);
assert.match(main, /startNotificationPolling/);
assert.match(main, /glassDialog/);
assert.match(main, /type="button" data-drawer="result" data-id="\$\{result\.id\}">Review<\/button>/);
assert.match(main, /PAGE_CACHE_TTL/);
assert.match(main, /pageRequests: new Map\(\)/);
assert.match(main, /aria-current/);
assert.match(main, /function trapDrawerFocus/);
assert.match(main, /role="button" tabindex="0" aria-label="Open notification/);
assert.match(css, /\.maintenance-module-grid/);
assert.match(css, /@media \(max-width: 620px\)/);
assert.doesNotMatch(css, /Full Glassmorphism Theme/);
assert.doesNotMatch(css, /\.demo-login\s*\{/);
assert.doesNotMatch(shell, /\['section' => 'My account'\]/);
assert.doesNotMatch(register, /Secure &amp; Private|All in One Place|Stay Informed/);
assert.doesNotMatch(footer, /vendor\/tesseract\/tesseract\.min\.js/);
assert.match(envExample, /URL_ENCODED_DATABASE_PASSWORD/);
assert.doesNotMatch(envExample, /postgresql:\/\/[^:\s]+:[^@\s]+@(?:db\.|aws-)/);
assert.doesNotMatch(envExample, /eyJhbGciOi/);
assert.match(vercelRouter, /str_starts_with\(\$relative, 'public\/'\)/);
assert.match(vercelRouter, /realpath\(\$publicRoot \. '\/' \. \$relative\)/);
assert.equal(vercelConfig.routes.filter((route) => route.src === "/assets/(.*)").length, 1);

console.log("UI contract tests passed.");
