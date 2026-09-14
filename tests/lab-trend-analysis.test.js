"use strict";

const assert = require("node:assert/strict");
const trends = require("../public/assets/js/lab-trend-analysis.js");

const orders = [
  { id: 1, facilityName: "Central Lab", tests: "CBC, Glucose", createdAt: "2026-06-01 08:00:00" },
  { id: 2, facilityName: "North Lab", tests: "CBC", createdAt: "2026-06-02 09:00:00" },
  { id: 3, facilityName: "Central Lab", tests: "Urinalysis", createdAt: "2026-06-10 10:00:00" },
];
const results = [
  { id: 1, facilityName: "Central Lab", testName: "CBC, Glucose", status: "Released", createdAt: "2026-06-01 08:30:00", releasedAt: "2026-06-01 10:00:00", values: [{ parameter: "WBC", value: "12", flag: "High" }, { parameter: "Glucose", value: "40", flag: "Critical" }] },
  { id: 2, facilityName: "North Lab", testName: "CBC", status: "Released", createdAt: "2026-06-02 09:30:00", releasedAt: "2026-06-02 10:00:00", values: [{ parameter: "WBC", value: "3", flag: "Low" }] },
  { id: 3, facilityName: "Central Lab", testName: "Urinalysis", status: "Pending Review", createdAt: "2026-06-10 10:30:00", releasedAt: null, values: [{ parameter: "", value: "7", flag: "" }] },
];

const analysis = trends.build(orders, results, { from: "2026-06-01", to: "2026-06-10", group: "day" });
assert.equal(analysis.totals.tests, 4);
assert.equal(analysis.totals.results, 3);
assert.equal(analysis.totals.averageTurnaroundMinutes, 60);
assert.equal(analysis.totals.flaggedValues, 4);
assert.deepEqual(analysis.flags.map((row) => row.count), [1, 1, 1, 1]);
assert.deepEqual(analysis.workload.map((row) => [row.facility, row.tests]), [["Central Lab", 3], ["North Lab", 1]]);

const filtered = trends.build(orders, results, { from: "2026-06-01", to: "2026-06-30", group: "week", facility: "Central Lab", test: "CBC" });
assert.equal(filtered.totals.tests, 2);
assert.equal(filtered.totals.results, 1);
assert.equal(filtered.workload.length, 1);
assert.equal(filtered.buckets[0].averageTurnaroundMinutes, 90);
assert.equal(trends.flagCategory({ parameter: "WBC", value: "12", flag: "Priority" }), "Critical Value");

console.log("Laboratory trend analysis tests passed.");
