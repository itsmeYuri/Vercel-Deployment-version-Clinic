(function (root, factory) {
  "use strict";
  const scanner = factory();
  if (typeof module === "object" && module.exports) module.exports = scanner;
  if (root) root.ClinicLabScanner = scanner;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const analytes = [
    { name: "Hemoglobin", aliases: ["hemoglobin", "haemoglobin", "hgb", "hb"] },
    { name: "Hematocrit", aliases: ["hematocrit", "haematocrit", "hct"] },
    { name: "Platelets", aliases: ["platelet count", "platelets", "platelet", "plt"] },
    { name: "WBC", aliases: ["white blood cell count", "white blood cells", "wbc count", "wbc"] },
    { name: "RBC", aliases: ["red blood cell count", "red blood cells", "rbc count", "rbc"] },
    { name: "MCV", aliases: ["mean corpuscular volume", "mcv"] },
    { name: "MCHC", aliases: ["mean corpuscular hemoglobin concentration", "mchc"] },
    { name: "MCH", aliases: ["mean corpuscular hemoglobin", "mch"] },
    { name: "RDW", aliases: ["red cell distribution width", "rdw"] },
    { name: "Neutrophils", aliases: ["neutrophils", "neutrophil", "neut"] },
    { name: "Lymphocytes", aliases: ["lymphocytes", "lymphocyte", "lymph"] },
    { name: "Monocytes", aliases: ["monocytes", "monocyte", "mono"] },
    { name: "Eosinophils", aliases: ["eosinophils", "eosinophil", "eos"] },
    { name: "Basophils", aliases: ["basophils", "basophil", "baso"] },
    { name: "Glucose", aliases: ["fasting blood sugar", "blood glucose", "glucose", "fbs"] },
    { name: "HbA1c", aliases: ["glycated hemoglobin", "hemoglobin a1c", "hba1c", "a1c"] },
    { name: "Creatinine", aliases: ["creatinine", "crea"] },
    { name: "BUN", aliases: ["blood urea nitrogen", "bun"] },
    { name: "Uric Acid", aliases: ["uric acid"] },
    { name: "Total Cholesterol", aliases: ["total cholesterol", "cholesterol"] },
    { name: "Triglycerides", aliases: ["triglycerides", "triglyceride"] },
    { name: "HDL", aliases: ["hdl cholesterol", "hdl-c", "hdl"] },
    { name: "LDL", aliases: ["ldl cholesterol", "ldl-c", "ldl"] },
    { name: "AST/SGOT", aliases: ["ast/sgot", "sgot", "ast"] },
    { name: "ALT/SGPT", aliases: ["alt/sgpt", "sgpt", "alt"] },
    { name: "Sodium", aliases: ["sodium", "na+"] },
    { name: "Potassium", aliases: ["potassium", "k+"] },
    { name: "Chloride", aliases: ["chloride", "cl-"] },
    { name: "Calcium", aliases: ["calcium"] },
    { name: "CRP", aliases: ["c-reactive protein", "crp"] },
    { name: "ESR", aliases: ["erythrocyte sedimentation rate", "esr"] },
    { name: "Specific Gravity", aliases: ["specific gravity", "sp. gravity", "sg"] },
    { name: "Urine pH", aliases: ["urine ph", "ph"] },
  ];

  const numberPattern = "[<>]?\\s*[-+]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)";
  const unitPattern = /(?:x?\s*10\s*[\^"']?\s*\d+\s*\/\s*[a-zµμ]+|g\/dL|g\/L|mg\/dL|mg\/L|mmol\/L|µmol\/L|umol\/L|mEq\/L|U\/L|IU\/L|ng\/mL|pg\/mL|cells\/µL|cells\/uL|\/µL|\/uL|mm\/hr|fL|pg|%)/i;

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function cleanNumber(value) {
    return String(value || "").replace(/\s+/g, "").replace(",", ".");
  }

  function inferredFlag(value, referenceRange) {
    const numericValue = Number.parseFloat(String(value).replace(/[^0-9.+-]/g, ""));
    const range = String(referenceRange).match(/(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)/);
    if (!Number.isFinite(numericValue) || !range) return "";
    const low = Number.parseFloat(range[1]);
    const high = Number.parseFloat(range[2]);
    if (numericValue < low) return "Low";
    if (numericValue > high) return "High";
    return "Normal";
  }

  function parseLine(line, analyte) {
    const aliasPattern = analyte.aliases
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join("|");
    const aliasMatch = line.match(new RegExp(`(?:^|\\b)(${aliasPattern})(?=\\b|\\s|:|-)`, "i"));
    if (!aliasMatch) return null;

    const remainder = line.slice((aliasMatch.index || 0) + aliasMatch[0].length).replace(/^\s*[:=-]?\s*/, "");
    const valueMatch = remainder.match(new RegExp(numberPattern));
    if (!valueMatch) return null;

    const value = cleanNumber(valueMatch[0]);
    const afterValue = remainder.slice((valueMatch.index || 0) + valueMatch[0].length);
    const rangeMatch = afterValue.match(new RegExp(`(${numberPattern})\\s*(?:-|–|—|to)\\s*(${numberPattern})`, "i"));
    const comparatorMatch = afterValue.match(new RegExp(`(?:reference|ref(?:erence)?(?: range)?|normal)?\\s*[:=]?\\s*([<>]=?\\s*[-+]?\\d+(?:[.,]\\d+)?)`, "i"));
    const textReference = afterValue.match(/\b(negative|non-reactive|nonreactive|reactive|trace)\b/i);
    const referenceRange = rangeMatch
      ? `${cleanNumber(rangeMatch[1])}-${cleanNumber(rangeMatch[2])}`
      : comparatorMatch
        ? cleanNumber(comparatorMatch[1])
        : textReference
          ? textReference[1]
          : "";
    const unitMatch = remainder.match(unitPattern);
    const explicitFlag = remainder.match(/(?:^|\s)(high|low|normal|critical|abnormal|[HL])(?:\s|$)/i);
    const flagMap = { h: "High", l: "Low", high: "High", low: "Low", normal: "Normal", critical: "Critical", abnormal: "Abnormal" };
    const flag = explicitFlag ? flagMap[explicitFlag[1].toLowerCase()] : inferredFlag(value, referenceRange);

    return {
      parameter: analyte.name,
      value,
      unit: unitMatch ? unitMatch[0].replace(/\s+/g, "").replace(/["']/g, "^") : "",
      referenceRange,
      flag,
      sourceLine: line,
    };
  }

  function parse(text) {
    const lines = String(text || "")
      .replace(/[|]/g, " ")
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const found = new Map();

    lines.forEach((line) => {
      analytes.some((analyte) => {
        const result = parseLine(line, analyte);
        if (!result) return false;
        const previous = found.get(result.parameter);
        if (!previous || (!previous.referenceRange && result.referenceRange)) found.set(result.parameter, result);
        return true;
      });
    });

    return {
      values: Array.from(found.values()),
      lines,
      rawText: String(text || "").trim(),
    };
  }

  return { parse, inferredFlag };
}));
