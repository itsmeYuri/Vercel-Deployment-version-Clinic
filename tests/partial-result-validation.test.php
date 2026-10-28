<?php
require_once __DIR__ . '/../app/core/result-validation.php';

$validRows = [['parameter' => 'WBC', 'flag' => 'Normal'], ['parameter' => 'Hemoglobin', 'flag' => 'Normal']];
$partial = ['issues' => ['Missing required parameter: Platelets.'], 'values' => $validRows];
if (!clinic_only_missing_required_parameters($partial)) throw new RuntimeException('Two valid values out of three must be allowed for pending review.');
if (clinic_only_missing_required_parameters(['issues' => $partial['issues'], 'values' => []])) throw new RuntimeException('An empty result must remain blocked.');
if (clinic_only_missing_required_parameters(['issues' => [...$partial['issues'], 'Wrong laboratory test: CRP'], 'values' => $validRows])) throw new RuntimeException('A wrong test must remain blocked.');
if (clinic_only_missing_required_parameters(['issues' => $partial['issues'], 'values' => [['parameter' => 'WBC', 'flag' => 'Invalid Entry']]])) throw new RuntimeException('An invalid entered value must remain blocked.');

echo "Partial result validation passed.\n";
