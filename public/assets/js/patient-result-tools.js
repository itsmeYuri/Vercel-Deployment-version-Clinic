(function (root, factory) {
  "use strict";
  const tools = factory();
  if (typeof module === "object" && module.exports) module.exports = tools;
  if (root) root.PatientResultTools = tools;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const glossary = [
    { term: "hemoglobin", meaning: "A protein in red blood cells that carries oxygen around the body." },
    { term: "hematocrit", meaning: "The proportion of your blood made up of red blood cells." },
    { term: "white blood cell", meaning: "A cell that helps your body respond to infection and other conditions." },
    { term: "platelet", meaning: "A blood component that helps stop bleeding." },
    { term: "creatinine", meaning: "A waste product commonly measured to help assess kidney function." },
    { term: "glucose", meaning: "A type of sugar in the blood that the body uses for energy." },
    { term: "cholesterol", meaning: "A waxy substance in the blood; different types are measured to assess health." },
    { term: "triglyceride", meaning: "A type of fat measured in the blood." },
    { term: "urinalysis", meaning: "A group of checks performed on a urine sample." },
    { term: "c-reactive protein", meaning: "A blood marker that can rise when inflammation is present." },
    { term: "inflammation", meaning: "The body's response to injury, infection, or another cause." },
    { term: "reference range", meaning: "The comparison interval shown by the laboratory. Your clinician interprets it for your situation." },
    { term: "negative", meaning: "The tested item was not detected under the test's reporting rules." },
    { term: "positive", meaning: "The tested item was detected under the test's reporting rules." },
  ];

  function matchingTerms(result) {
    const content = [result.testName, result.findings, result.remarks, result.clinicalNote,
      ...(result.values || []).map(value => `${value.parameter} ${value.validationReason || ""}`)].join(" ").toLowerCase();
    return glossary.filter(item => new RegExp(`\\b${item.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(content));
  }

  function comparableResults(current, results) {
    const currentDate = new Date(current.releasedAt || current.createdAt).getTime();
    return (results || []).filter(result => result.id !== current.id && result.patientId === current.patientId &&
      result.status === "Released" && result.testName === current.testName &&
      new Date(result.releasedAt || result.createdAt).getTime() < currentDate)
      .sort((a, b) => new Date(b.releasedAt || b.createdAt) - new Date(a.releasedAt || a.createdAt));
  }

  function comparisonRows(current, previous) {
    const key = value => `${String(value.parameter || "").trim().toLowerCase()}\0${String(value.unit || "").trim()}`;
    const currentValues = new Map((current.values || []).map(value => [key(value), value]));
    const previousValues = new Map((previous.values || []).map(value => [key(value), value]));
    const keys = [...new Set([...currentValues.keys(), ...previousValues.keys()])];
    return keys.map(id => {
      const now = currentValues.get(id);
      const before = previousValues.get(id);
      const currentNumber = Number(now?.value);
      const previousNumber = Number(before?.value);
      const numeric = now && before && String(now.value).trim() !== "" && String(before.value).trim() !== "" &&
        Number.isFinite(currentNumber) && Number.isFinite(previousNumber);
      return {
        parameter: now?.parameter || before?.parameter || "",
        unit: now?.unit || before?.unit || "",
        current: now || null,
        previous: before || null,
        difference: numeric ? currentNumber - previousNumber : null,
      };
    });
  }

  function patientValueView(value) {
    const rule = value?.validationRule;
    const approved = rule && typeof rule === "object" && ["numeric", "text"].includes(rule.type);
    const flag = approved ? String(value.flag || "") : "";
    const status = approved && rule.type === "text" && flag === "Normal"
      ? { key: "reported", label: "Result recorded" }
      : ({
      Low: { key: "low", label: "Below range" },
      High: { key: "high", label: "Above range" },
      Critical: { key: "critical", label: "Critical value — contact your care team" },
      Normal: { key: "within", label: "Within range" },
    }[flag] || { key: "unassessed", label: "Range not assessed" });
    const unit = String(value?.unit || "").trim();
    const unitMeaning = {
      "g/dL": "grams per deciliter",
      "cells/uL": "cells per microliter",
      "cells/µL": "cells per microliter",
      "cells/μL": "cells per microliter",
      "mg/dL": "milligrams per deciliter",
      "mmol/L": "millimoles per liter",
    }[unit] || "";
    const groupDigits = text => String(text || "").replace(/\d{4,}/g, digits => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    const rawRange = String(value?.referenceRange || "").trim();
    return {
      ...status,
      unitMeaning,
      rangeLabel: approved ? (rule.type === "text" ? "Expected report values" : "Lab reference range") : "Reported reference range",
      reading: groupDigits(value?.value),
      range: groupDigits(rawRange),
      showRangeUnit: /^\s*(?:[<>]=?\s*)?[+-]?(?:\d|\.)/.test(rawRange),
    };
  }

  return { matchingTerms, comparableResults, comparisonRows, patientValueView };
});
