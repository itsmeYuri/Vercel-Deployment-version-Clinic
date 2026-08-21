(function (root, factory) {
  "use strict";
  const forecasting = factory();
  if (typeof module === "object" && module.exports) module.exports = forecasting;
  if (root) root.LabForecastingAnalysis = forecasting;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DAY_MS = 86400000;
  const pad = (value) => String(value).padStart(2, "0");
  const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const dayOnly = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const addDays = (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  function parseDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!match) return null;
    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function countTests(order) {
    if (Array.isArray(order.testIds) && order.testIds.length) return order.testIds.length;
    return String(order.tests || "").split(",").map((test) => test.trim()).filter(Boolean).length;
  }

  function weightedAverage(days, key) {
    let valueTotal = 0;
    let weightTotal = 0;
    days.forEach((day, index) => {
      const weight = 1 + index / Math.max(1, days.length - 1);
      valueTotal += day[key] * weight;
      weightTotal += weight;
    });
    return weightTotal ? valueTotal / weightTotal : 0;
  }

  function confidenceFor(trainingDays, requestCount) {
    if (trainingDays >= 90 && requestCount >= 100) return { level: "High", margin: 0.12 };
    if (trainingDays >= 42 && requestCount >= 30) return { level: "Medium", margin: 0.22 };
    return { level: "Low", margin: 0.4 };
  }

  function build(orders, options) {
    const horizon = [7, 30, 90].includes(Number(options?.horizon)) ? Number(options.horizon) : 7;
    const validOrders = (orders || []).map((order) => ({ order, created: parseDate(order.createdAt) })).filter((item) => item.created).sort((a, b) => a.created - b.created);
    const asOf = validOrders.length ? dayOnly(validOrders[validOrders.length - 1].created) : dayOnly(new Date());
    const earliest = validOrders.length ? dayOnly(validOrders[0].created) : asOf;
    const trainingStart = new Date(Math.max(earliest.getTime(), addDays(asOf, -89).getTime()));
    const history = [];
    const historyByDate = new Map();

    for (let cursor = trainingStart; cursor <= asOf; cursor = addDays(cursor, 1)) {
      const entry = { date: new Date(cursor), patients: new Set(), requests: 0, tests: 0 };
      history.push(entry);
      historyByDate.set(dateKey(cursor), entry);
    }
    validOrders.forEach(({ order, created }) => {
      const entry = historyByDate.get(dateKey(created));
      if (!entry) return;
      entry.requests += 1;
      entry.tests += countTests(order);
      const patient = order.patientId ?? order.patientCode ?? order.patientName;
      if (patient !== undefined && patient !== null && patient !== "") entry.patients.add(String(patient));
    });
    const training = history.map((entry) => ({ date: entry.date, patients: entry.patients.size, requests: entry.requests, tests: entry.tests }));
    const overall = {
      patients: weightedAverage(training, "patients"),
      requests: weightedAverage(training, "requests"),
      tests: weightedAverage(training, "tests"),
    };
    const weekday = Array.from({ length: 7 }, (_, day) => {
      const matching = training.filter((entry) => entry.date.getDay() === day);
      return {
        patients: matching.length >= 2 ? weightedAverage(matching, "patients") : overall.patients,
        requests: matching.length >= 2 ? weightedAverage(matching, "requests") : overall.requests,
        tests: matching.length >= 2 ? weightedAverage(matching, "tests") : overall.tests,
      };
    });
    const recent = training.slice(-14);
    const previous = training.slice(-28, -14);
    const recentAverage = weightedAverage(recent, "requests");
    const previousAverage = weightedAverage(previous, "requests");
    const trend = previous.length >= 7 && previousAverage > 0.05 ? clamp(recentAverage / previousAverage, 0.75, 1.25) : 1;
    const forecast = [];

    for (let index = 0; index < horizon; index += 1) {
      const date = addDays(asOf, index + 1);
      const trendAdjustment = 1 + (trend - 1) * ((index + 1) / horizon);
      const expected = weekday[date.getDay()];
      forecast.push({
        date: dateKey(date),
        label: date.toLocaleDateString(undefined, horizon === 7 ? { weekday: "short" } : { month: "short", day: "numeric" }),
        patients: Math.max(0, expected.patients * trendAdjustment),
        requests: Math.max(0, expected.requests * trendAdjustment),
        tests: Math.max(0, expected.tests * trendAdjustment),
      });
    }
    const historicalRequests = training.reduce((sum, day) => sum + day.requests, 0);
    const confidence = confidenceFor(training.length, historicalRequests);
    const rawTotals = forecast.reduce((totals, day) => ({ patients: totals.patients + day.patients, requests: totals.requests + day.requests, tests: totals.tests + day.tests }), { patients: 0, requests: 0, tests: 0 });
    const totals = {
      patients: Math.round(rawTotals.patients),
      requests: Math.round(rawTotals.requests),
      tests: Math.round(rawTotals.tests),
    };
    const peak = forecast.reduce((best, day) => !best || day.requests > best.requests ? day : best, null);
    return {
      horizon,
      asOf: dateKey(asOf),
      trainingStart: dateKey(trainingStart),
      trainingDays: training.length,
      historicalRequests,
      confidence: confidence.level,
      interval: {
        requestsLow: Math.max(0, Math.round(rawTotals.requests * (1 - confidence.margin))),
        requestsHigh: Math.round(rawTotals.requests * (1 + confidence.margin)),
      },
      totals,
      peak: peak ? { date: peak.date, label: peak.label, requests: peak.requests } : null,
      forecast,
      trend: trend > 1.03 ? "Increasing" : trend < 0.97 ? "Decreasing" : "Stable",
    };
  }

  return { build, parseDate, dateKey };
});
