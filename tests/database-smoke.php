<?php
// Read-only smoke check against a separately configured test database.
require_once __DIR__ . '/../app/config/database.php';
require_once __DIR__ . '/../app/core/result-validation.php';
function one($pdo, $sql, $params = []) {
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetch() ?: null;
}
function all_rows($pdo, $sql, $params = []) {
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}
$pdo = db();
foreach (['lab_orders', 'lab_results', 'lab_result_values', 'notifications'] as $table) {
    $count = $pdo->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn();
    echo $table . ': ' . $count . " rows\n";
}
$orderId = $pdo->query('SELECT id FROM lab_orders ORDER BY id LIMIT 1')->fetchColumn();
if ($orderId) {
    $alerts = clinic_historical_anomalies($pdo, (int) $orderId, [
        ['parameter' => 'Hemoglobin', 'unit' => 'g/dL', 'value' => '12.5', 'flag' => 'Normal'],
    ]);
    if (!is_array($alerts)) throw new RuntimeException('Historical anomaly query did not return an array.');
    echo 'Historical query against an existing order: passed' . "\n";
}
$released = $pdo->query("SELECT COUNT(*) FROM lab_results WHERE status='Released'")->fetchColumn();
$releaseNotifications = $pdo->query("SELECT COUNT(*) FROM notifications WHERE title='New result released'")->fetchColumn();
echo 'Released results: ' . $released . ', patient release notifications: ' . $releaseNotifications . "\n";
