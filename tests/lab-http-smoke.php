<?php
// Read-only workflow smoke test against the local PHP server and demo database.
$base = 'http://127.0.0.1:8099/api/index.php';
$cookie = tempnam(sys_get_temp_dir(), 'clinic-lab-test-');
function lab_request($base, $cookie, $action, $payload = null, $token = '') {
    $curl = curl_init($base . '?action=' . rawurlencode($action));
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEFILE => $cookie, CURLOPT_COOKIEJAR => $cookie, CURLOPT_TIMEOUT => 20]);
    if ($payload !== null) curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($payload), CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-CSRF-Token: ' . $token]]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    if ($body === false) throw new RuntimeException(curl_error($curl));
    return [$status, json_decode($body, true)];
}
try {
    [, $session] = lab_request($base, $cookie, 'session');
    $token = $session['data']['csrfToken'] ?? '';
    [$status, $login] = lab_request($base, $cookie, 'login', ['identifier' => 'lab', 'password' => 'lab123'], $token);
    if ($status !== 200 || empty($login['success'])) throw new RuntimeException('Lab demo login failed: ' . ($login['message'] ?? $status));
    $token = $login['data']['csrfToken'] ?? $token;
    [$status, $data] = lab_request($base, $cookie, 'app_data', ['page' => 'review'], $token);
    if ($status !== 200 || empty($data['success'])) throw new RuntimeException('Lab review data failed: ' . ($data['message'] ?? $status));
    $results = $data['data']['results'] ?? [];
    $result = current(array_filter($results, fn($row) => !empty($row['values']))) ?: null;
    if (!$result) throw new RuntimeException('No structured result available for validation smoke test.');
    [$status, $validation] = lab_request($base, $cookie, 'validate_result', ['resultId' => $result['id'], 'values' => $result['values']], $token);
    if ($status !== 200 || empty($validation['success']) || !is_array($validation['data']['validation']['anomalies'] ?? null)) {
        throw new RuntimeException('Live validation did not include historical anomaly assessment: ' . ($validation['message'] ?? $status));
    }
    echo 'Laboratory login and live validation passed for result ' . $result['resultNumber'] . ".\n";
} finally {
    @unlink($cookie);
}
