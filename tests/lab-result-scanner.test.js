"use strict";

const assert = require("node:assert/strict");
const scanner = require("../public/assets/js/lab-result-scanner.js");

const cbc = scanner.parse(`
WBC 7.1 x10^9/L 4.5 - 11.0
Hemoglobin 11.2 g/dL 12.0-16.0 L
Platelet Count 250 x10^9/L 150-400
CRP 18 mg/L 0-5 High
`);

assert.equal(cbc.values.length, 4);
assert.deepEqual(cbc.values[0], {
  parameter: "WBC",
  value: "7.1",
  unit: "x10^9/L",
  referenceRange: "4.5-11.0",
  flag: "Normal",
  sourceLine: "WBC 7.1 x10^9/L 4.5 - 11.0",
});
assert.equal(cbc.values.find((row) => row.parameter === "Hemoglobin").flag, "Low");
assert.equal(cbc.values.find((row) => row.parameter === "Platelets").value, "250");
assert.equal(cbc.values.find((row) => row.parameter === "CRP").flag, "High");
assert.equal(cbc.values.find((row) => row.parameter === "CRP").unit, "mg/L");

const chemistry = scanner.parse(`
FASTING BLOOD SUGAR: 126 mg/dL Reference 70 - 110 H
Creatinine 0.9 mg/dL 0.6-1.2
ALT/SGPT 34 U/L 0-41
`);

assert.equal(chemistry.values.length, 3);
assert.equal(chemistry.values[0].parameter, "Glucose");
assert.equal(chemistry.values[0].flag, "High");
assert.equal(chemistry.values[1].referenceRange, "0.6-1.2");
assert.equal(chemistry.values[2].unit, "U/L");

assert.deepEqual(scanner.parse("Patient: Example\nNo analyte values detected").values, []);
assert.equal(scanner.inferredFlag("3.2", "4.0-5.5"), "Low");

const ocrPunctuation = scanner.parse('WBC 7.1 x10"9/L 4.5-11.0');
assert.equal(ocrPunctuation.values[0].unit, "x10^9/L");

const reportLayout = scanner.parse(`
FINDINGS SUMMARY
Complete blood count values are within the expected ranges.
REMARKS
Specimen received in acceptable condition.
RESULT VALUES
PARAMETER VALUE UNIT REFERENCE RANGE FLAG
WBC 6.8 x10^9/L 4.0 - 11.0 Normal
TSH 2.1 mIU/L 0.4 - 4.0 Normal
PERFORMED BY
Medical Technologist
`);
assert.equal(reportLayout.findings, "Complete blood count values are within the expected ranges.");
assert.equal(reportLayout.remarks, "Specimen received in acceptable condition.");
assert.equal(reportLayout.values.find((row) => row.parameter === "WBC").value, "6.8");
assert.equal(reportLayout.values.find((row) => row.parameter === "TSH").referenceRange, "0.4-4.0");

const qualitative = scanner.parse(`
Pregnancy Test Negative
Hepatitis B Surface Antigen Non-reactive
SARS-CoV-2 Detected
`);
assert.equal(qualitative.values.length, 3);
assert.equal(qualitative.values[0].value, "Negative");
assert.equal(qualitative.values[0].flag, "Normal");
assert.equal(qualitative.values[1].value, "Non-reactive");
assert.equal(qualitative.values[2].flag, "Abnormal");

console.log("Lab result scanner parser tests passed.");
