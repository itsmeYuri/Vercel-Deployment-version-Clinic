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
  const unitPattern = /(?:x?\s*10\s*[\^"']?\s*\d+\s*\/\s*[a-zµμ]+|g\/dL|g\/L|mg\/dL|mg\/L|mmol\/L|µmol\/L|umol\/L|mEq\/L|mIU\/L|U\/L|IU\/L|ng\/mL|pg\/mL|cells\/µL|cells\/uL|\/µL|\/uL|mm\/hr|fL|pH|pg|%)/i;

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function cleanNumber(value) {
    return String(value || "").replace(/\s+/g, "").replace(",", ".");
  }

  function normalizeQualitative(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (/^non[- ]?reactive$/.test(normalized)) return "Non-reactive";
    if (normalized === "not detected") return "Not detected";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
    // A result starts with its parameter, never an email suffix or narrative mention.
    const aliasMatch = line.match(new RegExp(`^\\s*(?:[-•]\\s*)?(${aliasPattern})(?=\\b|\\s|:|-)`, "i"));
    if (!aliasMatch) return null;

    const remainder = line.slice((aliasMatch.index || 0) + aliasMatch[0].length).replace(/^\s*[:=-]?\s*/, "");
    const valueMatch = remainder.match(new RegExp(`^${numberPattern}`));
    if (!valueMatch) {
      const qualitative = remainder.match(/^(non[- ]?reactive|not detected|positive|negative|reactive|detected|trace|present|absent)\b/i);
      if (!qualitative) return null;
      return {
        parameter: analyte.name,
        value: normalizeQualitative(qualitative[1]),
        unit: "",
        referenceRange: "",
        flag: /positive|reactive|detected|present/i.test(qualitative[1]) && !/non|not/i.test(qualitative[1]) ? "Abnormal" : "Normal",
        sourceLine: line,
      };
    }

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

  function extractSection(lines, heading, stops) {
    const start = lines.findIndex((line) => heading.test(line));
    if (start < 0) return "";
    const firstLine = lines[start].replace(heading, "").replace(/^\s*[:=-]?\s*/, "").trim();
    const content = firstLine ? [firstLine] : [];
    for (let index = start + 1; index < lines.length; index += 1) {
      if (stops.some((pattern) => pattern.test(lines[index]))) break;
      content.push(lines[index]);
    }
    return content.join(" ").trim();
  }

  function parseGenericResultLine(line) {
    if (/^(?:parameter|value|unit|reference|range|flag|result values?)\b/i.test(line)) return null;
    const qualitativeMatch = line.match(/^([A-Za-z][A-Za-z0-9 %()/.,+-]{1,48}?)\s+(non[- ]?reactive|not detected|positive|negative|reactive|detected|trace|present|absent)(?:\s+.*)?$/i);
    if (qualitativeMatch) {
      const parameter = qualitativeMatch[1].trim();
      if (/^(?:patient|age|date|lab|sample|department|status|requested|no\s+.+\s+values?)\b/i.test(parameter)) return null;
      const value = normalizeQualitative(qualitativeMatch[2]);
      return {
        parameter,
        value,
        unit: "",
        referenceRange: "",
        flag: /positive|reactive|detected|present/i.test(value) && !/non|not/i.test(value) ? "Abnormal" : "Normal",
        sourceLine: line,
      };
    }
    const match = line.match(/^([A-Za-z][A-Za-z0-9 %()/.,+-]{1,48}?)\s+([<>]?\s*[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s+(.+)$/);
    if (!match) return null;
    const parameter = match[1].trim();
    if (/^(?:patient|age|date|lab|sample|department|status|requested)\b/i.test(parameter)) return null;
    const value = cleanNumber(match[2]);
    const remainder = match[3].trim();
    const rangeMatch = remainder.match(new RegExp(`(${numberPattern})\\s*(?:-|–|—|to)\\s*(${numberPattern})`, "i"));
    const comparatorMatch = remainder.match(/(?:^|\s)([<>]=?\s*[-+]?\d+(?:[.,]\d+)?)(?:\s|$)/);
    const explicitFlag = remainder.match(/(?:^|\s)(high|low|normal|critical|abnormal|[HL])(?:\s|$)/i);
    const referenceRange = rangeMatch
      ? `${cleanNumber(rangeMatch[1])}-${cleanNumber(rangeMatch[2])}`
      : comparatorMatch ? cleanNumber(comparatorMatch[1]) : "";
    const unitMatch = remainder.match(unitPattern);
    const flagMap = { h: "High", l: "Low", high: "High", low: "Low", normal: "Normal", critical: "Critical", abnormal: "Abnormal" };
    return {
      parameter,
      value,
      unit: unitMatch ? unitMatch[0].replace(/\s+/g, "").replace(/["']/g, "^") : "",
      referenceRange,
      flag: explicitFlag ? flagMap[explicitFlag[1].toLowerCase()] : inferredFlag(value, referenceRange),
      sourceLine: line,
    };
  }

  function parse(text) {
    const lines = String(text || "")
      .replace(/[–—−]/g, "-")
      .replace(/×/g, "x")
      .replace(/10([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, digits) => `10^${Array.from(digits, (digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(digit)).join("")}`)
      .replace(/[|]/g, " ")
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const found = new Map();
    const specificHeadingIndex = lines.findIndex((line) => /^(?:result values?|test results?)\b/i.test(line));
    const resultHeadingIndex = specificHeadingIndex >= 0 ? specificHeadingIndex : lines.findIndex((line) => /^laboratory results?\s*:?$/i.test(line));
    const resultEndIndex = resultHeadingIndex < 0 ? -1 : lines.findIndex((line, index) => index > resultHeadingIndex && /^(?:performed by|reviewed by|note|interpretation|thank you)\b/i.test(line));

    lines.forEach((line, index) => {
      const matchedKnownAnalyte = analytes.some((analyte) => {
        const result = parseLine(line, analyte);
        if (!result) return false;
        const previous = found.get(result.parameter);
        if (!previous || (!previous.referenceRange && result.referenceRange)) found.set(result.parameter, result);
        return true;
      });
      const insideResultTable = resultHeadingIndex >= 0 && index > resultHeadingIndex && (resultEndIndex < 0 || index < resultEndIndex);
      const looksQualitative = /\b(?:non[- ]?reactive|not detected|positive|negative|reactive|detected|trace|present|absent)\b/i.test(line);
      const looksStructuredNumeric = unitPattern.test(line)
        && new RegExp(`(${numberPattern})\\s*(?:-|â€“|â€”|to)\\s*(${numberPattern})`, "i").test(line);
      if (!matchedKnownAnalyte && (insideResultTable || looksQualitative || looksStructuredNumeric)) {
        const result = parseGenericResultLine(line);
        if (result && !found.has(result.parameter)) found.set(result.parameter, result);
      }
    });

    const values = Array.from(found.values()).map((result) => {
      const warnings = [];
      // A damaged exponent must not become a standalone percentage unit.
      if (/x\s*10[^\s/]*[%°][^\s/]*\s*\//i.test(result.sourceLine)) {
        result.unit = "";
        warnings.push("Unit was unclear; check the source image.");
      }
      return warnings.length ? { ...result, reviewWarnings: warnings } : result;
    });
    return {
      values,
      patientName: lines.map((line) => line.match(/^patient\s*name\s*[:\-]?\s*(.+)$/i)).find(Boolean)?.[1]?.trim() || "",
      findings: extractSection(lines, /^findings summary\b/i, [/^remarks\b/i, /^result values?\b/i, /^performed by\b/i]),
      remarks: extractSection(lines, /^remarks\b/i, [/^result values?\b/i, /^performed by\b/i, /^reviewed by\b/i]),
      lines,
      rawText: String(text || "").trim(),
    };
  }

  function parameterKey(value) {
    const key = String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (["hemoglobina1c", "hba1c", "a1c"].includes(key)) return "hba1c";
    if (["creactiveprotein", "crp"].includes(key)) return "crp";
    if (["fastingglucose", "fastingbloodsugar", "glucose", "fbs"].includes(key)) return "glucose";
    if (["alt", "altsgpt", "alanineaminotransferase"].includes(key)) return "alt";
    if (["esr", "erythrocytesedimentationrate"].includes(key)) return "esr";
    if (["ldl", "ldlcholesterol"].includes(key)) return "ldl";
    if (["hdl", "hdlcholesterol"].includes(key)) return "hdl";
    return key;
  }

  function expectedParameters(testNames) {
    const expected = new Set();
    const add = (...names) => names.forEach((name) => expected.add(parameterKey(name)));
    for (const name of testNames) {
      const test = parameterKey(name).replace(/^demo/, "");
      if (test.includes("completebloodcount") || test === "cbc") add("WBC", "RBC", "Hemoglobin", "Hematocrit", "Platelets", "MCV", "MCH", "MCHC", "RDW", "Neutrophils", "Lymphocytes", "Monocytes", "Eosinophils", "Basophils");
      else if (test.includes("urinalysis") || test === "ua") add("Urine pH", "Specific Gravity");
      else if (test.includes("lipidprofile") || test === "lipid") add("Total Cholesterol", "LDL", "HDL", "Triglycerides");
      else if (test.includes("metabolicpanel") || test === "cmp") add("Glucose", "Creatinine", "BUN", "Sodium", "Potassium", "Chloride", "Calcium", "ALT", "AST/SGOT");
      else if (test.includes("creactiveprotein") || test === "crp") add("CRP");
      else if (test.includes("hemoglobina1c") || test === "hba1c") add("HbA1c");
      else if (test.includes("fastingbloodsugar") || test === "fbs") add("Glucose");
      else if (test.includes("creatinine")) add("Creatinine");
      else if (test.includes("thyroidstimulatinghormone") || test === "tsh") add("TSH");
      else if (test.includes("alanineaminotransferase") || test === "alt") add("ALT");
      else if (test.includes("erythrocytesedimentationrate") || test === "esr") add("ESR");
    }
    return expected;
  }

  function scanMismatch(parsed, order) {
    if (!order) return { reasons: ["Select a laboratory request before scanning."] };
    const testNames = String(order.tests || "").split(/,|;/).map((name) => name.trim()).filter(Boolean);
    const expected = expectedParameters(testNames);
    const unexpected = expected.size ? (parsed.values || []).filter((value) => !expected.has(parameterKey(value.parameter))).map((value) => value.parameter) : [];
    const normalizeName = (name) => String(name || "").toLowerCase().replace(/\b(?:mr|mrs|ms|dr)\.?\b/g, "").replace(/[^a-z]/g, "");
    const patientMismatch = parsed.patientName && order.patientName && normalizeName(parsed.patientName) !== normalizeName(order.patientName);
    const reasons = [];
    if (patientMismatch) reasons.push(`Scanned patient: ${parsed.patientName}; requested patient: ${order.patientName}.`);
    if (unexpected.length) reasons.push(`Unexpected test components: ${unexpected.join(", ")}. Ordered tests: ${testNames.join(", ")}.`);
    return { reasons, unexpected, patientMismatch };
  }

  function imageQuality(imageData) {
    const { width, height, data } = imageData;
    if (!width || !height || !data?.length) return { sharpness: 0, contrast: 0, lowResolution: true, blurry: true, lowContrast: true };
    const step = Math.max(1, Math.floor(Math.min(width, height) / 350));
    let count = 0, sum = 0, sumSquares = 0, edges = 0, edgeCount = 0;
    const gray = (offset) => data[offset] * .299 + data[offset + 1] * .587 + data[offset + 2] * .114;
    for (let y = 0; y < height - step; y += step) {
      for (let x = 0; x < width - step; x += step) {
        const offset = (y * width + x) * 4;
        const value = gray(offset);
        sum += value;
        sumSquares += value * value;
        count += 1;
        edges += Math.abs(value - gray(offset + step * 4)) + Math.abs(value - gray(offset + step * width * 4));
        edgeCount += 2;
      }
    }
    const contrast = Math.sqrt(Math.max(0, sumSquares / count - (sum / count) ** 2));
    const sharpness = edges / edgeCount;
    return { sharpness, contrast, lowResolution: Math.min(width, height) < 700,
      blurry: sharpness < 5, lowContrast: contrast < 28 };
  }

  function recognitionScore(parsed, confidence) {
    const rows = parsed?.values || [];
    const complete = rows.filter((row) => row.parameter && row.value && row.unit && row.referenceRange).length;
    return complete * 30 + rows.length * 12 + Math.max(0, Math.min(100, Number(confidence) || 0)) * .15;
  }

  return { parse, inferredFlag, imageQuality, recognitionScore, scanMismatch };
}));
