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
      buckets.push({ key: dateKey(cursor), label: labelFor(cursor, group), requests: 0, tests: 0, turnaroundTotal: 0, turnaroundCount: 0, flags: 0 });
    }
    const findBucket = (date) => buckets.find((bucket, index) => {
      const from = parseDate(bucket.key);
      const to = buckets[index + 1] ? parseDate(buckets[index + 1].key) : nextBucket(from, group);
      return date >= from && date < to;
    });
    scopedOrders.forEach((order) => {
      const bucket = findBucket(parseDate(order.createdAt));
      if (bucket) {
        bucket.requests += 1;
        bucket.tests += splitTests(order).length;
      }
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
        requests: bucket.requests,
        tests: bucket.tests,
        averageTurnaroundMinutes: bucket.turnaroundCount ? Math.round((bucket.turnaroundTotal / bucket.turnaroundCount) * 10) / 10 : null,
        measuredResults: bucket.turnaroundCount,
        flags: bucket.flags,
      })),
      totals: {
        requests: scopedOrders.length,
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

  function diagnostic(analysis) {
    const { totals, buckets, flags, workload, filters } = analysis;
    const scope = `${filters.from} to ${filters.to}`;
    if (!totals.tests && !totals.results) {
      return {
        observed: `No laboratory requests or encoded results match the selected filters for ${scope}. There is no activity to diagnose in this view.`,
        explanation: "The charts count requested tests by request date and encoded results by result date. The selected facility, test, or dates may exclude recorded activity; this does not establish why no work occurred.",
        nextSteps: "Check the date and facility filters, then confirm that requests and results were entered for this period before investigating a service gap.",
      };
    }
    const peak = [...buckets].sort((a, b) => b.tests - a.tests)[0];
    const leadingFlag = [...flags].sort((a, b) => b.count - a.count)[0];
    const busiest = workload[0];
    const measured = buckets.reduce((sum, bucket) => sum + bucket.measuredResults, 0);
    const observations = [`From ${scope}, ${totals.tests} requested test${totals.tests === 1 ? "" : "s"} and ${totals.results} encoded result${totals.results === 1 ? "" : "s"} matched the filters.`];
    if (peak?.tests) observations.push(`The busiest ${filters.group} was ${peak.label} with ${peak.tests} requested test${peak.tests === 1 ? "" : "s"}.`);
    if (busiest?.tests) observations.push(`${busiest.facility} had the highest recorded workload (${busiest.tests} requested tests).`);
    if (totals.flaggedValues) observations.push(`${totals.flaggedValues} result value${totals.flaggedValues === 1 ? " was" : "s were"} flagged; the most common category was ${leadingFlag.category} (${leadingFlag.count}).`);
    else observations.push("No result values were flagged in the selected data.");
    if (measured) observations.push(`For ${measured} released result${measured === 1 ? "" : "s"} with valid timestamps, the average encoding-to-release time was ${(totals.averageTurnaroundMinutes / 60).toFixed(1)} hours.`);
    else observations.push("No released results had usable encoding and release timestamps, so turnaround could not be calculated.");

    const explanation = "These patterns come from request dates, result dates, validation flags, and recorded release times. A busy interval or facility may indicate concentrated demand; flags may call for review of the recorded measurements. The data does not show staffing, equipment downtime, specimen delays, or the clinical reason for a flag, so it cannot establish a root cause.";
    const nextSteps = ["Review the busiest interval and facility against staffing and equipment logs."];
    if (totals.flaggedValues) nextSteps.push("Have authorized laboratory staff review flagged values and the applicable validation rules.");
    if (measured) nextSteps.push("Inspect results with long encoding-to-release times for review or release bottlenecks.");
    else nextSteps.push("Record valid encoding and release timestamps to make turnaround measurable.");
    nextSteps.push("Compare the same filters in future periods to see whether the pattern repeats.");
    return { observed: observations.join(" "), explanation, nextSteps: nextSteps.join(" ") };
  }

  function diagnosticTopics(analysis) {
    const { totals, buckets, flags, workload, filters } = analysis;
    const peak = [...buckets].sort((a, b) => b.tests - a.tests)[0];
    const busiest = workload[0];
    const measured = buckets.reduce((sum, bucket) => sum + bucket.measuredResults, 0);
    const slowest = [...buckets].filter((bucket) => bucket.averageTurnaroundMinutes !== null)
      .sort((a, b) => b.averageTurnaroundMinutes - a.averageTurnaroundMinutes)[0];
    const leadingFlag = [...flags].sort((a, b) => b.count - a.count)[0];
    const flaggedPeriods = buckets.filter((bucket) => bucket.flags > 0).length;
    const facilityShare = busiest && totals.tests ? Math.round((busiest.tests / totals.tests) * 100) : 0;
    const testsPerRequest = totals.requests ? (totals.tests / totals.requests).toFixed(1) : null;
    const halfway = Math.floor(buckets.length / 2);
    const early = buckets.slice(0, halfway);
    const late = buckets.slice(halfway);
    const earlyAverage = early.length ? early.reduce((sum, bucket) => sum + bucket.tests, 0) / early.length : null;
    const lateAverage = late.length ? late.reduce((sum, bucket) => sum + bucket.tests, 0) / late.length : null;
    const volumePattern = earlyAverage === null ? "Only one interval is available, so no within-period direction can be assessed."
      : lateAverage > earlyAverage ? `Later intervals averaged ${lateAverage.toFixed(1)} requested tests, above the earlier ${earlyAverage.toFixed(1)} per interval.`
      : lateAverage < earlyAverage ? `Later intervals averaged ${lateAverage.toFixed(1)} requested tests, below the earlier ${earlyAverage.toFixed(1)} per interval.`
      : `Earlier and later intervals each averaged ${earlyAverage.toFixed(1)} requested tests.`;
    const period = `${filters.from} to ${filters.to}`;
    return [
      {
        title: "Test volume",
        observed: totals.tests ? `${totals.tests} tests were requested from ${period}. The busiest ${filters.group} was ${peak.label} with ${peak.tests} tests.` : `No requested tests matched the selected filters from ${period}.`,
        explanation: totals.tests ? `${volumePattern} The ${totals.requests} recorded request${totals.requests === 1 ? "" : "s"} contained ${testsPerRequest} tests each on average. These counts show the pattern, but staffing and supply records are needed to explain its cause.` : "The selected dates, facility, or test may exclude recorded requests; zero matches do not prove there was no service demand.",
        nextSteps: totals.tests ? `Compare ${peak.label} with earlier periods and check its request mix${lateAverage > earlyAverage ? ", staffing, and supplies if the higher recent volume continues" : " before changing capacity"}.` : "Check the filters and confirm requests were recorded before investigating a possible service gap.",
      },
      {
        title: "Result turnaround",
        observed: measured ? `${measured} released results had valid timestamps. Their average encoding-to-release time was ${totals.averageTurnaroundMinutes} minutes${slowest ? `; the longest average ${filters.group} was ${slowest.label} at ${slowest.averageTurnaroundMinutes} minutes` : ""}.` : "No released results had valid encoding and release timestamps for a turnaround calculation.",
        explanation: measured ? `${slowest.label} contributed ${slowest.measuredResults} measured result${slowest.measuredResults === 1 ? "" : "s"} at an average of ${slowest.averageTurnaroundMinutes} minutes. That interval was ${slowest.averageTurnaroundMinutes > totals.averageTurnaroundMinutes ? "above" : "at or below"} the overall average. Encoding and release times show the delay, but do not record why it occurred.` : "Turnaround requires both encoding and release timestamps in the right order. Without them, a delay cannot be measured here.",
        nextSteps: measured ? `Inspect the ${slowest.measuredResults} measured result${slowest.measuredResults === 1 ? "" : "s"} in ${slowest.label} alongside verification and release logs; adjust review coverage only if a repeatable bottleneck is confirmed.` : "Ensure result encoding and release timestamps are recorded, then review turnaround again.",
      },
      {
        title: "Validation flags",
        observed: totals.flaggedValues ? `${totals.flaggedValues} result values were flagged. The most frequent category was ${leadingFlag.category} (${leadingFlag.count}).` : "No result values were flagged in the selected results.",
        explanation: totals.flaggedValues ? `${leadingFlag.category} accounts for ${leadingFlag.count} of ${totals.flaggedValues} flagged values, spread across ${flaggedPeriods} displayed interval${flaggedPeriods === 1 ? "" : "s"}. These are stored validation categories, not a clinical diagnosis or proof of an equipment fault.` : `${totals.results} encoded result${totals.results === 1 ? " was" : "s were"} included, with no saved validation flags. This does not establish whether every result was clinically normal.`,
        nextSteps: totals.flaggedValues ? `Prioritize review of the ${leadingFlag.count} ${leadingFlag.category.toLowerCase()} value${leadingFlag.count === 1 ? "" : "s"}; check source measurements and approved rules, then see whether this category recurs.` : "Continue routine validation checks and verify that rules and result values are being recorded.",
      },
      {
        title: "Facility workload",
        observed: busiest?.tests ? `${busiest.facility} had the highest recorded workload with ${busiest.tests} requested tests across ${busiest.requests} requests.` : "No facility workload was recorded for the selected requests.",
        explanation: busiest?.tests ? `${busiest.facility} accounts for ${facilityShare}% of requested tests in this selection. That share shows where requests were recorded; staff shifts and actual processing capacity are not stored here.` : "Facility workload needs requests with a facility assignment in the selected period.",
        nextSteps: busiest?.tests ? `Compare ${busiest.facility}'s ${busiest.tests} requested tests with its staffing, equipment, and opening hours before reallocating work; repeat this comparison in later periods.` : "Check facility assignment on requests and the selected filters before comparing capacity.",
      },
    ];
  }

  return { build, diagnostic, diagnosticTopics, parseDate, dateKey, flagCategory };
});
