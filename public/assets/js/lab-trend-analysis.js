(function (root, factory) {
  "use strict";
  const analysis = factory();
  if (typeof module === "object" && module.exports) module.exports = analysis;
  if (root) root.LabTrendAnalysis = analysis;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DAY_MS = 86400000;
  const pad = (value) => String(value).padStart(2, "0");
  const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const dayOnly = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const addDays = (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);

  function parseDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function splitTests(record) {
    return String(record.tests || record.testName || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  }

  function flagCategory(value) {
    const flag = String(value?.flag || "").trim().toLowerCase();
    if (["high", "above", "above reference range"].includes(flag)) return "Above Reference Range";
    if (["low", "below", "below reference range"].includes(flag)) return "Below Reference Range";
    if (["critical", "critical value", "priority"].includes(flag)) return "Critical Value";
    if (!String(value?.parameter || "").trim() || !String(value?.value || "").trim() || flag === "invalid") return "Invalid Entry";
    return null;
  }

  function bucketStart(date, group) {
    const day = dayOnly(date);
    if (group === "week") return addDays(day, -((day.getDay() + 6) % 7));
    if (group === "month") return new Date(day.getFullYear(), day.getMonth(), 1);
    return day;
  }

  function nextBucket(date, group) {
    if (group === "week") return addDays(date, 7);
    if (group === "month") return new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return addDays(date, 1);
  }

  function labelFor(date, group) {
    if (group === "month") return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    if (group === "week") return `Week of ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function build(orders, results, options) {
    const settings = options || {};
    const group = ["day", "week", "month"].includes(settings.group) ? settings.group : "day";
    const datedRecords = [...(orders || []), ...(results || [])].map((record) => parseDate(record.createdAt)).filter(Boolean);
    const latest = datedRecords.sort((a, b) => a - b).at(-1) || new Date();
    let start = dayOnly(parseDate(settings.from) || addDays(latest, -29));
    let end = dayOnly(parseDate(settings.to) || latest);
    if (start > end) [start, end] = [end, start];
    const facility = String(settings.facility || "");
    const test = String(settings.test || "");
    const inRange = (date) => date && date >= start && date < addDays(end, 1);
    const matches = (record) =>
      (!facility || String(record.facilityName || "") === facility) &&
      (!test || splitTests(record).includes(test));
    const scopedOrders = (orders || []).filter((order) => inRange(parseDate(order.createdAt)) && matches(order));
    const scopedResults = (results || []).filter((result) => inRange(parseDate(result.createdAt)) && matches(result));

    const buckets = [];
    for (let cursor = bucketStart(start, group); cursor <= end; cursor = nextBucket(cursor, group)) {
      buckets.push({ key: dateKey(cursor), label: labelFor(cursor, group), tests: 0, turnaroundTotal: 0, turnaroundCount: 0, flags: 0 });
    }
    const findBucket = (date) => buckets.find((bucket, index) => {
      const from = parseDate(bucket.key);
      const to = buckets[index + 1] ? parseDate(buckets[index + 1].key) : nextBucket(from, group);
      return date >= from && date < to;
    });
    scopedOrders.forEach((order) => {
      const bucket = findBucket(parseDate(order.createdAt));
      if (bucket) bucket.tests += splitTests(order).length;
    });

    const flagTotals = { "Above Reference Range": 0, "Below Reference Range": 0, "Critical Value": 0, "Invalid Entry": 0 };
    scopedResults.forEach((result) => {
      const created = parseDate(result.createdAt);
      const bucket = findBucket(created);
      const released = parseDate(result.releasedAt);
      if (bucket && released && released >= created) {
        bucket.turnaroundTotal += (released - created) / 60000;
        bucket.turnaroundCount += 1;
      }
      (result.values || []).forEach((value) => {
        const category = flagCategory(value);
        if (!category) return;
        flagTotals[category] += 1;
        if (bucket) bucket.flags += 1;
      });
    });

    const workloadMap = new Map();
    scopedOrders.forEach((order) => {
      const name = order.facilityName || "Unassigned facility";
      const row = workloadMap.get(name) || { facility: name, requests: 0, tests: 0, releasedResults: 0 };
      row.requests += 1;
      row.tests += splitTests(order).length;
      workloadMap.set(name, row);
    });
    scopedResults.filter((result) => result.status === "Released").forEach((result) => {
      const name = result.facilityName || "Unassigned facility";
      const row = workloadMap.get(name) || { facility: name, requests: 0, tests: 0, releasedResults: 0 };
      row.releasedResults += 1;
      workloadMap.set(name, row);
    });

    const measured = buckets.reduce((sum, bucket) => sum + bucket.turnaroundCount, 0);
    const minutes = buckets.reduce((sum, bucket) => sum + bucket.turnaroundTotal, 0);
    return {
      filters: { from: dateKey(start), to: dateKey(end), group, facility, test },
      buckets: buckets.map((bucket) => ({
        period: bucket.key,
        label: bucket.label,
        tests: bucket.tests,
        averageTurnaroundMinutes: bucket.turnaroundCount ? Math.round((bucket.turnaroundTotal / bucket.turnaroundCount) * 10) / 10 : null,
        measuredResults: bucket.turnaroundCount,
        flags: bucket.flags,
      })),
      totals: {
        tests: scopedOrders.reduce((sum, order) => sum + splitTests(order).length, 0),
        results: scopedResults.length,
        averageTurnaroundMinutes: measured ? Math.round((minutes / measured) * 10) / 10 : null,
        flaggedValues: Object.values(flagTotals).reduce((sum, count) => sum + count, 0),
      },
      flags: Object.entries(flagTotals).map(([category, count]) => ({ category, count })),
      workload: [...workloadMap.values()].sort((a, b) => b.tests - a.tests || a.facility.localeCompare(b.facility)),
      facilities: [...new Set((orders || []).map((order) => order.facilityName).filter(Boolean))].sort(),
      tests: [...new Set((orders || []).flatMap(splitTests))].sort(),
    };
  }

  return { build, parseDate, dateKey, flagCategory };
});
