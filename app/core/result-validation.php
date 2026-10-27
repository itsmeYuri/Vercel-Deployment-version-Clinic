<?php

function clinic_validation_schema($pdo)
{
    static $ready = false;
    if ($ready) return;
    $pdo->exec('CREATE TABLE IF NOT EXISTS laboratory_validation_rules (test_id INTEGER PRIMARY KEY, rules_json TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS laboratory_validation_reports (result_id INTEGER PRIMARY KEY, report_json TEXT NOT NULL)');
    if (db_is_postgres()) {
        $pdo->exec('ALTER TABLE laboratory_validation_rules ENABLE ROW LEVEL SECURITY');
        $pdo->exec('ALTER TABLE laboratory_validation_reports ENABLE ROW LEVEL SECURITY');
    }
    $ready = true;
}

function clinic_number($value)
{
    return preg_match('/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/D', trim((string) $value)) && is_finite((float) $value);
}

function clinic_validate_rule_config($rules)
{
    if (!is_array($rules) || count($rules) > 100) throw new InvalidArgumentException('Supply at most 100 validation rules per test.');
    $clean = []; $names = [];
    foreach ($rules as $rule) {
        if (!is_array($rule)) throw new InvalidArgumentException('Invalid validation rule.');
        $r = [];
        foreach (['parameter', 'unit', 'source', 'allowedValues'] as $key) {
            $r[$key] = trim((string) ($rule[$key] ?? ''));
            if (strlen($r[$key]) > ($key === 'source' ? 1000 : ($key === 'unit' ? 60 : 120))) throw new InvalidArgumentException('Validation rule text is too long.');
        }
        if (!$r['parameter'] || !$r['source']) throw new InvalidArgumentException('Every rule requires a parameter and its approved source/basis.');
        $name = strtolower($r['parameter']);
        if (isset($names[$name])) throw new InvalidArgumentException('Use one rule per parameter in each test.');
        $names[$name] = true;
        $r['type'] = $rule['type'] ?? 'numeric';
        if (!in_array($r['type'], ['numeric', 'text'], true)) throw new InvalidArgumentException('Select numeric or qualitative validation.');
        $r['required'] = !empty($rule['required']);
        $r['minimumInclusive'] = ($rule['minimumInclusive'] ?? true) === true;
        $r['maximumInclusive'] = ($rule['maximumInclusive'] ?? true) === true;
        foreach (['minimum','maximum','criticalLow','criticalHigh'] as $key) {
            $v = $rule[$key] ?? '';
            if ($v !== '' && $v !== null && !clinic_number($v)) throw new InvalidArgumentException('Rule bounds must be finite numbers.');
            $r[$key] = $v === '' || $v === null ? null : (float) $v;
        }
        if ($r['type'] === 'numeric') {
            if (!$r['unit'] || ($r['minimum'] === null && $r['maximum'] === null)) throw new InvalidArgumentException('Numeric rules require a unit and at least one reference bound. Use "1" for dimensionless values.');
            if ($r['minimum'] !== null && $r['maximum'] !== null && $r['minimum'] > $r['maximum']) throw new InvalidArgumentException('The minimum cannot exceed the maximum.');
            if (($r['criticalLow'] !== null && ($r['minimum'] === null || $r['criticalLow'] >= $r['minimum'])) || ($r['criticalHigh'] !== null && ($r['maximum'] === null || $r['criticalHigh'] <= $r['maximum']))) throw new InvalidArgumentException('Critical limits must lie outside the reference interval.');
        } elseif (!$r['allowedValues']) throw new InvalidArgumentException('Qualitative rules require comma-separated permitted values.');
        $clean[] = $r;
    }
    return $clean;
}

function clinic_rule_range($rule)
{
    if ($rule['type'] === 'text') return $rule['allowedValues'];
    if ($rule['minimum'] === null) return ($rule['maximumInclusive'] ? '<= ' : '< ') . $rule['maximum'];
    if ($rule['maximum'] === null) return ($rule['minimumInclusive'] ? '>= ' : '> ') . $rule['minimum'];
    if (!$rule['minimumInclusive'] || !$rule['maximumInclusive']) return ($rule['minimumInclusive'] ? '>=' : '>') . ' ' . $rule['minimum'] . ' and ' . ($rule['maximumInclusive'] ? '<=' : '<') . ' ' . $rule['maximum'];
    return $rule['minimum'] . ' - ' . $rule['maximum'];
}

function clinic_reference_bounds($range)
{
    $range = preg_replace('/[\x{2012}\x{2013}\x{2014}\x{2212}]/u', '-', trim((string) $range));
    if (preg_match('/^\s*([+-]?\d+(?:\.\d+)?)\s*-\s*([+-]?\d+(?:\.\d+)?)\s*$/', $range, $match)) {
        return ['minimum' => (float) $match[1], 'maximum' => (float) $match[2], 'minimumInclusive' => true, 'maximumInclusive' => true];
    }
    if (preg_match('/^\s*(<=|>=|<|>)\s*([+-]?\d+(?:\.\d+)?)\s*$/', $range, $match)) {
        return in_array($match[1], ['<', '<='], true)
            ? ['minimum' => null, 'maximum' => (float) $match[2], 'minimumInclusive' => true, 'maximumInclusive' => $match[1] === '<=']
            : ['minimum' => (float) $match[2], 'maximum' => null, 'minimumInclusive' => $match[1] === '>=', 'maximumInclusive' => true];
    }
    return null;
}

function clinic_validate_unconfigured_value($value)
{
    $errors = [];
    $rawValue = trim((string) ($value['value'] ?? ''));
    $unit = trim((string) ($value['unit'] ?? ''));
    $range = trim((string) ($value['referenceRange'] ?? ''));
    $qualitative = ['positive', 'negative', 'detected', 'not detected', 'reactive', 'non-reactive', 'normal', 'abnormal', 'trace'];

    if (!clinic_number($rawValue) && !in_array(strtolower($rawValue), $qualitative, true)) {
        $errors[] = 'Enter a finite number or an approved qualitative value.';
    }
    if ($unit === '' || !preg_match('/^[A-Za-z0-9µμ%°×x^\.\/\-*]+$/u', $unit) || (strlen($unit) === 1 && !in_array($unit, ['%', '1'], true))) {
        $errors[] = 'Enter a recognized laboratory unit.';
    }
    $normalizedRange = preg_replace('/[\x{2012}\x{2013}\x{2014}\x{2212}]/u', '-', $range);
    $numericRange = preg_match('/^\s*(?:[<>]=?\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)|[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s+-\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)|[+-]?(?:\d+(?:\.\d*)?|\.\d+)-[+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*$/', $normalizedRange);
    $textRange = in_array(strtolower($range), $qualitative, true);
    if (!$numericRange && !$textRange) {
        $errors[] = 'Use a numeric interval such as 4.0–11.0, a limit such as <5.0, or an approved qualitative reference.';
    }
    return $errors;
}

function clinic_evaluate_values($values, $rules)
{
    $rows = []; $issues = []; $seen = []; $byName = [];
    foreach ($rules as $rule) $byName[strtolower($rule['parameter'])][] = $rule;
    if (!$values) $issues[] = 'At least one result parameter is required.';
    foreach ($values as $value) {
        $name = strtolower(trim($value['parameter']));
        $reasons = []; $flag = 'Not Evaluated';
        if (isset($seen[$name])) $reasons[] = 'Duplicate parameter.';
        $seen[$name] = true;
        $matches = $byName[$name] ?? [];
        $rule = count($matches) === 1 ? $matches[0] : null;
        if (!$rule) {
            if (count($matches) > 1) $reasons[] = 'Multiple ordered tests define this parameter. Resolve the conflicting rules before submission.';
            else $reasons = array_merge($reasons, clinic_validate_unconfigured_value($value));
        }
        if ($rule) {
            $flag = 'Normal';
            if (trim($value['unit']) !== $rule['unit']) $reasons[] = 'Expected unit: ' . ($rule['unit'] ?: '(none)') . '.';
            $extractedRange = trim((string) ($value['referenceRange'] ?? ''));
            $value['extractedReferenceRange'] = $extractedRange;
            $value['approvedReferenceRange'] = clinic_rule_range($rule);
            if ($rule['type'] === 'numeric') {
                $bounds = clinic_reference_bounds($extractedRange);
                if ($extractedRange === '') $reasons[] = 'Reference range is missing; compare the source report with the approved rule.';
                elseif (!$bounds) $reasons[] = 'Reference range could not be read reliably; compare it with the approved rule.';
                elseif ($bounds['minimum'] !== null && $bounds['maximum'] !== null && $bounds['minimum'] > $bounds['maximum']) $reasons[] = 'Reference range minimum exceeds maximum.';
                elseif ($bounds['minimum'] !== $rule['minimum'] || $bounds['maximum'] !== $rule['maximum'] || $bounds['minimumInclusive'] !== $rule['minimumInclusive'] || $bounds['maximumInclusive'] !== $rule['maximumInclusive']) $reasons[] = 'Extracted reference range conflicts with the approved rule; review the source report and rule applicability.';
                if (!clinic_number($value['value'])) $reasons[] = 'A finite numerical result is required.';
                else {
                    $n = (float) $value['value'];
                    if (($rule['criticalLow'] !== null && $n <= $rule['criticalLow']) || ($rule['criticalHigh'] !== null && $n >= $rule['criticalHigh'])) $flag = 'Critical';
                    elseif ($rule['minimum'] !== null && ($n < $rule['minimum'] || (!$rule['minimumInclusive'] && $n == $rule['minimum']))) $flag = 'Low';
                    elseif ($rule['maximum'] !== null && ($n > $rule['maximum'] || (!$rule['maximumInclusive'] && $n == $rule['maximum']))) $flag = 'High';
                }
            } else {
                $allowed = array_map('strtolower', array_map('trim', explode(',', $rule['allowedValues'])));
                if (!in_array(strtolower(trim($value['value'])), $allowed, true)) $reasons[] = 'Permitted values: ' . $rule['allowedValues'] . '.';
            }
            if (!$reasons) $value['referenceRange'] = clinic_rule_range($rule);
        }
        if ($reasons) $flag = 'Invalid Entry';
        $value['flag'] = $flag;
        $value['validationReason'] = $reasons ? implode(' ', $reasons) : (!$rule ? 'Format checks passed. No approved parameter rule is configured for this ordered request; compare it with the source report before confirmation.' : ($flag === 'Critical' ? 'Meets an inclusive critical threshold; professional review is required.' : ($flag === 'Low' ? 'Below the approved reference interval.' : ($flag === 'High' ? 'Above the approved reference interval.' : 'Meets the configured rule.'))));
        $value['validationRule'] = $rule;
        $rows[] = $value;
    }
    foreach ($rules as $rule) if ($rule['required'] && !isset($seen[strtolower($rule['parameter'])])) $issues[] = 'Missing required parameter: ' . $rule['parameter'] . '.';
    return ['valid' => !$issues && !array_filter($rows, fn($v) => $v['flag'] === 'Invalid Entry'), 'issues' => $issues, 'values' => $rows];
}

function clinic_patient_value_label($value)
{
    // A saved flag is not evidence of an approved comparison: older results
    // could be marked Normal after format checks alone.
    $rule = $value['validationRule'] ?? null;
    if (!is_array($rule) || !in_array($rule['type'] ?? '', ['numeric', 'text'], true)) return 'Range not assessed';
    if ($rule['type'] === 'text' && ($value['flag'] ?? '') === 'Normal') return 'Result recorded - ask your care team to interpret it';
    return match ($value['flag'] ?? '') {
        'Low' => 'Below reference range',
        'High' => 'Above reference range',
        'Critical' => 'Critical value - contact your care team',
        'Normal' => 'Within reference range',
        default => 'Range not assessed',
    };
}

function clinic_patient_explanation_visible($result, $explanation)
{
    return is_array($explanation)
        && ($result['status'] ?? '') === 'Released'
        && ($explanation['review_status'] ?? '') === 'Approved'
        && ($explanation['result_updated_at'] ?? null) !== null
        && (string) $explanation['result_updated_at'] === (string) ($result['updated_at'] ?: $result['created_at']);
}

function clinic_order_validation($pdo, $orderId, $values)
{
    clinic_validation_schema($pdo);
    $tests = all_rows($pdo, 'SELECT oi.test_name, vr.rules_json FROM lab_order_items oi LEFT JOIN laboratory_validation_rules vr ON vr.test_id=oi.test_definition_id WHERE oi.order_id=?', [$orderId]);
    $rules = []; $missing = [];
    foreach ($tests as $test) {
        $testRules = json_decode($test['rules_json'] ?? '[]', true) ?: [];
        if (!$testRules) $missing[] = 'Administrator must configure approved rules for ' . $test['test_name'] . '.';
        $rules = array_merge($rules, $testRules);
    }
    $report = clinic_evaluate_values($values, $rules);
    $expected = [];
    foreach ($rules as $rule) $expected[clinic_parameter_key($rule['parameter'])] = true;
    foreach ($tests as $test) {
        foreach (clinic_test_parameter_keys($test['test_name']) as $key) $expected[$key] = true;
    }
    if ($expected) foreach ($values as $value) {
        $parameter = trim((string) ($value['parameter'] ?? ''));
        if (!isset($expected[clinic_parameter_key($parameter)])) {
            $report['issues'][] = 'Wrong laboratory test: ' . $parameter . ' is not part of the selected request. Scan the report for the ordered test.';
            $report['valid'] = false;
        }
    }
    if (!$tests) {
        $report['issues'][] = 'The request has no test definitions.';
        $report['valid'] = false;
    }
    $report['warnings'] = $missing;
    $report['anomalies'] = clinic_historical_anomalies($pdo, $orderId, $report['values']);
    $report['validatedAt'] = date(DATE_ATOM);
    return $report;
}

function clinic_parameter_key($name)
{
    $key = preg_replace('/[^a-z0-9]/', '', strtolower((string) $name));
    foreach ([
        'hba1c' => ['hemoglobina1c', 'hba1c', 'a1c'],
        'crp' => ['creactiveprotein', 'crp'],
        'glucose' => ['fastingglucose', 'fastingbloodsugar', 'glucose', 'fbs'],
        'alt' => ['alt', 'altsgpt', 'alanineaminotransferase'],
        'esr' => ['esr', 'erythrocytesedimentationrate'],
        'ldl' => ['ldl', 'ldlcholesterol'],
        'hdl' => ['hdl', 'hdlcholesterol'],
    ] as $canonical => $aliases) if (in_array($key, $aliases, true)) return $canonical;
    return $key;
}

function clinic_test_parameter_keys($name)
{
    $test = clinic_parameter_key($name);
    $test = preg_replace('/^demo/', '', $test);
    if (str_contains($test, 'completebloodcount') || $test === 'cbc') $names = ['WBC','RBC','Hemoglobin','Hematocrit','Platelets','MCV','MCH','MCHC','RDW','Neutrophils','Lymphocytes','Monocytes','Eosinophils','Basophils'];
    elseif (str_contains($test, 'urinalysis') || $test === 'ua') $names = ['Urine pH','Specific Gravity'];
    elseif (str_contains($test, 'lipidprofile') || $test === 'lipid') $names = ['Total Cholesterol','LDL','HDL','Triglycerides'];
    elseif (str_contains($test, 'metabolicpanel') || $test === 'cmp') $names = ['Glucose','Creatinine','BUN','Sodium','Potassium','Chloride','Calcium','ALT','AST/SGOT'];
    elseif (in_array($test, ['crp','hba1c','glucose','alt','esr'], true)) $names = [$test];
    elseif (str_contains($test, 'creatinine')) $names = ['Creatinine'];
    elseif (str_contains($test, 'thyroidstimulatinghormone') || $test === 'tsh') $names = ['TSH'];
    else return [];
    return array_map('clinic_parameter_key', $names);
}

function clinic_median($numbers)
{
    sort($numbers, SORT_NUMERIC);
    $count = count($numbers);
    if (!$count) return null;
    $middle = intdiv($count, 2);
    return $count % 2 ? $numbers[$middle] : ($numbers[$middle - 1] + $numbers[$middle]) / 2;
}

function clinic_detect_historical_anomalies($values, $history)
{
    $groups = [];
    foreach ($history as $item) {
        if (!clinic_number($item['value'] ?? null)) continue;
        $key = mb_strtolower(trim((string) ($item['parameter'] ?? ''))) . "\0" . trim((string) ($item['unit'] ?? ''));
        $groups[$key][] = (float) $item['value'];
    }
    $alerts = [];
    foreach ($values as $value) {
        if (!clinic_number($value['value'] ?? null) || ($value['flag'] ?? '') === 'Invalid Entry') continue;
        $key = mb_strtolower(trim((string) ($value['parameter'] ?? ''))) . "\0" . trim((string) ($value['unit'] ?? ''));
        $sample = $groups[$key] ?? [];
        if (count($sample) < 5) continue;
        $median = clinic_median($sample);
        $deviations = array_map(fn($number) => abs($number - $median), $sample);
        $mad = clinic_median($deviations);
        // Median absolute deviation is robust to one unusual historical result.
        // With no measurable spread, abstain rather than claim an anomaly.
        if ($mad <= 0 || abs((float) $value['value'] - $median) <= 4 * 1.4826 * $mad) continue;
        $alerts[] = [
            'parameter' => $value['parameter'],
            'unit' => $value['unit'],
            'value' => $value['value'],
            'historicalMedian' => $median,
            'sampleCount' => count($sample),
            'message' => 'This value differs markedly from this patient\'s previous released values in the same unit. Check the source report, patient identity, and clinical context.',
        ];
    }
    return $alerts;
}

function clinic_historical_anomalies($pdo, $orderId, $values)
{
    $order = one($pdo, 'SELECT patient_id FROM lab_orders WHERE id=?', [$orderId]);
    if (!$order || !$values) return [];
    $rows = all_rows($pdo, 'SELECT rv.parameter_name AS parameter, rv.value_text AS value, rv.unit
        FROM lab_result_values rv
        JOIN lab_results lr ON lr.id=rv.result_id
        JOIN lab_orders lo ON lo.id=lr.order_id
        WHERE lo.patient_id=? AND lo.id<>? AND lr.status=\'Released\'
        ORDER BY lr.released_at DESC, rv.id DESC LIMIT 500', [(int) $order['patient_id'], $orderId]);
    return clinic_detect_historical_anomalies($values, $rows);
}

function clinic_require_valid_result($pdo, $orderId, $values, $data)
{
    $report = clinic_order_validation($pdo, $orderId, $values);
    if (!$report['valid']) respond(false, 'Correct the validation issues before saving.', ['validation' => $report], 422);
    if (($data['validationReviewed'] ?? false) !== true) respond(false, 'Review the validation report and confirm the source values before saving.', ['validation' => $report], 422);
    return $report;
}

function clinic_save_validation_report($pdo, $resultId, $report)
{
    $pdo->prepare('DELETE FROM laboratory_validation_reports WHERE result_id=?')->execute([$resultId]);
    $pdo->prepare('INSERT INTO laboratory_validation_reports (result_id,report_json) VALUES (?,?)')->execute([$resultId, json_encode($report)]);
}
