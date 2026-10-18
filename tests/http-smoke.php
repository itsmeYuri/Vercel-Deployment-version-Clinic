<?php
// Run only against the local PHP server and disposable demo accounts.
require_once __DIR__ . '/../app/core/result-validation.php';
$base = 'http://127.0.0.1:8099/api/index.php';
$cookie = tempnam(sys_get_temp_dir(), 'clinic-http-test-');
function request_local($base, $cookie, $action, $payload = null, $token = '', $extra = []) {
    $curl = curl_init($base . '?' . http_build_query(['action' => $action] + $extra));
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_COOKIEFILE => $cookie,
        CURLOPT_COOKIEJAR => $cookie,
        CURLOPT_TIMEOUT => 20,
    ]);
    if ($payload !== null) curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-CSRF-Token: ' . $token],
    ]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    if ($body === false) throw new RuntimeException(curl_error($curl));
    return [$status, $body, json_decode($body, true)];
}
try {
    [$status, , $session] = request_local($base, $cookie, 'session');
    if ($status !== 401 || empty($session['data']['csrfToken'])) throw new RuntimeException('Could not obtain a local CSRF session.');
    [$status, , $login] = request_local($base, $cookie, 'login', ['identifier' => 'patient', 'password' => 'patient123'], $session['data']['csrfToken']);
    if ($status !== 200 || empty($login['success'])) throw new RuntimeException('Demo patient login failed: ' . ($login['message'] ?? $status) . ' ' . json_encode($login['errors'] ?? []));
    [$status, , $results] = request_local($base, $cookie, 'patient_results');
    if ($status !== 200 || empty($results['success']) || !is_array($results['data']['results'] ?? null)) throw new RuntimeException('Patient results API failed.');
    foreach ($results['data']['results'] as $result) {
        if ($result['status'] !== 'Released') throw new RuntimeException('Patient API exposed an unreleased result.');
    }
    echo 'Patient login and released-result access passed; ' . count($results['data']['results']) . " visible results.\n";
    [$status, , $notifications] = request_local($base, $cookie, 'notifications');
    if ($status !== 200 || empty($notifications['success'])) throw new RuntimeException('Patient notifications API failed.');
    $releaseNotice = array_filter($notifications['data']['notifications'] ?? [], fn($item) => ($item['title'] ?? '') === 'New result released');
    if (!$releaseNotice) throw new RuntimeException('No released-result availability notification was visible to the demo patient.');
    echo "Patient result-availability notification passed.\n";
    $page = curl_init('http://127.0.0.1:8099/public/patient/dashboard.php');
    curl_setopt_array($page, [CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEFILE => $cookie, CURLOPT_COOKIEJAR => $cookie, CURLOPT_TIMEOUT => 20]);
    $markup = curl_exec($page);
    if (curl_getinfo($page, CURLINFO_RESPONSE_CODE) !== 200 || !str_contains($markup ?: '', 'patient-result-tools.js')) {
        throw new RuntimeException('Patient page did not load the comparison and glossary module.');
    }
    echo "Patient page and new frontend module passed.\n";
    if ($results['data']['results']) {
        $id = $results['data']['results'][0]['id'];
        [$forbidden] = request_local($base, $cookie, 'validate_result', ['resultId' => $id, 'values' => $results['data']['results'][0]['values']], $login['data']['csrfToken'] ?? $session['data']['csrfToken']);
        if ($forbidden !== 403) throw new RuntimeException('Patient unexpectedly accessed staff-only result validation.');
        echo "Staff-only validation access control passed.\n";
        [$status, $html] = request_local($base, $cookie, 'download_result_details', null, '', ['id' => (int) $id]);
        if ($status !== 200 || !str_contains($html, 'Laboratory Result')) throw new RuntimeException('Released-result download failed.');
        foreach ($results['data']['results'][0]['values'] ?? [] as $value) {
            if (!str_contains($html, htmlspecialchars(clinic_patient_value_label($value), ENT_QUOTES, 'UTF-8'))) {
                throw new RuntimeException('Downloaded result did not show the safe patient range assessment.');
            }
        }
        echo "Released-result download passed.\n";
    }
} finally {
    @unlink($cookie);
}
