(function (root, factory) {
  "use strict";
  const analytics = factory();
  if (typeof module === "object" && module.exports) module.exports = analytics;
  if (root) root.LabUtilizationAnalytics = analytics;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DAY_MS = 86400000;
  const pad = (value) => String(value).padStart(2, "0");
  const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const cloneDate = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const addDays = (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);

  function parseDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function latestOrderDate(orders) {
    return (orders || []).reduce((latest, order) => {
      const date = parseDate(order.createdAt);
      return date && (!latest || date > latest) ? date : latest;
    }, null) || new Date();
  }

  function rangeFor(period, anchorValue, fromValue, toValue) {
    const anchor = parseDate(anchorValue) || new Date();
    let start;
    let end;
    if (period === "day") {
      start = cloneDate(anchor);
      end = cloneDate(anchor);
    } else if (period === "week") {
      start = addDays(cloneDate(anchor), -((anchor.getDay() + 6) % 7));
      end = addDays(start, 6);
    } else if (period === "year") {
      start = new Date(anchor.getFullYear(), 0, 1);
      end = new Date(anchor.getFullYear(), 11, 31);
    } else if (period === "custom") {
      start = cloneDate(parseDate(fromValue) || anchor);
      end = cloneDate(parseDate(toValue) || start);
      if (start > end) [start, end] = [end, start];
    } else {
      start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    }
    return { start, end };
  }

  function bucketDefinitions(period, start, end) {
    const definitions = [];
    const days = Math.round((cloneDate(end) - cloneDate(start)) / DAY_MS) + 1;
    if (period === "day") {
      for (let hour = 0; hour < 24; hour += 3) {
        definitions.push({ start: new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour), end: new Date(start.getFullYear(), start.getMonth(), start.getDate(), hour + 3), label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? "am" : "pm"}` });
      }
    } else if (period === "year" || (period === "custom" && days > 180)) {
      let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        definitions.push({ start: new Date(cursor), end: next, label: cursor.toLocaleDateString(undefined, { month: "short" }) });
        cursor = next;
      }
    } else if (period === "custom" && days > 31) {
      let cursor = cloneDate(start);
      while (cursor <= end) {
        const next = addDays(cursor, 7);
        definitions.push({ start: new Date(cursor), end: next, label: cursor.toLocaleDateString(undefined, { month: "short", day: "numeric" }) });
        cursor = next;
      }
    } else {
      for (let cursor = cloneDate(start); cursor <= end; cursor = addDays(cursor, 1)) {
        definitions.push({ start: new Date(cursor), end: addDays(cursor, 1), label: period === "week" ? cursor.toLocaleDateString(undefined, { weekday: "short" }) : String(cursor.getDate()) });
      }
    }
    return definitions;
  }

  function testCount(order) {
    if (Array.isArray(order.testIds) && order.testIds.length) return order.testIds.length;
    return String(order.tests || "").split(",").map((test) => test.trim()).filter(Boolean).length;
  }

  function build(orders, options) {
    const settings = options || {};
    const period = ["day", "week", "month", "year", "custom"].includes(settings.period) ? settings.period : "month";
    const range = rangeFor(period, settings.anchor, settings.from, settings.to);
    const buckets = bucketDefinitions(period, range.start, range.end).map((definition) => ({ ...definition, patients: new Set(), requests: 0, tests: 0 }));
    const rangePatients = new Set();

    (orders || []).forEach((order) => {
      const created = parseDate(order.createdAt);
      if (!created || created < range.start || created >= addDays(range.end, 1)) return;
      const patientKey = order.patientId ?? order.patientCode ?? order.patientName;
      if (patientKey !== undefined && patientKey !== null && patientKey !== "") rangePatients.add(String(patientKey));
      const bucket = buckets.find((item) => created >= item.start && created < item.end);
      if (!bucket) return;
      bucket.requests += 1;
      bucket.tests += testCount(order);
      if (patientKey !== undefined && patientKey !== null && patientKey !== "") bucket.patients.add(String(patientKey));
    });

    const rows = buckets.map((bucket) => ({ label: bucket.label, patients: bucket.patients.size, requests: bucket.requests, tests: bucket.tests }));
    const requests = rows.reduce((sum, bucket) => sum + bucket.requests, 0);
    const tests = rows.reduce((sum, bucket) => sum + bucket.tests, 0);
    const totalDays = Math.max(1, Math.round((cloneDate(range.end) - cloneDate(range.start)) / DAY_MS) + 1);
    return {
      period,
      start: dateKey(range.start),
      end: dateKey(range.end),
      buckets: rows,
      totals: { patients: rangePatients.size, requests, tests, averageRequestsPerDay: requests / totalDays },
    };
  }

  return { build, latestOrderDate, parseDate, dateKey };
});
