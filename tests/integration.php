<?php

declare(strict_types=1);

$base = rtrim(getenv('CLINIC_TEST_URL') ?: 'http://127.0.0.1:8099', '/');
$passes = 0;
$failures = [];

function check(bool $condition, string $label): void
{
    global $passes, $failures;
    if ($condition) {
        $passes++;
        echo "[PASS] {$label}\n";
        return;
    }
    $failures[] = $label;
    echo "[FAIL] {$label}\n";
}

function client(string $base): array
{
    $cookie = tempnam(sys_get_temp_dir(), 'clinic-test-');
    $html = request($base, $cookie, 'GET', '/public/auth/login.php');
    preg_match('/<meta name="csrf-token" content="([^"]+)"/', $html['body'], $match);
    return ['base' => $base, 'cookie' => $cookie, 'csrf' => html_entity_decode($match[1] ?? '', ENT_QUOTES)];
}

function request(string $base, string $cookie, string $method, string $path, ?array $payload = null, string $csrf = ''): array
{
    $curl = curl_init($base . $path);
    $headers = ['Accept: application/json'];
    if ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    if ($csrf !== '') {
        $headers[] = 'X-CSRF-Token: ' . $csrf;
    }
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_COOKIEJAR => $cookie,
        CURLOPT_COOKIEFILE => $cookie,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_POSTFIELDS => $payload === null ? null : json_encode($payload, JSON_THROW_ON_ERROR),
    ]);
    $raw = curl_exec($curl);
    if ($raw === false) {
        throw new RuntimeException(curl_error($curl));
    }
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $headerSize = curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    curl_close($curl);
    $body = substr($raw, $headerSize);
    return [
        'status' => $status,
        'headers' => substr($raw, 0, $headerSize),
        'body' => $body,
        'json' => json_decode($body, true),
    ];
}

function api(array &$client, string $action, array $payload = []): array
{
    $response = request($client['base'], $client['cookie'], 'POST', '/api/index.php?action=' . rawurlencode($action), $payload, $client['csrf']);
    if (!empty($response['json']['data']['csrfToken'])) {
        $client['csrf'] = $response['json']['data']['csrfToken'];
    }
    return $response;
}

function login(array &$client, string $identifier, string $password): array
{
    return api($client, 'login', ['identifier' => $identifier, 'password' => $password]);
}

$admin = client($base);
$doctor = client($base);
$lab = client($base);
$patient = client($base);

$missingCsrf = request($base, $admin['cookie'], 'POST', '/api/index.php?action=login', ['identifier' => 'admin', 'password' => 'admin123']);
check($missingCsrf['status'] === 419, 'POST requests reject missing CSRF tokens');

$invalidJson = curl_init($base . '/api/index.php?action=login');
curl_setopt_array($invalidJson, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_CUSTOMREQUEST => 'POST',
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-CSRF-Token: ' . $admin['csrf']],
    CURLOPT_COOKIEJAR => $admin['cookie'],
    CURLOPT_COOKIEFILE => $admin['cookie'],
    CURLOPT_POSTFIELDS => '{broken',
]);
$invalidRaw = curl_exec($invalidJson);
$invalidStatus = curl_getinfo($invalidJson, CURLINFO_RESPONSE_CODE);
curl_close($invalidJson);
check($invalidStatus === 400 && str_contains((string) $invalidRaw, '"success":false'), 'Malformed JSON returns a valid 400 JSON response');

foreach ([
    [&$admin, 'admin', 'admin123', 'Admin'],
    [&$doctor, 'doctor', 'doctor123', 'Doctor'],
    [&$lab, 'lab', 'lab123', 'Laboratory Staff'],
    [&$patient, 'patient', 'patient123', 'Patient'],
] as &$account) {
    $login = login($account[0], $account[1], $account[2]);
    check($login['status'] === 200 && ($login['json']['data']['user']['role'] ?? '') === $account[3], $account[3] . ' login');
}
unset($account);

$adminPrivate = api($admin, 'patient_profile');
check($adminPrivate['status'] === 403, 'Admin cannot call patient-private profile API');

$patientData = api($patient, 'app_data');
$patientId = (int) ($patientData['json']['data']['currentUser']['patientId'] ?? 0);
$patientRecords = $patientData['json']['data']['patients'] ?? [];
$patientOrders = $patientData['json']['data']['orders'] ?? [];
$patientResults = $patientData['json']['data']['results'] ?? [];
check($patientData['status'] === 200 && count($patientRecords) === 1 && (int) $patientRecords[0]['id'] === $patientId, 'Patient app data contains only the signed-in patient');
check(!array_filter($patientOrders, fn ($row) => (int) $row['patientId'] !== $patientId), 'Patient orders are isolated by patient ID');
check(!array_filter($patientResults, fn ($row) => (int) $row['patientId'] !== $patientId || $row['status'] !== 'Released'), 'Patient sees only own released results');
$foreignDownload = request($base, $patient['cookie'], 'GET', '/api/index.php?action=download_result_details&id=3');
check($foreignDownload['status'] === 404, 'Patient cannot download another patient result');

$doctorData = api($doctor, 'app_data');
if ($doctorData['status'] !== 200) {
    echo '[DEBUG] Doctor app_data: ' . $doctorData['body'] . "\n";
}
$doctorPayload = $doctorData['json']['data'] ?? [];
$doctorFacilityId = (int) ($doctorPayload['currentUser']['assignedFacilityId'] ?? 0);
$doctorPatients = $doctorPayload['availablePatients'] ?? [];
check($doctorData['status'] === 200 && $doctorFacilityId > 0, 'Doctor dashboard loads assigned facility from database');
check(!array_filter($doctorPatients, fn ($row) => (int) ($row['primaryFacilityId'] ?? 0) !== $doctorFacilityId && (int) ($row['orderCount'] ?? 0) === 0), 'Doctor patient list is limited to assigned facility or own orders');

$doctorOrderPage = api($doctor, 'page_data', ['page' => 'create-order']);
check($doctorOrderPage['status'] === 200 && in_array('create-order', $doctorOrderPage['json']['data']['loadedPages'] ?? [], true), 'Doctor lazily loads laboratory request form data');
$activeTest = array_values(array_filter($doctorOrderPage['json']['data']['tests'] ?? [], fn ($test) => $test['status'] === 'Active'))[0] ?? null;
$orderPatient = array_values(array_filter($doctorPatients, fn ($row) => (int) $row['id'] === $patientId))[0] ?? $doctorPatients[0] ?? null;
$createOrder = api($doctor, 'create_order', [
    'patientId' => $orderPatient['id'] ?? 0,
    'facilityId' => $doctorFacilityId,
    'testIds' => [$activeTest['id'] ?? 0],
    'priority' => 'Priority',
    'clinicalNotes' => 'Automated integration workflow.',
    'status' => 'Released',
]);
$orderId = (int) ($createOrder['json']['data']['orderId'] ?? 0);
check($createOrder['status'] === 200 && $orderId > 0, 'Doctor creates a laboratory order');
$createdOrder = array_values(array_filter($createOrder['json']['data']['orders'] ?? [], fn ($row) => (int) $row['id'] === $orderId))[0] ?? [];
check(($createdOrder['status'] ?? '') === 'Pending' && ($createdOrder['priority'] ?? '') === 'Priority', 'New order is forced to Pending with allowed priority');

$invalidTransition = api($lab, 'update_order_status', ['orderId' => $orderId, 'status' => 'Processing']);
check($invalidTransition['status'] === 409, 'Lab workflow rejects invalid order status jumps');
foreach (['Accepted', 'Sample Collected', 'Processing'] as $status) {
    $transition = api($lab, 'update_order_status', ['orderId' => $orderId, 'status' => $status]);
    check($transition['status'] === 200, "Lab moves order to {$status}");
}

$upload = api($lab, 'upload_result', [
    'orderId' => $orderId,
    'findings' => 'Integration result findings.',
    'remarks' => 'Quality control passed.',
    'values' => [['parameter' => 'WBC', 'value' => '7.1', 'unit' => 'x10^9/L', 'referenceRange' => '4.5-11.0', 'flag' => 'Regular']],
    'attachments' => [[
        'name' => 'result.png',
        'type' => 'image/png',
        'size' => strlen(base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')),
        'data' => 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    ]],
]);
$resultNumber = $upload['json']['data']['resultNumber'] ?? '';
check($upload['status'] === 200 && $resultNumber !== '', 'Lab uploads structured result');
$uploadedResult = array_values(array_filter($upload['json']['data']['results'] ?? [], fn ($row) => $row['resultNumber'] === $resultNumber))[0] ?? [];
$resultId = (int) ($uploadedResult['id'] ?? 0);
check(count($uploadedResult['files'] ?? []) === 1, 'Lab result attachment metadata is saved');
$attachmentId = (int) ($uploadedResult['files'][0]['id'] ?? 0);
$attachmentDownload = request($base, $lab['cookie'], 'GET', '/api/index.php?action=download_result_file&id=' . $attachmentId);
check($attachmentDownload['status'] === 200 && str_contains($attachmentDownload['headers'], 'image/png'), 'Authorized lab staff can download a validated result attachment');

$earlyRelease = api($lab, 'release_result', ['resultId' => $resultId]);
check($earlyRelease['status'] === 409, 'Pending-review result cannot be released before verification');
$selfVerify = api($lab, 'update_result_status', ['resultId' => $resultId, 'status' => 'Verified']);
check($selfVerify['status'] === 409, 'Result entry staff cannot verify their own result');
$reviewer = client($base);
$reviewerLogin = login($reviewer, 'marco', 'lab123');
check($reviewerLogin['status'] === 200, 'Second laboratory staff login');
$verify = api($reviewer, 'update_result_status', ['resultId' => $resultId, 'status' => 'Verified']);
check($verify['status'] === 200, 'A different laboratory staff member verifies result');
$release = api($reviewer, 'release_result', ['resultId' => $resultId]);
check($release['status'] === 200, 'A different laboratory staff member releases verified result');

$note = api($doctor, 'add_clinical_note', ['resultId' => $resultId, 'note' => 'Integration clinical note.']);
check($note['status'] === 200, 'Doctor adds a clinical note to own result');
$patientAfter = api($patient, 'app_data');
$visibleResult = array_values(array_filter($patientAfter['json']['data']['results'] ?? [], fn ($row) => (int) $row['id'] === $resultId))[0] ?? [];
check(($visibleResult['clinicalNote'] ?? '') === 'Integration clinical note.', 'Patient sees released own result and clinical note');

$secondPatient = array_values(array_filter($doctorPatients, fn ($row) => (int) $row['id'] !== (int) ($orderPatient['id'] ?? 0) && (int) ($row['primaryFacilityId'] ?? 0) === $doctorFacilityId))[0] ?? $orderPatient;
$secondOrder = api($doctor, 'create_order', [
    'patientId' => $secondPatient['id'] ?? 0,
    'facilityId' => $doctorFacilityId,
    'testIds' => [$activeTest['id'] ?? 0],
    'priority' => 'Regular',
]);
$secondOrderId = (int) ($secondOrder['json']['data']['orderId'] ?? 0);
foreach (['Accepted', 'Sample Collected', 'Processing'] as $status) {
    api($lab, 'update_order_status', ['orderId' => $secondOrderId, 'status' => $status]);
}
$secondUpload = api($lab, 'upload_result', ['orderId' => $secondOrderId, 'findings' => 'Rejected test result.', 'values' => []]);
$secondNumber = $secondUpload['json']['data']['resultNumber'] ?? '';
$secondResult = array_values(array_filter($secondUpload['json']['data']['results'] ?? [], fn ($row) => $row['resultNumber'] === $secondNumber))[0] ?? [];
$reject = api($lab, 'reject_result', ['resultId' => $secondResult['id'] ?? 0, 'reason' => 'Specimen integrity failure.']);
check($reject['status'] === 200, 'Lab rejects result with a reason');

$newUserName = 'Integration User ' . bin2hex(random_bytes(3));
$newUser = api($admin, 'save_user', [
    'name' => $newUserName,
    'email' => strtolower(str_replace(' ', '.', $newUserName)) . '@example.test',
    'username' => 'itest.' . bin2hex(random_bytes(3)),
    'password' => 'Testpass1234',
    'role' => 'Laboratory Staff',
    'facilityId' => $doctorFacilityId,
    'status' => 'Active',
]);
$newUserId = (int) ($newUser['json']['data']['user']['id'] ?? 0);
check($newUser['status'] === 200 && $newUserId > 0, 'Admin creates assigned lab staff account');
$deactivate = api($admin, 'delete_user', ['id' => $newUserId]);
check($deactivate['status'] === 200, 'Admin deactivates account without deleting clinical history');

$registration = client($base);
$suffix = bin2hex(random_bytes(4));
$registered = api($registration, 'register_patient', [
    'fullName' => 'Integration Patient',
    'dateOfBirth' => '1990-01-01',
    'sex' => 'Prefer not to say',
    'email' => "integration.{$suffix}@example.test",
    'contact' => '+63 917 555 0101',
    'address' => '100 Integration Street, Manila',
    'username' => "integration.{$suffix}",
    'password' => 'Patient12345',
    'termsAccepted' => true,
    'privacyAcknowledged' => true,
]);
check($registered['status'] === 200 && ($registered['json']['data']['user']['role'] ?? '') === 'Patient', 'Patient self-registration saves a database-backed account');

$maintenanceOn = api($admin, 'save_maintenance_settings', [
    'isEnabled' => true,
    'scope' => 'pages',
    'affectedRoles' => [],
    'affectedPages' => ['orders'],
    'message' => 'Integration maintenance window.',
]);
check($maintenanceOn['status'] === 200 && ($maintenanceOn['json']['data']['maintenance']['isActive'] ?? false), 'Admin enables database-backed page maintenance');
$blockedPage = request($base, $doctor['cookie'], 'GET', '/public/doctor/orders.php');
check($blockedPage['status'] === 302 && str_contains($blockedPage['headers'], 'maintenance.php'), 'Selected maintenance page redirects non-admin users');
$blockedPageData = api($doctor, 'page_data', ['page' => 'orders']);
check($blockedPageData['status'] === 503, 'Selected maintenance page also blocks lazy API loading');
$maintenanceOff = api($admin, 'save_maintenance_settings', [
    'isEnabled' => false,
    'scope' => 'all',
    'message' => 'Maintenance is complete.',
]);
check($maintenanceOff['status'] === 200 && !($maintenanceOff['json']['data']['maintenance']['isActive'] ?? true), 'Admin disables maintenance mode');

$logout = api($patient, 'logout');
check($logout['status'] === 200, 'Logout clears the API session');
$loggedOutSession = api($patient, 'session');
check($loggedOutSession['status'] === 401, 'Logged-out session cannot access protected data');

foreach ([$admin, $doctor, $lab, $reviewer, $patient, $registration] as $testClient) {
    @unlink($testClient['cookie']);
}

echo "\n{$passes} checks passed; " . count($failures) . " failed.\n";
if ($failures) {
    echo 'Failures: ' . implode('; ', $failures) . "\n";
    exit(1);
}
