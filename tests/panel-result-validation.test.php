<?php
require_once __DIR__ . '/../app/core/result-validation.php';

function check_panel($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

$legacyHeading = ['parameter' => 'Complete Blood Count', 'required' => true];
check_panel(clinic_is_panel_heading_rule('Complete Blood Count', [$legacyHeading], $legacyHeading['parameter']), 'CBC title must not be a result measurement.');
check_panel(!clinic_is_panel_heading_rule('C-Reactive Protein', [['parameter' => 'CRP']], 'CRP'), 'A single analyte rule must remain measurable.');
check_panel(clinic_is_panel_heading_rule('Iron Studies', [['parameter' => 'Iron Studies'], ['parameter' => 'Ferritin']], 'Iron Studies'), 'A configured panel title must not become a required result.');
check_panel(count(clinic_panel_required_parameters('Complete Blood Count')) === 8, 'CBC must identify its eight core measured components.');
check_panel(clinic_panel_required_parameters('C-Reactive Protein') === [], 'A single-analyte test must not inherit CBC requirements.');

$rules = clinic_validate_rule_config([
    ['parameter' => 'Hemoglobin', 'unit' => 'g/dL', 'source' => 'Approved CBC rule', 'minimum' => 12, 'maximum' => 16, 'required' => true],
    ['parameter' => 'Platelets', 'unit' => 'x10^9/L', 'source' => 'Approved CBC rule', 'minimum' => 150, 'maximum' => 450, 'required' => true],
]);
$report = clinic_evaluate_values([['parameter' => 'Hgb', 'value' => '13.2', 'unit' => 'g/dL', 'referenceRange' => '12-16']], $rules);
check_panel($report['issues'] === ['Missing required parameter: Platelets.'], 'Only the missing CBC component should be reported.');
check_panel($report['values'][0]['flag'] === 'Normal', 'CBC aliases should use the matching approved component rule.');
check_panel(clinic_only_missing_required_parameters($report), 'A partial component report should remain uploadable for review.');

echo "Panel component validation passed.\n";
