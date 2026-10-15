const assert = require("node:assert/strict");
const { test } = require("node:test");
const tools = require("../public/assets/js/patient-result-tools.js");

const current = {
  id: 8, patientId: 14, status: "Released", testName: "CBC", releasedAt: "2026-08-10T10:00:00Z",
  findings: "Hemoglobin and platelet measurements were recorded.",
  values: [
    { parameter: "Hemoglobin", unit: "g/dL", value: "12.5", referenceRange: "12-16", flag: "Normal" },
    { parameter: "Platelets", unit: "10^9/L", value: "240", referenceRange: "150-400", flag: "Normal" },
  ],
};

test("only earlier released results for the same patient and test are comparable", () => {
  const candidates = [
    { id: 1, patientId: 14, status: "Released", testName: "CBC", releasedAt: "2026-07-10T10:00:00Z" },
    { id: 2, patientId: 99, status: "Released", testName: "CBC", releasedAt: "2026-07-10T10:00:00Z" },
    { id: 3, patientId: 14, status: "Verified", testName: "CBC", releasedAt: "2026-07-10T10:00:00Z" },
    { id: 4, patientId: 14, status: "Released", testName: "Chemistry", releasedAt: "2026-07-10T10:00:00Z" },
    { id: 5, patientId: 14, status: "Released", testName: "CBC", releasedAt: "2026-09-10T10:00:00Z" },
  ];
  assert.deepEqual(tools.comparableResults(current, candidates).map(item => item.id), [1]);
});

test("comparison aligns matching components and units without inventing missing values", () => {
  const previous = { values: [
    { parameter: "Hemoglobin", unit: "g/dL", value: "11.9", referenceRange: "12-16" },
    { parameter: "Platelets", unit: "10^3/uL", value: "220" },
  ] };
  const rows = tools.comparisonRows(current, previous);
  assert.equal(rows[0].difference, 0.5999999999999996);
  assert.equal(rows[1].previous, null);
  assert.equal(rows[2].current, null);
  assert.equal(rows[1].difference, null);
});

test("glossary draws from real report text without inventing an interpretation", () => {
  const terms = tools.matchingTerms(current);
  assert(terms.some(item => item.term === "hemoglobin"));
  assert(terms.some(item => item.term === "platelet"));
  assert(!terms.some(item => item.term === "glucose"));
});
