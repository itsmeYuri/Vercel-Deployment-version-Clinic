"use strict";

const assert = require("assert");
const forecasting = require("../public/assets/js/lab-forecasting-analysis.js");

const orders = [];
for (let day = 1; day <= 56; day += 1) {
  const date = new Date(2026, 0, day);
  if (date.getDay() === 1) {
    orders.push({ patientId: day, createdAt: `${forecasting.dateKey(date)} 08:00:00`, testIds: [1, 2] });
    orders.push({ patientId: day + 100, createdAt: `${forecasting.dateKey(date)} 10:00:00`, testIds: [1] });
  }
}

const week = forecasting.build(orders, { horizon: 7 });
assert.equal(week.horizon, 7);
assert.equal(week.forecast.length, 7);
assert.equal(week.asOf, "2026-02-23");
assert.equal(week.forecast.filter((day) => day.requests > 0).length, 1);
assert(week.totals.requests >= 1 && week.totals.requests <= 3);
assert.equal(week.peak.date, "2026-03-02");
assert.equal(week.confidence, "Low");
assert(week.interval.requestsLow <= week.totals.requests);
assert(week.interval.requestsHigh >= week.totals.requests);

const month = forecasting.build(orders, { horizon: 30 });
assert.equal(month.forecast.length, 30);
assert(month.totals.tests >= month.totals.requests);

const empty = forecasting.build([], { horizon: 90 });
assert.equal(empty.forecast.length, 90);
assert.deepEqual(empty.totals, { patients: 0, requests: 0, tests: 0 });
assert.equal(empty.confidence, "Low");
console.log("Laboratory forecasting analysis tests passed.");
