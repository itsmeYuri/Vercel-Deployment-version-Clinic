<?php
require_once __DIR__ . '/../app/core/result-validation.php';

function expect_result($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

$prior = array_map(fn($value) => ['parameter' => 'Hemoglobin', 'unit' => 'g/dL', 'value' => $value], ['12.0', '12.1', '12.2', '12.3', '12.4']);
$outlier = clinic_detect_historical_anomalies([['parameter' => 'Hemoglobin', 'unit' => 'g/dL', 'value' => '17.0', 'flag' => 'High']], $prior);
expect_result(count($outlier) === 1 && $outlier[0]['sampleCount'] === 5, 'A marked patient-history change must be flagged.');
expect_result(clinic_detect_historical_anomalies([['parameter' => 'Hemoglobin', 'unit' => 'g/dL', 'value' => '12.25']], $prior) === [], 'An ordinary value must not be flagged.');
expect_result(clinic_detect_historical_anomalies([['parameter' => 'Hemoglobin', 'unit' => 'mmol/L', 'value' => '17.0']], $prior) === [], 'Different units must never be compared.');
expect_result(clinic_detect_historical_anomalies([['parameter' => 'Hemoglobin', 'unit' => 'g/dL', 'value' => '17.0']], array_slice($prior, 0, 4)) === [], 'Sparse history must abstain.');
expect_result(clinic_detect_historical_anomalies([['parameter' => 'Hemoglobin', 'unit' => 'g/dL', 'value' => '17.0', 'flag' => 'Invalid Entry']], $prior) === [], 'Invalid values must not be analyzed.');
echo "Historical anomaly tests passed.\n";
