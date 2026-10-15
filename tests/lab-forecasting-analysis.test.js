const assert = require("node:assert/strict");
const { test } = require("node:test");
const forecast = require("../public/assets/js/lab-forecasting-analysis.js");

test("forecast begins after today even when the newest request is stale", () => {
  const result = forecast.build([{ createdAt: "2026-01-01 09:00:00", patientId: 1, testIds: [1] }], { asOf: "2026-10-15", horizon: 7 });
  assert.equal(result.asOf, "2026-10-15");
  assert.equal(result.forecast[0].date, "2026-10-16");
  assert.equal(result.historicalRequests, 0);
});

test("requests from today count even when their time is after midnight", () => {
  const result = forecast.build([{ createdAt: "2026-10-15 14:30:00", patientId: 1, testIds: [1, 2] }], { asOf: "2026-10-15" });
  assert.equal(result.historicalRequests, 1);
  assert.equal(result.trainingDays, 1);
});
