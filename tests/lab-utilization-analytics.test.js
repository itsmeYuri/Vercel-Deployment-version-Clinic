"use strict";

const assert = require("assert");
const analytics = require("../public/assets/js/lab-utilization-analytics.js");

const orders = [
  { patientId: 1, createdAt: "2026-06-01 08:00:00", testIds: [1, 2], tests: "CBC, Urinalysis" },
  { patientId: 1, createdAt: "2026-06-01 10:00:00", testIds: [3], tests: "Glucose" },
  { patientId: 2, createdAt: "2026-06-02 14:30:00", tests: "CBC" },
  { patientId: 3, createdAt: "2026-07-01 09:00:00", tests: "Lipid Profile" },
];

const month = analytics.build(orders, { period: "month", anchor: "2026-06-15" });
assert.equal(month.start, "2026-06-01");
assert.equal(month.end, "2026-06-30");
assert.deepEqual(month.totals, { patients: 2, requests: 3, tests: 4, averageRequestsPerDay: 0.1 });
assert.deepEqual(month.buckets[0], { label: "1", patients: 1, requests: 2, tests: 3 });
assert.deepEqual(month.buckets[1], { label: "2", patients: 1, requests: 1, tests: 1 });

const day = analytics.build(orders, { period: "day", anchor: "2026-06-01" });
assert.equal(day.buckets.length, 8);
assert.deepEqual(day.totals, { patients: 1, requests: 2, tests: 3, averageRequestsPerDay: 2 });
assert.equal(day.buckets[2].requests, 1);
assert.equal(day.buckets[3].requests, 1);

const week = analytics.build(orders, { period: "week", anchor: "2026-06-03" });
assert.equal(week.start, "2026-06-01");
assert.equal(week.end, "2026-06-07");
assert.equal(week.buckets.length, 7);
assert.equal(week.totals.patients, 2);

const year = analytics.build(orders, { period: "year", anchor: "2026-01-01" });
assert.equal(year.buckets.length, 12);
assert.equal(year.totals.patients, 3);
assert.equal(year.totals.requests, 4);

const custom = analytics.build(orders, { period: "custom", anchor: "2026-06-01", from: "2026-07-02", to: "2026-06-01" });
assert.equal(custom.start, "2026-06-01");
assert.equal(custom.end, "2026-07-02");
assert.equal(custom.totals.patients, 3);
assert.equal(custom.totals.requests, 4);

assert.equal(analytics.dateKey(analytics.latestOrderDate(orders)), "2026-07-01");
console.log("Laboratory utilization analytics tests passed.");
