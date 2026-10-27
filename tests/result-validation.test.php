<?php
require_once __DIR__ . '/../app/core/result-validation.php';

function expect_validation($actual, $expected, $message) {
    if ($actual !== $expected) throw new RuntimeException($message . ': expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
}

$values = [
    ['parameter' => 'Hemoglobin', 'value' => '11.2', 'unit' => 'g/dL', 'referenceRange' => '12.0-16.0'],
    ['parameter' => 'Hematocrit', 'value' => '38', 'unit' => '%', 'referenceRange' => '36.0-46.0'],
    ['parameter' => 'WBC', 'value' => '13200', 'unit' => 'cells/uL', 'referenceRange' => '4500-11000'],
];

$unconfigured = clinic_evaluate_values($values, []);
expect_validation($unconfigured['valid'], true, 'Format-valid values remain available for manual review');
foreach ($unconfigured['values'] as $value) {
    expect_validation($value['flag'], 'Not Evaluated', 'A missing approved rule must not claim Normal');
    expect_validation(clinic_patient_value_label($value), 'Range not assessed', 'Patient status must be neutral without a rule');
}

$rules = clinic_validate_rule_config([
    ['parameter' => 'Hemoglobin', 'unit' => 'g/dL', 'source' => 'Approved laboratory range', 'minimum' => 12, 'maximum' => 16],
    ['parameter' => 'Hematocrit', 'unit' => '%', 'source' => 'Approved laboratory range', 'minimum' => 36, 'maximum' => 46],
    ['parameter' => 'WBC', 'unit' => 'cells/uL', 'source' => 'Approved laboratory range', 'minimum' => 4500, 'maximum' => 11000],
]);
$assessed = clinic_evaluate_values($values, $rules);
expect_validation($assessed['valid'], true, 'Approved values should validate');
expect_validation(array_column($assessed['values'], 'flag'), ['Low', 'Normal', 'High'], 'Approved ranges must classify the sample values');
expect_validation(array_map('clinic_patient_value_label', $assessed['values']), ['Below reference range', 'Within reference range', 'Above reference range'], 'Patient labels must follow approved flags');
expect_validation(clinic_patient_value_label(['flag' => 'Normal', 'validationRule' => null]), 'Range not assessed', 'Legacy Normal must not be trusted without a saved rule');
expect_validation(clinic_patient_value_label(['flag' => 'Normal', 'validationRule' => ['type' => 'text']]), 'Result recorded - ask your care team to interpret it', 'Allowed qualitative text must not be presented as healthy');

$conflicting = clinic_evaluate_values([['parameter' => 'Hemoglobin', 'value' => '13', 'unit' => 'g/dL', 'referenceRange' => '18-10']], [$rules[0]]);
expect_validation($conflicting['valid'], false, 'Reversed OCR reference range must not pass');
expect_validation($conflicting['values'][0]['referenceRange'], '18-10', 'Unresolved OCR range must remain visible');
expect_validation($conflicting['values'][0]['approvedReferenceRange'], '12 - 16', 'Approved range must be shown separately');
$missingRange = clinic_evaluate_values([['parameter' => 'Hemoglobin', 'value' => '13', 'unit' => 'g/dL', 'referenceRange' => '']], [$rules[0]]);
expect_validation($missingRange['valid'], false, 'Missing OCR reference range must require review');
$wrongUnit = clinic_evaluate_values([['parameter' => 'Hemoglobin', 'value' => '13', 'unit' => 'mg/dL', 'referenceRange' => '12-16']], [$rules[0]]);
expect_validation($wrongUnit['valid'], false, 'Incorrect unit must fail validation');
expect_validation(clinic_patient_explanation_visible(['status' => 'Released', 'updated_at' => '2026-10-27 10:00:00'], ['review_status' => 'Approved', 'result_updated_at' => '2026-10-27 10:00:00']), true, 'Approved current explanation is visible');
expect_validation(clinic_patient_explanation_visible(['status' => 'Verified', 'updated_at' => '2026-10-27 10:00:00'], ['review_status' => 'Approved', 'result_updated_at' => '2026-10-27 10:00:00']), false, 'Unreleased explanation stays private');
expect_validation(clinic_patient_explanation_visible(['status' => 'Released', 'updated_at' => '2026-10-27 11:00:00'], ['review_status' => 'Approved', 'result_updated_at' => '2026-10-27 10:00:00']), false, 'Stale approval stays private');

echo "Result validation and patient labels passed.\n";
