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

function clinic_evaluate_values($values, $rules)
{
    $rows = []; $issues = []; $seen = []; $byName = [];
    foreach ($rules as $rule) $byName[strtolower($rule['parameter'])][] = $rule;
    if (!$values) $issues[] = 'At least one result parameter is required.';
    foreach ($values as $value) {
        $name = strtolower(trim($value['parameter']));
        $reasons = []; $flag = 'Normal';
        if (isset($seen[$name])) $reasons[] = 'Duplicate parameter.';
        $seen[$name] = true;
        $matches = $byName[$name] ?? [];
        $rule = count($matches) === 1 ? $matches[0] : null;
        if (!$rule) $reasons[] = count($matches) > 1 ? 'Multiple ordered tests define this parameter. Resolve the conflicting rules before submission.' : 'No approved rule for this parameter in the ordered tests.';
        if ($rule) {
            if (trim($value['unit']) !== $rule['unit']) $reasons[] = 'Expected unit: ' . ($rule['unit'] ?: '(none)') . '.';
            if ($rule['type'] === 'numeric') {
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
            // Use the approved range, never an OCR-supplied or manually overridden range.
            $value['referenceRange'] = clinic_rule_range($rule);
        }
        if ($reasons) $flag = 'Invalid Entry';
        $value['flag'] = $flag;
        $value['validationReason'] = $reasons ? implode(' ', $reasons) : ($flag === 'Critical' ? 'Meets an inclusive critical threshold; professional review is required.' : ($flag === 'Low' ? 'Below the approved reference interval.' : ($flag === 'High' ? 'Above the approved reference interval.' : 'Meets the configured rule.')));
        $value['validationRule'] = $rule;
        $rows[] = $value;
    }
    foreach ($rules as $rule) if ($rule['required'] && !isset($seen[strtolower($rule['parameter'])])) $issues[] = 'Missing required parameter: ' . $rule['parameter'] . '.';
    return ['valid' => !$issues && !array_filter($rows, fn($v) => $v['flag'] === 'Invalid Entry'), 'issues' => $issues, 'values' => $rows];
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
    if (!$tests) $missing[] = 'The request has no test definitions.';
    $report = clinic_evaluate_values($values, $rules);
    $report['issues'] = array_merge($missing, $report['issues']);
    $report['valid'] = $report['valid'] && !$missing;
    $report['validatedAt'] = date(DATE_ATOM);
    return $report;
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
