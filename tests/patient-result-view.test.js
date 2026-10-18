const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const PatientResultTools = require("../public/assets/js/patient-result-tools.js");

const source = readFileSync(join(__dirname, "../public/assets/js/main.js"), "utf8");
const start = source.indexOf("  function patientStatusIcon(key) {");
const end = source.indexOf("  function chartFromCounts(counts) {", start);
assert(start !== -1 && end > start, "Patient measurement renderer is present");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&#39;" }[char]));
const render = new Function("window", "h", `${source.slice(start, end)}\nreturn patientValues;`)(
  { PatientResultTools }, escapeHtml
);

test("the real patient renderer shows approved directions and keeps unapproved legacy results neutral", () => {
  const rule = { type: "numeric", minimum: 12, maximum: 16 };
  const markup = render([
    { parameter: "Hemoglobin", value: "11.2", unit: "g/dL", referenceRange: "12-16", flag: "Low", validationRule: rule },
    { parameter: "Hematocrit", value: "38", unit: "%", referenceRange: "36-46", flag: "Normal", validationRule: { type: "numeric" } },
    { parameter: "WBC", value: "13200", unit: "cells/uL", referenceRange: "4500-11000", flag: "Normal", validationRule: null,
      validationReason: "Format checks passed. No approved parameter rule is configured." },
    { parameter: "Screen", value: "Positive", unit: "1", referenceRange: "Positive, Negative", flag: "Normal", validationRule: { type: "text" } },
  ]);
  assert.match(markup, /patient-measurement--low/);
  assert.match(markup, /Below reference range/);
  assert.match(markup, /patient-measurement--within/);
  assert.match(markup, /patient-measurement--unassessed/);
  assert.match(markup, /13,200/);
  assert.match(markup, /4,500-11,000/);
  assert.match(markup, /cells per microliter/);
  assert.match(markup, /patient-measurement--reported/);
  assert.doesNotMatch(markup, /Positive, Negative 1/);
  assert.doesNotMatch(markup, /Format checks passed/);
});

test("the patient renderer escapes laboratory-supplied content", () => {
  const markup = render([{ parameter: '<img src=x onerror=alert(1)>', value: '12', unit: 'g/dL', referenceRange: '<12', flag: 'Normal' }]);
  assert.doesNotMatch(markup, /<img/);
  assert.match(markup, /&lt;img/);
  assert.match(markup, /&lt;12/);
});
