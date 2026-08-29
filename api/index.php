<?php

ob_start();
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../app/config/database.php';
require_once __DIR__ . '/../app/core/maintenance.php';
require_once __DIR__ . '/../app/core/session.php';
require_once __DIR__ . '/../app/core/storage.php';

clinic_start_session();

header('Content-Type: application/json; charset=utf-8');

function respond($success, $message = 'OK', $data = [], $status = 200, $errors = [])
{
    if (ob_get_length()) {
        ob_clean();
    }
    http_response_code($status);
    echo json_encode([
        'success' => (bool) $success,
        'ok' => (bool) $success,
        'message' => $message,
        'data' => $data,
        'errors' => empty($errors) ? new stdClass() : $errors,
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

register_shutdown_function(function () {
    $error = error_get_last();
    if (!$error || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
    }
    if (ob_get_length()) {
        ob_clean();
    }
    $debug = (defined('APP_DEBUG') && APP_DEBUG) || getenv('APP_DEBUG') === '1';
    $errors = $debug ? [
        'exception' => 'FatalError',
        'message' => $error['message'],
        'file' => $error['file'],
        'line' => $error['line'],
    ] : new stdClass();
    echo json_encode([
        'success' => false,
        'ok' => false,
        'message' => 'Fatal server error while processing the request.',
        'data' => [],
        'errors' => $errors,
    ], JSON_UNESCAPED_SLASHES);
});

function request_data()
{
    $raw = file_get_contents('php://input') ?: '';
    $json = json_decode($raw, true);
    if (is_array($json)) {
        return $json;
    }
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if ($raw !== '' && stripos($contentType, 'application/json') !== false && json_last_error() !== JSON_ERROR_NONE) {
        respond(false, 'Invalid JSON payload. Please refresh and try again.', [], 400, ['json' => json_last_error_msg()]);
    }
    return $_POST ?: [];
}

function validate_csrf_request($action)
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST' || in_array($action, ['health', 'session'], true)) {
        return;
    }
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $expected = (string) ($_SESSION['csrf_token'] ?? '');
    if ($provided === '' || $expected === '' || !hash_equals($expected, $provided)) {
        respond(false, 'Your session security token is invalid or expired. Refresh the page and try again.', [], 419);
    }
}

function rotate_csrf_token()
{
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf_token'];
}

function require_field($data, $key, $label = null)
{
    $value = trim((string) ($data[$key] ?? ''));
    if ($value === '') {
        respond(false, ($label ?: ucfirst($key)) . ' is required.', [], 422, [$key => 'Required']);
    }
    return $value;
}

function optional_string($data, $key, $default = null)
{
    if (!isset($data[$key])) {
        return $default;
    }
    $value = trim((string) $data[$key]);
    return $value === '' ? $default : $value;
}

function validate_max_length($value, $max, $label, $key)
{
    if ($value !== null && mb_strlen((string) $value) > $max) {
        respond(false, $label . ' cannot exceed ' . $max . ' characters.', [], 422, [$key => 'Too long']);
    }
}

function one($pdo, $sql, $params = [])
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row ?: null;
}

function all_rows($pdo, $sql, $params = [])
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function initials($name)
{
    $parts = preg_split('/\s+/', trim($name)) ?: [];
    $letters = '';
    foreach (array_slice($parts, 0, 2) as $part) {
        if ($part !== '') {
            $letters .= substr($part, 0, 1);
        }
    }
    return strtoupper($letters ?: 'U');
}

function role_id($pdo, $role)
{
    $row = one($pdo, 'SELECT id FROM roles WHERE name = ? LIMIT 1', [$role]);
    if (!$row) {
        respond(false, 'Invalid role selected.', [], 422, ['role' => 'Invalid role']);
    }
    return (int) $row['id'];
}

function demo_hash_matches($password, $stored)
{
    $prefix = 'cms-demo-sha256$';
    if (strpos($stored, $prefix) !== 0) {
        return false;
    }
    return hash_equals(substr($stored, strlen($prefix)), hash('sha256', $password));
}

function password_match_type($password, $stored)
{
    if (password_verify($password, $stored)) {
        return 'password_hash';
    }
    if (demo_hash_matches($password, $stored)) {
        return 'demo_hash';
    }
    return false;
}

function public_user_from_row($row)
{
    if (!$row) {
        return null;
    }
    return [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'username' => $row['username'],
        'role' => $row['role'],
        'avatar' => $row['avatar'],
        'contact' => $row['contact'],
        'status' => $row['status'],
        'assignedFacilityId' => isset($row['assigned_facility_id']) ? ($row['assigned_facility_id'] === null ? null : (int) $row['assigned_facility_id']) : null,
        'assignedFacility' => $row['assigned_facility'] ?? null,
        'patientId' => isset($row['patient_id']) ? ($row['patient_id'] === null ? null : (int) $row['patient_id']) : null,
        'patientProfileId' => $row['patient_code'] ?? null,
        'dateOfBirth' => $row['date_of_birth'] ?? null,
        'sex' => $row['sex'] ?? null,
        'address' => $row['address'] ?? null,
        'createdAt' => $row['created_at'] ?? null,
    ];
}

function fetch_user($pdo, $id)
{
    $sql = 'SELECT u.id, u.name, u.email, u.username, u.avatar, u.contact, u.status, u.created_at, r.name AS role,
                   p.id AS patient_id, p.patient_code, p.date_of_birth, p.sex, p.address,
                   CASE
                     WHEN r.name = "Patient" THEN p.primary_facility_id
                     WHEN r.name = "Doctor" THEN d.assigned_facility_id
                     WHEN r.name = "Laboratory Staff" THEN ls.default_facility_id
                     ELSE NULL
                   END AS assigned_facility_id,
                   CASE
                     WHEN r.name = "Patient" THEN pf.name
                     WHEN r.name = "Doctor" THEN df.name
                     WHEN r.name = "Laboratory Staff" THEN lf.name
                     ELSE NULL
                   END AS assigned_facility
            FROM users u
            JOIN roles r ON r.id = u.role_id
            LEFT JOIN patients p ON p.user_id = u.id
            LEFT JOIN doctors d ON d.user_id = u.id
            LEFT JOIN laboratory_staff ls ON ls.user_id = u.id
            LEFT JOIN facilities pf ON pf.id = p.primary_facility_id
            LEFT JOIN facilities df ON df.id = d.assigned_facility_id
            LEFT JOIN facilities lf ON lf.id = ls.default_facility_id
            WHERE u.id = ? AND u.status = "Active"
            LIMIT 1';
    return public_user_from_row(one($pdo, $sql, [$id]));
}

function current_user($pdo)
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $user = fetch_user($pdo, (int) $_SESSION['user_id']);
    if (!$user) {
        unset($_SESSION['user_id']);
    }
    return $user;
}

function require_auth($pdo, $roles = [])
{
    global $action;

    $user = current_user($pdo);
    if (!$user) {
        respond(false, 'Please sign in to continue.', [], 401);
    }
    if ($roles && !in_array($user['role'], $roles, true)) {
        respond(false, 'You do not have permission to perform this action.', [], 403);
    }
    if (api_maintenance_should_block($action ?? '', $user)) {
        $page = api_maintenance_page_from_action($action ?? '');
        $decision = clinic_maintenance_decision($pdo, $user['role'], $page);
        if ($decision['blocked']) {
            respond(false, $decision['settings']['message'], [
                'maintenance' => clinic_maintenance_public_settings($decision['settings']),
            ], 503);
        }
    }
    return $user;
}

function api_maintenance_should_block($action, $user)
{
    if (($user['role'] ?? '') === 'Admin') {
        return false;
    }
    return !in_array($action, [
        'health', 'login', 'logout', 'session',
        'maintenance_settings', 'save_maintenance_settings',
    ], true);
}

function api_maintenance_page_from_action($action)
{
    $map = [
        'app_data' => 'dashboard',
        'store_read' => 'dashboard',
        'list_users' => 'users',
        'save_user' => 'users',
        'create_user' => 'users',
        'update_user' => 'users',
        'delete_user' => 'users',
        'toggle_user_status' => 'users',
        'reset_user_password' => 'users',
        'list_facilities' => 'facilities',
        'available_facilities' => 'facilities',
        'lab_facilities' => 'facilities',
        'save_facility' => 'facilities',
        'create_facility' => 'facilities',
        'update_facility' => 'facilities',
        'list_tests' => 'tests',
        'available_tests' => 'tests',
        'save_test' => 'tests',
        'create_test' => 'tests',
        'update_test' => 'tests',
        'list_all_orders' => 'orders',
        'doctor_orders' => 'orders',
        'lab_orders' => 'orders',
        'patient_orders' => 'orders',
        'create_order' => 'create-order',
        'update_order_status' => 'orders',
        'list_all_results' => 'results',
        'doctor_results' => 'results',
        'patient_results' => 'results',
        'prepare_result_uploads' => 'upload',
        'upload_result' => 'upload',
        'update_result_status' => 'review',
        'review_result' => 'review',
        'release_result' => 'review',
        'reject_result' => 'review',
        'add_clinical_note' => 'results',
        'doctor_patients' => 'patients',
        'patient_profile' => 'profile',
        'update_patient_profile' => 'profile',
        'change_password' => 'settings',
        'notifications' => 'notifications',
        'mark_notification_read' => 'notifications',
        'mark_all_notifications_read' => 'notifications',
        'audit_logs' => 'audit',
        'reports_summary' => 'reports',
        'admin_dashboard' => 'dashboard',
        'doctor_dashboard' => 'dashboard',
        'lab_dashboard' => 'dashboard',
        'patient_dashboard' => 'dashboard',
        'lab_queue' => 'queue',
    ];
    return $map[$action] ?? 'dashboard';
}

function audit_log($pdo, $user, $action, $module, $details)
{
    $stmt = $pdo->prepare('INSERT INTO audit_logs (user_id, user_name, role_name, action, module, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $user['id'] ?? null,
        $user['name'] ?? 'System',
        $user['role'] ?? 'Service',
        $action,
        $module,
        substr($details, 0, 255),
        $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
    ]);
}

function notify_user($pdo, $payload)
{
    $stmt = $pdo->prepare('INSERT INTO notifications (user_id, patient_id, role_name, title, message, type_name, related_order_id, related_result_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $payload['user_id'] ?? null,
        $payload['patient_id'] ?? null,
        $payload['role_name'] ?? null,
        $payload['title'],
        substr($payload['message'], 0, 255),
        $payload['type_name'] ?? 'orders',
        $payload['related_order_id'] ?? null,
        $payload['related_result_id'] ?? null,
    ]);
}

function notify_facility_staff($pdo, $facilityId, $payload)
{
    $rows = all_rows(
        $pdo,
        'SELECT DISTINCT u.id
         FROM users u
         JOIN roles r ON r.id = u.role_id AND r.name = "Laboratory Staff"
         LEFT JOIN laboratory_staff ls ON ls.user_id = u.id
         LEFT JOIN staff_facilities sf ON sf.user_id = u.id
         WHERE u.status = "Active" AND (ls.default_facility_id = ? OR sf.facility_id = ?)',
        [(int) $facilityId, (int) $facilityId]
    );
    foreach ($rows as $row) {
        $target = $payload;
        $target['user_id'] = (int) $row['id'];
        unset($target['role_name']);
        notify_user($pdo, $target);
    }
}

function placeholders($count)
{
    return implode(',', array_fill(0, max(1, $count), '?'));
}

function lab_facility_ids($pdo, $user)
{
    if ($user['role'] !== 'Laboratory Staff') {
        return [];
    }
    $rows = all_rows($pdo, 'SELECT facility_id FROM staff_facilities WHERE user_id = ?', [$user['id']]);
    $ids = array_map(function ($row) {
        return (int) $row['facility_id'];
    }, $rows);
    if (!$ids && $user['assignedFacilityId']) {
        $ids[] = (int) $user['assignedFacilityId'];
    }
    return array_values(array_unique($ids));
}

function facility_scope_sql($pdo, $user, $column = 'lo.facility_id')
{
    if ($user['role'] !== 'Laboratory Staff') {
        return ['', []];
    }
    $ids = lab_facility_ids($pdo, $user);
    if (!$ids) {
        return [' AND 1 = 0', []];
    }
    return [' AND ' . $column . ' IN (' . placeholders(count($ids)) . ')', $ids];
}

function debug_errors_enabled()
{
    return (defined('APP_DEBUG') && APP_DEBUG) || getenv('APP_DEBUG') === '1';
}

function error_details($e)
{
    if (!debug_errors_enabled()) {
        return [];
    }
    return [
        'exception' => get_class($e),
        'message' => $e->getMessage(),
    ];
}

function find_facility_id($pdo, $data, $allowDefault = false)
{
    $hasFacilityInput = false;
    foreach (['facilityId', 'facility_id', 'facility', 'facilityName'] as $key) {
        if (isset($data[$key]) && trim((string) $data[$key]) !== '') {
            $hasFacilityInput = true;
            break;
        }
    }

    $id = (int) ($data['facilityId'] ?? $data['facility_id'] ?? 0);
    if ($id > 0) {
        $row = one($pdo, 'SELECT id FROM facilities WHERE id = ? LIMIT 1', [$id]);
        if ($row) {
            return $id;
        }
    }
    $name = optional_string($data, 'facility') ?: optional_string($data, 'facilityName');
    if ($name) {
        $row = one($pdo, 'SELECT id FROM facilities WHERE name = ? LIMIT 1', [$name]);
        if ($row) {
            return (int) $row['id'];
        }
    }
    if (!$hasFacilityInput && $allowDefault) {
        $row = one($pdo, 'SELECT id FROM facilities WHERE status = "Active" ORDER BY id LIMIT 1');
        return $row ? (int) $row['id'] : null;
    }
    return null;
}

function generate_unique_code($pdo, $table, $column, $prefix)
{
    do {
        $code = $prefix . '-' . date('Y') . '-' . random_int(100000, 999999);
        $exists = one($pdo, "SELECT 1 FROM {$table} WHERE {$column} = ? LIMIT 1", [$code]);
    } while ($exists);
    return $code;
}

function generate_patient_code($pdo)
{
    do {
        $code = 'PT-' . random_int(10000, 99999);
        $exists = one($pdo, 'SELECT 1 FROM patients WHERE patient_code = ? LIMIT 1', [$code]);
    } while ($exists);
    return $code;
}

function order_by_identifier($pdo, $value)
{
    if (is_numeric($value)) {
        $row = one($pdo, 'SELECT * FROM lab_orders WHERE id = ? LIMIT 1', [(int) $value]);
        if ($row) {
            return $row;
        }
    }
    return one($pdo, 'SELECT * FROM lab_orders WHERE order_number = ? LIMIT 1', [$value]);
}

function result_by_identifier($pdo, $value)
{
    if (is_numeric($value)) {
        $row = one($pdo, 'SELECT * FROM lab_results WHERE id = ? LIMIT 1', [(int) $value]);
        if ($row) {
            return $row;
        }
    }
    return one($pdo, 'SELECT * FROM lab_results WHERE result_number = ? LIMIT 1', [$value]);
}

function can_access_order($pdo, $user, $order)
{
    if (!$order) {
        return false;
    }
    if ($user['role'] === 'Admin') {
        return true;
    }
    if ($user['role'] === 'Doctor') {
        return (int) $order['doctor_id'] === (int) $user['id'];
    }
    if ($user['role'] === 'Laboratory Staff') {
        return in_array((int) $order['facility_id'], lab_facility_ids($pdo, $user), true);
    }
    if ($user['role'] === 'Patient') {
        return (int) $order['patient_id'] === (int) $user['patientId'];
    }
    return false;
}

function can_access_result($pdo, $user, $result)
{
    if (!$result) {
        return false;
    }
    $order = one($pdo, 'SELECT * FROM lab_orders WHERE id = ? LIMIT 1', [(int) $result['order_id']]);
    if (!$order || !can_access_order($pdo, $user, $order)) {
        return false;
    }
    if ($user['role'] === 'Patient' && $result['status'] !== 'Released') {
        return false;
    }
    if ($user['role'] === 'Doctor' && !in_array($result['status'], ['Verified', 'Released'], true)) {
        return false;
    }
    return true;
}

function valid_order_statuses()
{
    return ['Pending', 'Pending Sample', 'Accepted', 'Sample Collected', 'Processing', 'In Progress', 'Rejected', 'Cancelled'];
}

function valid_result_statuses()
{
    return ['Verified', 'Released', 'Rejected'];
}

function valid_priorities()
{
    return ['Regular', 'Priority'];
}

function valid_active_statuses()
{
    return ['Active', 'Inactive'];
}

function valid_username($username)
{
    return preg_match('/^[a-zA-Z0-9._-]{3,20}$/', $username) === 1;
}

function valid_password($password)
{
    return preg_match('/^(?=.*[A-Za-z])(?=.*\d).{8,}$/', (string) $password) === 1;
}

function map_facility($row)
{
    return [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'address' => $row['address'],
        'phone' => $row['phone'],
        'email' => $row['email'],
        'status' => $row['status'],
        'activeOrders' => (int) ($row['active_orders'] ?? 0),
        'activeTests' => (int) ($row['active_tests'] ?? 0),
    ];
}

function fetch_facilities($pdo, $user = null)
{
    $params = [];
    $where = '';
    if ($user && $user['role'] === 'Laboratory Staff') {
        $ids = lab_facility_ids($pdo, $user);
        if (!$ids) {
            return [];
        }
        $where = 'WHERE f.id IN (' . placeholders(count($ids)) . ')';
        $params = $ids;
    } elseif ($user && $user['role'] === 'Doctor') {
        if (!$user['assignedFacilityId']) {
            return [];
        }
        $where = 'WHERE f.status = "Active" AND f.id = ?';
        $params[] = (int) $user['assignedFacilityId'];
    } elseif ($user && $user['role'] !== 'Admin') {
        $where = 'WHERE f.status = "Active"';
    }
    $sql = 'SELECT f.*,
                   (SELECT COUNT(*) FROM lab_orders lo WHERE lo.facility_id = f.id AND lo.status NOT IN ("Released","Rejected","Cancelled")) AS active_orders,
                   (SELECT COUNT(*) FROM test_definitions td WHERE td.status = "Active") AS active_tests
            FROM facilities f ' . $where . ' ORDER BY f.name';
    return array_map('map_facility', all_rows($pdo, $sql, $params));
}

function fetch_tests($pdo, $user = null)
{
    $where = ($user && $user['role'] !== 'Admin') ? 'WHERE status = "Active"' : '';
    $rows = all_rows($pdo, 'SELECT * FROM test_definitions ' . $where . ' ORDER BY name');
    return array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'code' => $row['code'],
            'name' => $row['name'],
            'category' => $row['category'],
            'sampleType' => $row['sample_type'],
            'turnaroundTime' => $row['turnaround_time'],
            'price' => (float) $row['price'],
            'referenceRange' => $row['reference_range'],
            'instructions' => $row['instructions'],
            'status' => $row['status'],
        ];
    }, $rows);
}

function fetch_users($pdo)
{
    $sql = 'SELECT u.id, u.name, u.email, u.username, u.avatar, u.contact, u.status, u.created_at, r.name AS role,
                   p.id AS patient_id, p.patient_code, p.date_of_birth, p.sex, p.address,
                   CASE
                     WHEN r.name = "Patient" THEN p.primary_facility_id
                     WHEN r.name = "Doctor" THEN d.assigned_facility_id
                     WHEN r.name = "Laboratory Staff" THEN ls.default_facility_id
                     ELSE NULL
                   END AS assigned_facility_id,
                   CASE
                     WHEN r.name = "Patient" THEN pf.name
                     WHEN r.name = "Doctor" THEN df.name
                     WHEN r.name = "Laboratory Staff" THEN lf.name
                     ELSE NULL
                   END AS assigned_facility
            FROM users u
            JOIN roles r ON r.id = u.role_id
            LEFT JOIN patients p ON p.user_id = u.id
            LEFT JOIN doctors d ON d.user_id = u.id
            LEFT JOIN laboratory_staff ls ON ls.user_id = u.id
            LEFT JOIN facilities pf ON pf.id = p.primary_facility_id
            LEFT JOIN facilities df ON df.id = d.assigned_facility_id
            LEFT JOIN facilities lf ON lf.id = ls.default_facility_id
            ORDER BY u.created_at DESC, u.id DESC';
    return array_map('public_user_from_row', all_rows($pdo, $sql));
}

function map_patient($row)
{
    return [
        'id' => (int) $row['id'],
        'userId' => (int) $row['user_id'],
        'patientCode' => $row['patient_code'],
        'name' => $row['name'],
        'email' => $row['email'],
        'username' => $row['username'],
        'avatar' => $row['avatar'],
        'contact' => $row['contact'],
        'dateOfBirth' => $row['date_of_birth'],
        'sex' => $row['sex'],
        'address' => $row['address'],
        'primaryFacilityId' => $row['primary_facility_id'] === null ? null : (int) $row['primary_facility_id'],
        'primaryFacility' => $row['facility_name'],
        'status' => $row['status'],
        'latestOrderNumber' => $row['latest_order_number'],
        'latestStatus' => $row['latest_status'],
        'latestTests' => $row['latest_tests'],
        'orderCount' => (int) $row['order_count'],
        'resultCount' => (int) $row['result_count'],
    ];
}

function fetch_patients($pdo, $user = null, $mode = 'role')
{
    $where = ['u.status = "Active"'];
    $params = [];
    $scopeLo = '';
    if ($user && $mode === 'role') {
        if ($user['role'] === 'Doctor') {
            $doctorId = (int) $user['id'];
            $facilityId = (int) ($user['assignedFacilityId'] ?? 0);
            $where[] = '(EXISTS (SELECT 1 FROM lab_orders access_order WHERE access_order.patient_id = p.id AND access_order.doctor_id = ?)'
                . ($facilityId > 0 ? ' OR p.primary_facility_id = ?' : '') . ')';
            $params[] = $doctorId;
            if ($facilityId > 0) {
                $params[] = $facilityId;
            }
            $scopeLo = ' AND lo.doctor_id = ' . $doctorId;
        } elseif ($user['role'] === 'Laboratory Staff') {
            $ids = lab_facility_ids($pdo, $user);
            if (!$ids) {
                return [];
            }
            $where[] = 'EXISTS (SELECT 1 FROM lab_orders lo WHERE lo.patient_id = p.id AND lo.facility_id IN (' . placeholders(count($ids)) . '))';
            $params = array_merge($params, $ids);
            $scopeLo = ' AND lo.facility_id IN (' . implode(',', array_map('intval', $ids)) . ')';
        } elseif ($user['role'] === 'Patient') {
            $where[] = 'p.id = ?';
            $params[] = $user['patientId'];
        }
    }
    $latestTestsAggregate = db_group_concat('loi.test_name', 'loi.id', ', ');
    $sql = 'SELECT p.*, u.name, u.email, u.username, u.avatar, u.contact, u.status, f.name AS facility_name,
                   (SELECT lo.order_number FROM lab_orders lo WHERE lo.patient_id = p.id' . $scopeLo . ' ORDER BY lo.created_at DESC LIMIT 1) AS latest_order_number,
                   (SELECT lo.status FROM lab_orders lo WHERE lo.patient_id = p.id' . $scopeLo . ' ORDER BY lo.created_at DESC LIMIT 1) AS latest_status,
                   (SELECT ' . $latestTestsAggregate . '
                    FROM lab_order_items loi
                    WHERE loi.order_id = (
                        SELECT lo2.id FROM lab_orders lo2
                        WHERE lo2.patient_id = p.id' . str_replace('lo.', 'lo2.', $scopeLo) . '
                        ORDER BY lo2.created_at DESC, lo2.id DESC
                        LIMIT 1
                    )) AS latest_tests,
                   (SELECT COUNT(*) FROM lab_orders lo WHERE lo.patient_id = p.id' . $scopeLo . ') AS order_count,
                   (SELECT COUNT(*) FROM lab_results lr JOIN lab_orders lo ON lo.id = lr.order_id WHERE lo.patient_id = p.id' . $scopeLo . ' AND lr.status = "Released") AS result_count
            FROM patients p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN facilities f ON f.id = p.primary_facility_id
            WHERE ' . implode(' AND ', $where) . '
            ORDER BY u.name';
    return array_map('map_patient', all_rows($pdo, $sql, $params));
}

function fetch_orders($pdo, $user)
{
    $where = [];
    $params = [];
    if ($user['role'] === 'Doctor') {
        $where[] = 'lo.doctor_id = ?';
        $params[] = $user['id'];
    } elseif ($user['role'] === 'Laboratory Staff') {
        $ids = lab_facility_ids($pdo, $user);
        if (!$ids) {
            return [];
        }
        $where[] = 'lo.facility_id IN (' . placeholders(count($ids)) . ')';
        $params = array_merge($params, $ids);
    } elseif ($user['role'] === 'Patient') {
        $where[] = 'lo.patient_id = ?';
        $params[] = $user['patientId'];
    }
    $testsAggregate = db_group_concat('test_name', 'id', ', ');
    $testIdsAggregate = db_group_concat('test_definition_id', 'id', ',');
    $sql = 'SELECT lo.*, p.patient_code, p.user_id AS patient_user_id, pu.name AS patient_name, pu.avatar AS patient_avatar,
                   du.name AS doctor_name, f.name AS facility_name,
                   oi.tests, oi.test_ids
            FROM lab_orders lo
            JOIN patients p ON p.id = lo.patient_id
            JOIN users pu ON pu.id = p.user_id
            JOIN users du ON du.id = lo.doctor_id
            JOIN facilities f ON f.id = lo.facility_id
            LEFT JOIN (
              SELECT order_id, ' . $testsAggregate . ' AS tests,
                     ' . $testIdsAggregate . ' AS test_ids
              FROM lab_order_items GROUP BY order_id
            ) oi ON oi.order_id = lo.id' .
            ($where ? ' WHERE ' . implode(' AND ', $where) : '') .
            ' ORDER BY lo.created_at DESC, lo.id DESC';
    $rows = all_rows($pdo, $sql, $params);
    return array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'orderNumber' => $row['order_number'],
            'patientId' => (int) $row['patient_id'],
            'patientUserId' => (int) $row['patient_user_id'],
            'patientCode' => $row['patient_code'],
            'patientName' => $row['patient_name'],
            'patientAvatar' => $row['patient_avatar'],
            'doctorId' => (int) $row['doctor_id'],
            'doctorName' => $row['doctor_name'],
            'facilityId' => (int) $row['facility_id'],
            'facilityName' => $row['facility_name'],
            'tests' => $row['tests'] ?: '',
            'testIds' => $row['test_ids'] ? array_map('intval', explode(',', $row['test_ids'])) : [],
            'priority' => $row['priority'],
            'status' => $row['status'],
            'clinicalNotes' => $row['clinical_notes'],
            'latestUpdate' => $row['latest_update'],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'] ?: $row['created_at'],
        ];
    }, $rows);
}

function fetch_result_values($pdo, $resultIds)
{
    if (!$resultIds) {
        return [];
    }
    $rows = all_rows($pdo, 'SELECT * FROM lab_result_values WHERE result_id IN (' . placeholders(count($resultIds)) . ') ORDER BY id', $resultIds);
    $grouped = [];
    foreach ($rows as $row) {
        $grouped[(int) $row['result_id']][] = [
            'parameter' => $row['parameter_name'],
            'value' => $row['value_text'],
            'unit' => $row['unit'],
            'referenceRange' => $row['reference_range'],
            'flag' => $row['flag'],
        ];
    }
    return $grouped;
}

function fetch_result_files($pdo, $resultIds)
{
    if (!$resultIds) {
        return [];
    }
    $rows = all_rows($pdo, 'SELECT * FROM result_files WHERE result_id IN (' . placeholders(count($resultIds)) . ') ORDER BY id', $resultIds);
    $grouped = [];
    foreach ($rows as $row) {
        $grouped[(int) $row['result_id']][] = [
            'id' => (int) $row['id'],
            'originalName' => $row['original_name'],
            'storedName' => $row['stored_name'],
            'mimeType' => $row['mime_type'],
            'sizeBytes' => (int) $row['size_bytes'],
            'downloadUrl' => 'index.php?action=download_result_file&id=' . (int) $row['id'],
        ];
    }
    return $grouped;
}

function fetch_results($pdo, $user)
{
    $where = [];
    $params = [];
    if ($user['role'] === 'Doctor') {
        $where[] = 'lo.doctor_id = ?';
        $where[] = 'lr.status IN ("Verified", "Released")';
        $params[] = $user['id'];
    } elseif ($user['role'] === 'Laboratory Staff') {
        $ids = lab_facility_ids($pdo, $user);
        if (!$ids) {
            return [];
        }
        $where[] = 'lo.facility_id IN (' . placeholders(count($ids)) . ')';
        $params = array_merge($params, $ids);
    } elseif ($user['role'] === 'Patient') {
        $where[] = 'lo.patient_id = ?';
        $where[] = 'lr.status = "Released"';
        $params[] = $user['patientId'];
    }
    $testsAggregate = db_group_concat('test_name', 'id', ', ');
    $sql = 'SELECT lr.*, lo.order_number, lo.patient_id, lo.doctor_id, lo.facility_id,
                   p.patient_code, p.user_id AS patient_user_id, pu.name AS patient_name,
                   du.name AS doctor_name, f.name AS facility_name, uu.name AS uploaded_by_name,
                   cn.note AS clinical_note, cn.created_at AS clinical_note_created_at,
                   nd.name AS clinical_note_doctor, oi.tests
            FROM lab_results lr
            JOIN lab_orders lo ON lo.id = lr.order_id
            JOIN patients p ON p.id = lo.patient_id
            JOIN users pu ON pu.id = p.user_id
            JOIN users du ON du.id = lo.doctor_id
            JOIN users uu ON uu.id = lr.uploaded_by
            JOIN facilities f ON f.id = lo.facility_id
            LEFT JOIN (
              SELECT order_id, ' . $testsAggregate . ' AS tests
              FROM lab_order_items GROUP BY order_id
            ) oi ON oi.order_id = lo.id
            LEFT JOIN clinical_notes cn ON cn.id = (SELECT MAX(id) FROM clinical_notes WHERE result_id = lr.id)
            LEFT JOIN users nd ON nd.id = cn.doctor_id' .
            ($where ? ' WHERE ' . implode(' AND ', $where) : '') .
            ' ORDER BY lr.created_at DESC, lr.id DESC';
    $rows = all_rows($pdo, $sql, $params);
    $resultIds = array_map(function ($row) {
        return (int) $row['id'];
    }, $rows);
    $values = fetch_result_values($pdo, $resultIds);
    $files = fetch_result_files($pdo, $resultIds);
    return array_map(function ($row) use ($values, $files) {
        return [
            'id' => (int) $row['id'],
            'resultNumber' => $row['result_number'],
            'orderId' => (int) $row['order_id'],
            'orderNumber' => $row['order_number'],
            'patientId' => (int) $row['patient_id'],
            'patientUserId' => (int) $row['patient_user_id'],
            'patientCode' => $row['patient_code'],
            'patientName' => $row['patient_name'],
            'doctorId' => (int) $row['doctor_id'],
            'doctorName' => $row['doctor_name'],
            'facilityId' => (int) $row['facility_id'],
            'facilityName' => $row['facility_name'],
            'testName' => $row['tests'] ?: 'Laboratory Result',
            'status' => $row['status'],
            'findings' => $row['findings'],
            'remarks' => $row['remarks'],
            'rejectedReason' => $row['rejected_reason'],
            'uploadedBy' => $row['uploaded_by_name'],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'] ?: $row['created_at'],
            'uploadedAt' => $row['created_at'],
            'verifiedAt' => $row['verified_at'],
            'releasedAt' => $row['released_at'],
            'clinicalNote' => $row['clinical_note'],
            'clinicalNoteDoctor' => $row['clinical_note_doctor'],
            'clinicalNoteCreatedAt' => $row['clinical_note_created_at'],
            'values' => $values[(int) $row['id']] ?? [],
            'files' => $files[(int) $row['id']] ?? [],
        ];
    }, $rows);
}

function fetch_notifications($pdo, $user)
{
    if ($user['role'] === 'Admin') {
        $rows = all_rows($pdo, 'SELECT n.* FROM notifications n ORDER BY n.created_at DESC LIMIT 200');
        return array_map(function ($row) {
            return [
                'id' => (int) $row['id'],
                'title' => $row['title'],
                'message' => $row['message'],
                'type' => $row['type_name'],
                'isRead' => (bool) $row['is_read'],
                'relatedOrderId' => $row['related_order_id'] === null ? null : (int) $row['related_order_id'],
                'relatedResultId' => $row['related_result_id'] === null ? null : (int) $row['related_result_id'],
                'createdAt' => $row['created_at'],
            ];
        }, $rows);
    }
    $where = ['(n.user_id = ? OR n.role_name = ?'];
    $params = [$user['id'], $user['role']];
    if ($user['role'] === 'Patient' && $user['patientId']) {
        $where[0] .= ' OR n.patient_id = ?';
        $params[] = $user['patientId'];
    }
    $where[0] .= ')';
    $rows = all_rows($pdo, 'SELECT n.* FROM notifications n WHERE ' . implode(' AND ', $where) . ' ORDER BY n.created_at DESC LIMIT 200', $params);
    if ($user['role'] === 'Laboratory Staff') {
        $rows = array_values(array_filter($rows, function ($row) use ($pdo, $user) {
            if (empty($row['related_order_id'])) {
                return true;
            }
            return can_access_order($pdo, $user, order_by_identifier($pdo, (int) $row['related_order_id']));
        }));
    }
    return array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'title' => $row['title'],
            'message' => $row['message'],
            'type' => $row['type_name'],
            'isRead' => (bool) $row['is_read'],
            'relatedOrderId' => $row['related_order_id'] === null ? null : (int) $row['related_order_id'],
            'relatedResultId' => $row['related_result_id'] === null ? null : (int) $row['related_result_id'],
            'createdAt' => $row['created_at'],
        ];
    }, $rows);
}

function fetch_audit($pdo, $user)
{
    if ($user['role'] !== 'Admin') {
        return [];
    }
    $rows = all_rows($pdo, 'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
    return array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'userId' => $row['user_id'] === null ? null : (int) $row['user_id'],
            'userName' => $row['user_name'],
            'role' => $row['role_name'],
            'action' => $row['action'],
            'module' => $row['module'],
            'details' => $row['details'],
            'ipAddress' => $row['ip_address'],
            'createdAt' => $row['created_at'],
        ];
    }, $rows);
}

function count_by($items, $key)
{
    $counts = [];
    foreach ($items as $item) {
        $value = $item[$key] ?? 'Unknown';
        $counts[$value] = ($counts[$value] ?? 0) + 1;
    }
    return $counts;
}

function dashboard_counts($pdo, $user, $orders, $results, $notifications)
{
    if ($user['role'] === 'Admin') {
        return [
            'totalUsers' => (int) one($pdo, 'SELECT COUNT(*) c FROM users')['c'],
            'totalPatients' => (int) one($pdo, 'SELECT COUNT(*) c FROM patients')['c'],
            'totalDoctors' => (int) one($pdo, 'SELECT COUNT(*) c FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = "Doctor"')['c'],
            'totalLabStaff' => (int) one($pdo, 'SELECT COUNT(*) c FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = "Laboratory Staff"')['c'],
            'totalFacilities' => (int) one($pdo, 'SELECT COUNT(*) c FROM facilities WHERE status = "Active"')['c'],
            'totalTests' => (int) one($pdo, 'SELECT COUNT(*) c FROM test_definitions WHERE status = "Active"')['c'],
            'pendingOrders' => (int) one($pdo, 'SELECT COUNT(*) c FROM lab_orders WHERE status NOT IN ("Released","Rejected","Cancelled")')['c'],
            'releasedResults' => (int) one($pdo, 'SELECT COUNT(*) c FROM lab_results WHERE status = "Released"')['c'],
            'unreadNotifications' => count(array_filter($notifications, function ($n) { return !$n['isRead']; })),
        ];
    }
    $openStatuses = ['Pending', 'Pending Sample', 'Accepted', 'Sample Collected', 'Processing', 'In Progress', 'Result Uploaded', 'Pending Review', 'Verified'];
    return [
        'totalOrders' => count($orders),
        'openOrders' => count(array_filter($orders, function ($o) use ($openStatuses) { return in_array($o['status'], $openStatuses, true); })),
        'releasedResults' => count(array_filter($results, function ($r) { return $r['status'] === 'Released'; })),
        'pendingResults' => count(array_filter($results, function ($r) { return $r['status'] !== 'Released'; })),
        'unreadNotifications' => count(array_filter($notifications, function ($n) { return !$n['isRead']; })),
    ];
}

function reports_summary($orders, $results)
{
    $facilityCounts = [];
    foreach ($orders as $order) {
        $facilityCounts[$order['facilityName']] = ($facilityCounts[$order['facilityName']] ?? 0) + 1;
    }
    $testCounts = [];
    foreach ($orders as $order) {
        foreach (array_filter(array_map('trim', explode(',', $order['tests']))) as $test) {
            $testCounts[$test] = ($testCounts[$test] ?? 0) + 1;
        }
    }
    arsort($testCounts);
    return [
        'ordersByStatus' => count_by($orders, 'status'),
        'resultsByStatus' => count_by($results, 'status'),
        'ordersByFacility' => $facilityCounts,
        'topTests' => array_slice($testCounts, 0, 8, true),
    ];
}

function app_data($pdo, $user)
{
    $orders = fetch_orders($pdo, $user);
    $results = fetch_results($pdo, $user);
    $notifications = fetch_notifications($pdo, $user);
    $data = [
        'currentUser' => $user,
        'users' => $user['role'] === 'Admin' ? fetch_users($pdo) : [],
        'facilities' => fetch_facilities($pdo, $user),
        'tests' => fetch_tests($pdo, $user),
        'patients' => $user['role'] === 'Admin' ? fetch_patients($pdo, null, 'all') : fetch_patients($pdo, $user, 'role'),
        'availablePatients' => $user['role'] === 'Admin' ? fetch_patients($pdo, null, 'all') : fetch_patients($pdo, $user, 'role'),
        'orders' => $orders,
        'results' => $results,
        'notifications' => $notifications,
        'audit' => fetch_audit($pdo, $user),
        'dashboard' => dashboard_counts($pdo, $user, $orders, $results, $notifications),
        'reports' => reports_summary($orders, $results),
        'maintenance' => clinic_maintenance_public_settings(clinic_maintenance_current($pdo)),
        'storage' => ['driver' => clinic_storage_driver(), 'maxFileBytes' => 10 * 1024 * 1024, 'maxFiles' => 5],
    ];
    return $data;
}

function normalize_datetime_input($value)
{
    $value = trim((string) ($value ?? ''));
    if ($value === '') {
        return null;
    }
    $time = strtotime($value);
    if ($time === false) {
        respond(false, 'Enter a valid date and time.', [], 422, ['datetime' => 'Invalid date']);
    }
    return date('Y-m-d H:i:s', $time);
}

function save_maintenance_settings($pdo, $data, $actor)
{
    require_auth($pdo, ['Admin']);

    $enabledRaw = $data['isEnabled'] ?? $data['is_enabled'] ?? false;
    $isEnabled = filter_var($enabledRaw, FILTER_VALIDATE_BOOLEAN);
    $scope = optional_string($data, 'scope', 'all');
    if (!in_array($scope, ['all', 'roles', 'pages'], true)) {
        respond(false, 'Select a valid maintenance scope.', [], 422, ['scope' => 'Invalid scope']);
    }

    $message = trim((string) ($data['message'] ?? ''));
    if ($isEnabled && $message === '') {
        respond(false, 'Maintenance message is required when maintenance mode is enabled.', [], 422, ['message' => 'Required']);
    }
    $message = $message !== '' ? $message : CLINIC_MAINTENANCE_DEFAULT_MESSAGE;
    $reason = optional_string($data, 'reason');
    $startAt = normalize_datetime_input($data['startAt'] ?? $data['start_at'] ?? null);
    $endAt = normalize_datetime_input($data['endAt'] ?? $data['end_at'] ?? null);

    if ($startAt && $endAt && strtotime($endAt) < strtotime($startAt)) {
        respond(false, 'End date and time must be after the start date and time.', [], 422, ['endAt' => 'Invalid range']);
    }

    $affectedRoles = clinic_maintenance_sanitize_list($data['affectedRoles'] ?? [], ['Doctor', 'Laboratory Staff', 'Patient']);
    $affectedPages = clinic_maintenance_sanitize_list($data['affectedPages'] ?? [], clinic_maintenance_allowed_pages());
    if ($isEnabled && $scope === 'roles' && !$affectedRoles) {
        respond(false, 'Select at least one affected role.', [], 422, ['affectedRoles' => 'Required']);
    }
    if ($isEnabled && $scope === 'pages' && !$affectedPages) {
        respond(false, 'Select at least one affected page.', [], 422, ['affectedPages' => 'Required']);
    }

    clinic_maintenance_ensure_table($pdo);
    $pdo->beginTransaction();
    $upsertSql = db_is_postgres()
        ? 'INSERT INTO maintenance_settings (id, is_enabled, scope, affected_roles, affected_pages, message, reason, start_at, end_at, created_by)
           VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             is_enabled=EXCLUDED.is_enabled, scope=EXCLUDED.scope, affected_roles=EXCLUDED.affected_roles,
             affected_pages=EXCLUDED.affected_pages, message=EXCLUDED.message, reason=EXCLUDED.reason,
             start_at=EXCLUDED.start_at, end_at=EXCLUDED.end_at, created_by=EXCLUDED.created_by,
             updated_at=CURRENT_TIMESTAMP'
        : 'INSERT INTO maintenance_settings (id, is_enabled, scope, affected_roles, affected_pages, message, reason, start_at, end_at, created_by)
           VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             is_enabled=VALUES(is_enabled), scope=VALUES(scope), affected_roles=VALUES(affected_roles),
             affected_pages=VALUES(affected_pages), message=VALUES(message), reason=VALUES(reason),
             start_at=VALUES(start_at), end_at=VALUES(end_at), created_by=VALUES(created_by),
             updated_at=CURRENT_TIMESTAMP';
    $stmt = $pdo->prepare($upsertSql);
    $stmt->execute([
        $isEnabled ? 1 : 0,
        $scope,
        json_encode($affectedRoles, JSON_UNESCAPED_SLASHES),
        json_encode($affectedPages, JSON_UNESCAPED_SLASHES),
        substr($message, 0, 255),
        $reason ? substr($reason, 0, 255) : null,
        $startAt,
        $endAt,
        (int) $actor['id'],
    ]);
    $pdo->exec('DELETE FROM maintenance_settings WHERE id <> 1');
    audit_log($pdo, $actor, 'UPDATE', 'Maintenance', ($isEnabled ? 'Enabled' : 'Disabled') . ' maintenance mode for scope ' . $scope);
    $pdo->commit();

    $settings = clinic_maintenance_current($pdo);
    respond(true, 'Maintenance settings saved.', [
        'maintenance' => clinic_maintenance_public_settings($settings),
        'app' => app_data($pdo, $actor),
    ]);
}

function save_user($pdo, $data, $actor)
{
    require_auth($pdo, ['Admin']);
    $id = (int) ($data['id'] ?? 0);
    $name = require_field($data, 'name', 'Full name');
    $email = strtolower(require_field($data, 'email', 'Email'));
    $username = strtolower(optional_string($data, 'username') ?: preg_replace('/[^a-z0-9]+/', '.', strtolower($name)));
    $role = require_field($data, 'role', 'Role');
    $facilityId = find_facility_id($pdo, $data);
    $status = optional_string($data, 'status', 'Active');
    $contact = optional_string($data, 'contact');
    $password = optional_string($data, 'password');
    if (!in_array($role, ['Admin', 'Doctor', 'Laboratory Staff', 'Patient'], true)) {
        respond(false, 'Select a valid system role.', [], 422, ['role' => 'Invalid role']);
    }
    $existingUser = $id > 0 ? one($pdo, 'SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1', [$id]) : null;
    if ($id > 0 && !$existingUser) {
        respond(false, 'User not found.', [], 404);
    }
    if (in_array($role, ['Doctor', 'Laboratory Staff', 'Patient'], true)) {
        if (!$facilityId || !one($pdo, 'SELECT id FROM facilities WHERE id = ? AND status = "Active" LIMIT 1', [$facilityId])) {
            respond(false, 'Select an active assigned facility for this role.', [], 422, ['facilityId' => 'Required']);
        }
    }
    if ($existingUser && $existingUser['role'] !== $role) {
        $hasClinicalRecords = one(
            $pdo,
            'SELECT 1
             FROM users u
             LEFT JOIN patients p ON p.user_id = u.id
             LEFT JOIN lab_orders patient_orders ON patient_orders.patient_id = p.id
             LEFT JOIN lab_orders doctor_orders ON doctor_orders.doctor_id = u.id
             LEFT JOIN lab_results uploaded_results ON uploaded_results.uploaded_by = u.id
             WHERE u.id = ? AND (patient_orders.id IS NOT NULL OR doctor_orders.id IS NOT NULL OR uploaded_results.id IS NOT NULL)
             LIMIT 1',
            [$id]
        );
        if ($hasClinicalRecords) {
            respond(false, 'The role cannot be changed because this account is linked to clinical records.', [], 409, ['role' => 'Role locked']);
        }
    }

    if ($id > 0 && (int) $actor['id'] === $id && ($role !== 'Admin' || $status !== 'Active')) {
        respond(false, 'You cannot remove your own active Admin access.', [], 422);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(false, 'Enter a valid email address.', [], 422, ['email' => 'Invalid email']);
    }
    validate_max_length($name, 120, 'Full name', 'name');
    validate_max_length($email, 160, 'Email', 'email');
    validate_max_length($contact, 40, 'Contact number', 'contact');
    if (!valid_username($username)) {
        respond(false, 'Use a 3-20 character username with letters, numbers, dots, hyphens, or underscores.', [], 422, ['username' => 'Invalid username']);
    }
    if ($id <= 0 && !$password) {
        respond(false, 'Password is required for new users.', [], 422, ['password' => 'Required']);
    }
    if ($password && !valid_password($password)) {
        respond(false, 'Password must be at least 8 characters and include a letter and number.', [], 422, ['password' => 'Weak password']);
    }
    if (!in_array($status, valid_active_statuses(), true)) {
        respond(false, 'Select a valid user status.', [], 422, ['status' => 'Invalid status']);
    }
    $exists = one($pdo, 'SELECT id FROM users WHERE (email = ? OR username = ?) AND id <> ? LIMIT 1', [$email, $username, $id]);
    if ($exists) {
        respond(false, 'Email or username is already used by another account.', [], 409);
    }

    $roleId = role_id($pdo, $role);
    $avatar = initials($name);
    $pdo->beginTransaction();
    if ($id > 0) {
        $stmt = $pdo->prepare('UPDATE users SET role_id=?, name=?, email=?, username=?, avatar=?, contact=?, status=? WHERE id=?');
        $stmt->execute([$roleId, $name, $email, $username, $avatar, $contact, $status, $id]);
        if ($password) {
            $stmt = $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?');
            $stmt->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
        }
        audit_log($pdo, $actor, 'UPDATE', 'User', 'Updated user ' . $name);
    } else {
        $id = db_insert_id($pdo, 'INSERT INTO users (role_id, name, email, username, password_hash, avatar, contact, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [$roleId, $name, $email, $username, password_hash($password, PASSWORD_DEFAULT), $avatar, $contact, $status]);
        audit_log($pdo, $actor, 'CREATE', 'User', 'Created user ' . $name);
    }

    if ($role === 'Doctor') {
        $doctorUpsert = db_is_postgres()
            ? 'INSERT INTO doctors (user_id, specialty, assigned_facility_id) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET specialty=EXCLUDED.specialty, assigned_facility_id=EXCLUDED.assigned_facility_id'
            : 'INSERT INTO doctors (user_id, specialty, assigned_facility_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE specialty=VALUES(specialty), assigned_facility_id=VALUES(assigned_facility_id)';
        $stmt = $pdo->prepare($doctorUpsert);
        $stmt->execute([$id, optional_string($data, 'specialty', 'General Medicine'), $facilityId]);
    } elseif ($role === 'Laboratory Staff') {
        $staffUpsert = db_is_postgres()
            ? 'INSERT INTO laboratory_staff (user_id, employee_no, default_facility_id, department) VALUES (?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET default_facility_id=EXCLUDED.default_facility_id, department=EXCLUDED.department'
            : 'INSERT INTO laboratory_staff (user_id, employee_no, default_facility_id, department) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE default_facility_id=VALUES(default_facility_id), department=VALUES(department)';
        $stmt = $pdo->prepare($staffUpsert);
        $stmt->execute([$id, 'LAB-' . str_pad((string) $id, 3, '0', STR_PAD_LEFT), $facilityId, optional_string($data, 'department', 'General Laboratory')]);
        $stmt = $pdo->prepare('DELETE FROM staff_facilities WHERE user_id = ?');
        $stmt->execute([$id]);
        if ($facilityId) {
            $stmt = $pdo->prepare('INSERT INTO staff_facilities (user_id, facility_id) VALUES (?, ?)');
            $stmt->execute([$id, $facilityId]);
        }
    } elseif ($role === 'Patient') {
        $patient = one($pdo, 'SELECT id FROM patients WHERE user_id = ? LIMIT 1', [$id]);
        if (!$patient) {
            $stmt = $pdo->prepare('INSERT INTO patients (user_id, patient_code, primary_facility_id, address) VALUES (?, ?, ?, ?)');
            $stmt->execute([$id, generate_patient_code($pdo), $facilityId, optional_string($data, 'address')]);
        } else {
            $stmt = $pdo->prepare('UPDATE patients SET primary_facility_id=?, address=COALESCE(?, address) WHERE user_id=?');
            $stmt->execute([$facilityId, optional_string($data, 'address'), $id]);
        }
    }
    $pdo->commit();
    $freshActor = (int) $actor['id'] === $id ? fetch_user($pdo, $id) : $actor;
    respond(true, 'User saved successfully.', ['user' => fetch_user($pdo, $id), 'app' => app_data($pdo, $freshActor)]);
}

function save_facility($pdo, $data, $actor)
{
    require_auth($pdo, ['Admin']);
    $id = (int) ($data['id'] ?? 0);
    $values = [
        require_field($data, 'name', 'Facility name'),
        require_field($data, 'address', 'Address'),
        require_field($data, 'phone', 'Phone'),
        optional_string($data, 'email'),
        optional_string($data, 'status', 'Active'),
    ];
    if (!in_array($values[4], valid_active_statuses(), true)) {
        respond(false, 'Select a valid facility status.', [], 422, ['status' => 'Invalid status']);
    }
    validate_max_length($values[0], 160, 'Facility name', 'name');
    validate_max_length($values[1], 255, 'Address', 'address');
    validate_max_length($values[2], 40, 'Phone', 'phone');
    validate_max_length($values[3], 160, 'Email', 'email');
    if ($values[3] && !filter_var($values[3], FILTER_VALIDATE_EMAIL)) {
        respond(false, 'Enter a valid facility email address.', [], 422, ['email' => 'Invalid email']);
    }
    if ($id > 0 && !one($pdo, 'SELECT id FROM facilities WHERE id = ? LIMIT 1', [$id])) {
        respond(false, 'Facility not found.', [], 404);
    }
    if (one($pdo, 'SELECT id FROM facilities WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1', [$values[0], $id])) {
        respond(false, 'A facility with that name already exists.', [], 409, ['name' => 'Duplicate facility']);
    }
    $pdo->beginTransaction();
    if ($id > 0) {
        $stmt = $pdo->prepare('UPDATE facilities SET name=?, address=?, phone=?, email=?, status=? WHERE id=?');
        $stmt->execute(array_merge($values, [$id]));
        audit_log($pdo, $actor, 'UPDATE', 'Facility', 'Updated facility ' . $values[0]);
    } else {
        $id = db_insert_id($pdo, 'INSERT INTO facilities (name, address, phone, email, status) VALUES (?, ?, ?, ?, ?)', $values);
        audit_log($pdo, $actor, 'CREATE', 'Facility', 'Created facility ' . $values[0]);
    }
    $pdo->commit();
    respond(true, 'Facility saved successfully.', ['facilities' => fetch_facilities($pdo, $actor), 'app' => app_data($pdo, $actor)]);
}

function save_test($pdo, $data, $actor)
{
    require_auth($pdo, ['Admin']);
    $id = (int) ($data['id'] ?? 0);
    $values = [
        strtoupper(require_field($data, 'code', 'Test code')),
        require_field($data, 'name', 'Test name'),
        require_field($data, 'category', 'Category'),
        require_field($data, 'sampleType', 'Sample type'),
        require_field($data, 'turnaroundTime', 'Turnaround time'),
        (float) ($data['price'] ?? 0),
        optional_string($data, 'referenceRange'),
        optional_string($data, 'instructions'),
        optional_string($data, 'status', 'Active'),
    ];
    if (!in_array($values[8], valid_active_statuses(), true)) {
        respond(false, 'Select a valid test status.', [], 422, ['status' => 'Invalid status']);
    }
    validate_max_length($values[0], 40, 'Test code', 'code');
    validate_max_length($values[1], 160, 'Test name', 'name');
    validate_max_length($values[2], 100, 'Category', 'category');
    validate_max_length($values[3], 80, 'Sample type', 'sampleType');
    validate_max_length($values[4], 80, 'Turnaround time', 'turnaroundTime');
    if ($values[5] < 0) {
        respond(false, 'Test price cannot be negative.', [], 422, ['price' => 'Invalid price']);
    }
    if ($id > 0 && !one($pdo, 'SELECT id FROM test_definitions WHERE id = ? LIMIT 1', [$id])) {
        respond(false, 'Test definition not found.', [], 404);
    }
    if (one($pdo, 'SELECT id FROM test_definitions WHERE code = ? AND id <> ? LIMIT 1', [$values[0], $id])) {
        respond(false, 'That laboratory test code already exists.', [], 409, ['code' => 'Duplicate code']);
    }
    $pdo->beginTransaction();
    if ($id > 0) {
        $stmt = $pdo->prepare('UPDATE test_definitions SET code=?, name=?, category=?, sample_type=?, turnaround_time=?, price=?, reference_range=?, instructions=?, status=? WHERE id=?');
        $stmt->execute(array_merge($values, [$id]));
        audit_log($pdo, $actor, 'UPDATE', 'Test Definition', 'Updated test ' . $values[0]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO test_definitions (code, name, category, sample_type, turnaround_time, price, reference_range, instructions, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute($values);
        audit_log($pdo, $actor, 'CREATE', 'Test Definition', 'Created test ' . $values[0]);
    }
    $pdo->commit();
    respond(true, 'Test definition saved successfully.', ['tests' => fetch_tests($pdo, $actor), 'app' => app_data($pdo, $actor)]);
}

function create_order($pdo, $data, $actor)
{
    require_auth($pdo, ['Doctor']);
    $patientId = (int) ($data['patientId'] ?? $data['patient_id'] ?? 0);
    $patient = one(
        $pdo,
        'SELECT p.*, u.name FROM patients p JOIN users u ON u.id = p.user_id
         WHERE p.id = ? AND u.status = "Active"
           AND (p.primary_facility_id = ? OR EXISTS (
             SELECT 1 FROM lab_orders previous_order WHERE previous_order.patient_id = p.id AND previous_order.doctor_id = ?
           ))
         LIMIT 1',
        [$patientId, (int) ($actor['assignedFacilityId'] ?? 0), (int) $actor['id']]
    );
    if (!$patient) {
        respond(false, 'Select a patient connected to your assigned facility or existing laboratory requests.', [], 403, ['patientId' => 'Outside doctor scope']);
    }
    $facilityId = find_facility_id($pdo, $data);
    if (!$facilityId || (int) $facilityId !== (int) ($actor['assignedFacilityId'] ?? 0)) {
        respond(false, 'Laboratory requests can only be submitted for your assigned active facility.', [], 403, ['facilityId' => 'Outside doctor scope']);
    }
    if (!one($pdo, 'SELECT id FROM facilities WHERE id = ? AND status = "Active" LIMIT 1', [$facilityId])) {
        respond(false, 'Your assigned facility is not active.', [], 409, ['facilityId' => 'Inactive facility']);
    }
    $doctorId = $actor['role'] === 'Doctor' ? $actor['id'] : (int) ($data['doctorId'] ?? $actor['id']);
    $doctor = one($pdo, 'SELECT u.id, u.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? AND r.name = "Doctor" AND u.status = "Active"', [$doctorId]);
    if (!$doctor) {
        respond(false, 'Select a valid requesting doctor.', [], 422, ['doctorId' => 'Invalid doctor']);
    }

    $testIds = $data['testIds'] ?? [];
    if (!is_array($testIds)) {
        $testIds = array_filter(array_map('trim', explode(',', (string) $testIds)));
    }
    $testIds = array_values(array_filter(array_map('intval', $testIds)));
    if (!$testIds) {
        respond(false, 'Select at least one laboratory test.', [], 422, ['testIds' => 'Required']);
    }
    $tests = all_rows($pdo, 'SELECT id, name FROM test_definitions WHERE id IN (' . placeholders(count($testIds)) . ') AND status = "Active"', $testIds);
    if (count($tests) !== count(array_unique($testIds))) {
        respond(false, 'One or more selected tests are not available.', [], 422, ['testIds' => 'Invalid tests']);
    }

    $orderNumber = generate_unique_code($pdo, 'lab_orders', 'order_number', 'LAB');
    $priority = optional_string($data, 'priority', 'Regular');
    $status = 'Pending';
    if (!in_array($priority, valid_priorities(), true)) {
        respond(false, 'Select a valid laboratory request priority.', [], 422, ['priority' => 'Invalid priority']);
    }
    $notes = optional_string($data, 'clinicalNotes') ?: optional_string($data, 'notes');

    $pdo->beginTransaction();
    $orderId = db_insert_id($pdo, 'INSERT INTO lab_orders (order_number, patient_id, doctor_id, facility_id, priority, status, clinical_notes, latest_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [$orderNumber, $patientId, $doctorId, $facilityId, $priority, $status, $notes, 'Laboratory request submitted']);
    $stmt = $pdo->prepare('INSERT INTO lab_order_items (order_id, test_definition_id, test_name, status) VALUES (?, ?, ?, ?)');
    foreach ($tests as $test) {
        $stmt->execute([$orderId, (int) $test['id'], $test['name'], 'Pending']);
    }
    notify_facility_staff($pdo, $facilityId, [
        'title' => 'New laboratory request received',
        'message' => $orderNumber . ' for ' . $patient['name'] . ' is ready for laboratory intake.',
        'type_name' => 'orders',
        'related_order_id' => $orderId,
    ]);
    notify_user($pdo, [
        'patient_id' => $patientId,
        'title' => 'Laboratory request submitted',
        'message' => $doctor['name'] . ' submitted laboratory request ' . $orderNumber . ' for your care.',
        'type_name' => 'orders',
        'related_order_id' => $orderId,
    ]);
    audit_log($pdo, $actor, 'CREATE', 'Laboratory Request', 'Submitted ' . $orderNumber . ' for ' . $patient['name']);
    $pdo->commit();
    respond(true, 'Laboratory request submitted successfully.', ['orderNumber' => $orderNumber, 'orderId' => $orderId, 'app' => app_data($pdo, $actor)]);
}

function update_order_status($pdo, $data, $actor)
{
    require_auth($pdo, ['Laboratory Staff']);
    $orderKey = require_field($data, 'orderId', 'Laboratory request');
    $status = require_field($data, 'status', 'Status');
    if (!in_array($status, valid_order_statuses(), true)) {
        respond(false, 'That laboratory request status is not allowed from this workflow.', [], 422, ['status' => 'Invalid status']);
    }
    $order = order_by_identifier($pdo, $orderKey);
    if (!$order || !can_access_order($pdo, $actor, $order)) {
        respond(false, 'Laboratory request not found or not available to your role.', [], 404);
    }
    if (in_array($order['status'], ['Rejected', 'Cancelled'], true)) {
        respond(false, 'Closed laboratory requests cannot be moved back into the active workflow.', [], 409);
    }
    if (in_array($order['status'], ['Result Uploaded', 'Verified', 'Released'], true)) {
        respond(false, 'This laboratory request is controlled by the result review workflow.', [], 409);
    }
    $activeResult = one($pdo, 'SELECT id FROM lab_results WHERE order_id = ? AND status <> "Rejected" LIMIT 1', [(int) $order['id']]);
    if ($activeResult) {
        respond(false, 'This laboratory request already has a result record. Update the result status instead.', [], 409);
    }
    $transitions = [
        'Pending' => ['Accepted', 'Pending Sample', 'Rejected', 'Cancelled'],
        'Pending Sample' => ['Accepted', 'Sample Collected', 'Rejected', 'Cancelled'],
        'Accepted' => ['Pending Sample', 'Sample Collected', 'Rejected', 'Cancelled'],
        'Sample Collected' => ['Processing', 'In Progress', 'Rejected', 'Cancelled'],
        'Processing' => ['In Progress', 'Rejected', 'Cancelled'],
        'In Progress' => ['Processing', 'Rejected', 'Cancelled'],
    ];
    if (!in_array($status, $transitions[$order['status']] ?? [], true)) {
        respond(false, 'That status change is not valid from ' . $order['status'] . '.', [], 409, ['status' => 'Invalid transition']);
    }
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('UPDATE lab_orders SET status=?, latest_update=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
    $stmt->execute([$status, 'Laboratory request status changed to ' . $status, (int) $order['id']]);
    $stmt = $pdo->prepare('UPDATE lab_order_items SET status=? WHERE order_id=?');
    $stmt->execute([$status, (int) $order['id']]);
    notify_user($pdo, ['user_id' => (int) $order['doctor_id'], 'title' => 'Laboratory request status updated', 'message' => $order['order_number'] . ' is now ' . $status . '.', 'type_name' => 'orders', 'related_order_id' => (int) $order['id']]);
    notify_user($pdo, ['patient_id' => (int) $order['patient_id'], 'title' => 'Laboratory request status updated', 'message' => 'Your laboratory request ' . $order['order_number'] . ' is now ' . $status . '.', 'type_name' => 'orders', 'related_order_id' => (int) $order['id']]);
    audit_log($pdo, $actor, 'UPDATE', 'Laboratory Request', 'Set ' . $order['order_number'] . ' to ' . $status);
    $pdo->commit();
    respond(true, 'Laboratory request status updated.', ['app' => app_data($pdo, $actor)]);
}

function save_result_attachments($pdo, $resultId, $attachments)
{
    if (!is_array($attachments) || !$attachments) {
        return;
    }
    $allowed = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    $maxBytes = 10 * 1024 * 1024;
    if (count($attachments) > 5) {
        respond(false, 'Attach no more than five files per request.', [], 422, ['attachments' => 'Too many files']);
    }
    $totalBytes = array_sum(array_map(function ($file) {
        return is_array($file) ? (int) ($file['size'] ?? 0) : 0;
    }, $attachments));
    if ($totalBytes > 25 * 1024 * 1024) {
        respond(false, 'The total attachment size cannot exceed 25 MB.', [], 422, ['attachments' => 'Files too large']);
    }
    $uploadDir = dirname(__DIR__) . '/public/uploads/results';
    if (!clinic_storage_is_supabase() && !is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
        respond(false, 'Could not prepare the result upload folder.', [], 500);
    }
    $stmt = $pdo->prepare('INSERT INTO result_files (result_id, original_name, stored_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)');
    foreach ($attachments as $file) {
        if (!is_array($file)) {
            continue;
        }
        $name = trim((string) ($file['name'] ?? ''));
        $claimedMime = trim((string) ($file['type'] ?? ''));
        $size = (int) ($file['size'] ?? 0);
        if (clinic_storage_is_supabase()) {
            if (!isset($allowed[$claimedMime]) || $size <= 0 || $size > $maxBytes || !clinic_storage_verify_metadata($file)) {
                respond(false, 'One Supabase attachment reference is invalid or expired.', [], 422, ['attachments' => 'Invalid storage reference']);
            }
            $safeName = preg_replace('/[\x00-\x1F\x7F]+/u', '', basename(str_replace('\\', '/', $name)));
            $stmt->execute([(int) $resultId, substr($safeName ?: 'result-file', 0, 180), $file['storagePath'], $claimedMime, $size]);
            continue;
        }
        $data = (string) ($file['data'] ?? '');
        if ($name === '' || !isset($allowed[$claimedMime]) || $size <= 0 || $size > $maxBytes || $data === '' || strlen($data) > (int) ceil($maxBytes * 4 / 3) + 8) {
            respond(false, 'Attachments must be PDF, JPG, PNG, or WEBP files up to 10 MB.', [], 422, ['attachments' => 'Invalid file']);
        }
        $bytes = base64_decode($data, true);
        if ($bytes === false || strlen($bytes) !== $size) {
            respond(false, 'One attachment could not be read. Please choose the file again.', [], 422, ['attachments' => 'Invalid data']);
        }
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->buffer($bytes);
        if (!isset($allowed[$mime])) {
            respond(false, 'An attachment content type does not match an allowed PDF or image format.', [], 422, ['attachments' => 'Invalid file content']);
        }
        $stored = 'result-' . (int) $resultId . '-' . bin2hex(random_bytes(8)) . '.' . $allowed[$mime];
        if (file_put_contents($uploadDir . '/' . $stored, $bytes) === false) {
            respond(false, 'Could not save one of the uploaded result files.', [], 500);
        }
        $safeName = preg_replace('/[\x00-\x1F\x7F]+/u', '', basename(str_replace('\\', '/', $name)));
        $stmt->execute([(int) $resultId, substr($safeName ?: 'result-file', 0, 180), $stored, $mime, $size]);
    }
}

function download_result_file($pdo, $fileId, $actor)
{
    $file = one($pdo, 'SELECT rf.*, lr.order_id, lr.status FROM result_files rf JOIN lab_results lr ON lr.id = rf.result_id WHERE rf.id = ? LIMIT 1', [(int) $fileId]);
    if (!$file || !can_access_result($pdo, $actor, ['id' => (int) $file['result_id'], 'order_id' => (int) $file['order_id'], 'status' => $file['status']])) {
        respond(false, 'File not found or not available to your role.', [], 404);
    }
    if (clinic_storage_is_supabase()) {
        header('Location: ' . clinic_storage_signed_download_url($file['stored_name'], $file['original_name']), true, 302);
        exit;
    }
    $path = dirname(__DIR__) . '/public/uploads/results/' . basename($file['stored_name']);
    if (!is_file($path)) {
        respond(false, 'The uploaded file is missing from storage.', [], 404);
    }
    if (ob_get_length()) {
        ob_clean();
    }
    header('Content-Type: ' . $file['mime_type']);
    header('Content-Length: ' . filesize($path));
    $downloadName = preg_replace('/[^A-Za-z0-9._-]+/', '-', $file['original_name']) ?: 'result-file';
    header('Content-Disposition: inline; filename="' . $downloadName . '"');
    header('X-Content-Type-Options: nosniff');
    header('Content-Security-Policy: sandbox');
    readfile($path);
    exit;
}

function download_result_details($pdo, $resultId, $actor)
{
    $result = result_by_identifier($pdo, $resultId);
    if (!$result || !can_access_result($pdo, $actor, $result)) {
        respond(false, 'Result not found or not available to your role.', [], 404);
    }
    if ($actor['role'] === 'Patient' && $result['status'] !== 'Released') {
        respond(false, 'Only released results can be downloaded.', [], 403);
    }

    $rows = fetch_results($pdo, $actor);
    $details = null;
    foreach ($rows as $row) {
        if ((int) $row['id'] === (int) $result['id']) {
            $details = $row;
            break;
        }
    }
    if (!$details) {
        respond(false, 'Result not found or not available to your role.', [], 404);
    }

    $lines = [
        'Centralized Laboratory Results System',
        'Laboratory Result Details',
        '',
        'Result ID: ' . $details['resultNumber'],
        'Request No.: ' . $details['orderNumber'],
        'Patient: ' . $details['patientName'] . ' (' . $details['patientCode'] . ')',
        'Doctor: ' . $details['doctorName'],
        'Facility: ' . $details['facilityName'],
        'Test: ' . $details['testName'],
        'Status: ' . $details['status'],
        'Created: ' . ($details['createdAt'] ?: '-'),
        'Updated: ' . ($details['updatedAt'] ?: '-'),
        'Released: ' . ($details['releasedAt'] ?: '-'),
        'Uploaded by: ' . ($details['uploadedBy'] ?: '-'),
        '',
        'Findings:',
        $details['findings'] ?: 'No findings recorded.',
        '',
        'Remarks:',
        $details['remarks'] ?: 'No remarks recorded.',
        '',
        'Result Values:',
    ];
    if ($details['values']) {
        foreach ($details['values'] as $value) {
            $lines[] = '- ' . $value['parameter'] . ': ' . $value['value']
                . ($value['unit'] ? ' ' . $value['unit'] : '')
                . ($value['referenceRange'] ? ' (Reference: ' . $value['referenceRange'] . ')' : '')
                . ($value['flag'] ? ' [' . $value['flag'] . ']' : '');
        }
    } else {
        $lines[] = 'No structured values recorded.';
    }
    $lines[] = '';
    $lines[] = 'Clinical Note:';
    $lines[] = $details['clinicalNote'] ?: 'No clinical note recorded.';

    if (ob_get_length()) {
        ob_clean();
    }
    $filename = preg_replace('/[^A-Za-z0-9_-]+/', '-', $details['resultNumber']) . '-details.txt';
    header('Content-Type: text/plain; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo implode("\r\n", $lines);
    exit;
}

function upload_result($pdo, $data, $actor)
{
    require_auth($pdo, ['Laboratory Staff']);
    $orderKey = require_field($data, 'orderId', 'Laboratory request');
    $order = order_by_identifier($pdo, $orderKey);
    if (!$order || !can_access_order($pdo, $actor, $order)) {
        respond(false, 'Laboratory request not found or not available to your role.', [], 404);
    }
    if (in_array($order['status'], ['Result Uploaded', 'Verified', 'Released', 'Rejected', 'Cancelled'], true)) {
        respond(false, 'This laboratory request already has a result workflow or is closed.', [], 409);
    }
    if (!in_array($order['status'], ['Processing', 'In Progress'], true)) {
        respond(false, 'Move the laboratory request to Processing or In Progress before uploading a result.', [], 409);
    }
    $existing = one($pdo, 'SELECT result_number, status FROM lab_results WHERE order_id = ? AND status <> "Rejected" ORDER BY id DESC LIMIT 1', [(int) $order['id']]);
    if ($existing) {
        respond(false, 'A result already exists for this laboratory request: ' . $existing['result_number'] . ' (' . $existing['status'] . ').', [], 409);
    }
    $resultNumber = generate_unique_code($pdo, 'lab_results', 'result_number', 'RES');
    $findings = require_field($data, 'findings', 'Findings');
    $remarks = optional_string($data, 'remarks');
    $values = $data['values'] ?? [];
    if (!is_array($values)) {
        $values = [];
    }
    $pdo->beginTransaction();
    $resultId = db_insert_id($pdo, 'INSERT INTO lab_results (result_number, order_id, uploaded_by, status, findings, remarks) VALUES (?, ?, ?, "Pending Review", ?, ?)', [$resultNumber, (int) $order['id'], $actor['id'], $findings, $remarks]);
    save_result_attachments($pdo, $resultId, $data['attachments'] ?? []);
    $stmt = $pdo->prepare('INSERT INTO lab_result_values (result_id, parameter_name, value_text, unit, reference_range, flag) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($values as $value) {
        if (!is_array($value) || trim((string) ($value['parameter'] ?? '')) === '') {
            continue;
        }
        $stmt->execute([
            $resultId,
            trim((string) $value['parameter']),
            trim((string) ($value['value'] ?? '')),
            trim((string) ($value['unit'] ?? '')),
            trim((string) ($value['referenceRange'] ?? '')),
            trim((string) ($value['flag'] ?? '')),
        ]);
    }
    $stmt = $pdo->prepare('UPDATE lab_orders SET status="Result Uploaded", latest_update=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
    $stmt->execute(['Result uploaded - pending review', (int) $order['id']]);
    $stmt = $pdo->prepare('UPDATE lab_order_items SET status="Result Uploaded" WHERE order_id=?');
    $stmt->execute([(int) $order['id']]);
    notify_facility_staff($pdo, (int) $order['facility_id'], ['title' => 'Result pending review', 'message' => $resultNumber . ' is waiting for laboratory review.', 'type_name' => 'results', 'related_order_id' => (int) $order['id'], 'related_result_id' => $resultId]);
    notify_user($pdo, ['user_id' => (int) $order['doctor_id'], 'title' => 'Result uploaded', 'message' => $resultNumber . ' is pending laboratory review.', 'type_name' => 'results', 'related_order_id' => (int) $order['id'], 'related_result_id' => $resultId]);
    audit_log($pdo, $actor, 'CREATE', 'Result', 'Uploaded ' . $resultNumber . ' for ' . $order['order_number']);
    $pdo->commit();
    respond(true, 'Result uploaded and sent for review.', ['resultNumber' => $resultNumber, 'app' => app_data($pdo, $actor)]);
}

function update_result_status($pdo, $data, $actor, $forcedStatus = null)
{
    require_auth($pdo, ['Laboratory Staff']);
    $resultKey = require_field($data, 'resultId', 'Result');
    $status = $forcedStatus ?: require_field($data, 'status', 'Status');
    if (!in_array($status, valid_result_statuses(), true)) {
        respond(false, 'That result status is not allowed.', [], 422, ['status' => 'Invalid status']);
    }
    $result = result_by_identifier($pdo, $resultKey);
    if (!$result || !can_access_result($pdo, $actor, $result)) {
        respond(false, 'Result not found or not available to your role.', [], 404);
    }
    if ($status === 'Released' && $result['status'] !== 'Verified') {
        respond(false, 'A result must be verified before it can be released.', [], 409);
    }
    if ($status === 'Verified' && $result['status'] !== 'Pending Review') {
        respond(false, 'Only pending-review results can be verified.', [], 409);
    }
    if ($status === 'Rejected' && !in_array($result['status'], ['Pending Review', 'Verified'], true)) {
        respond(false, 'Only pending-review or verified results can be rejected.', [], 409);
    }
    if ($result['status'] === 'Released' && $status !== 'Released') {
        respond(false, 'Released results cannot be moved back to another status.', [], 409);
    }
    if ($result['status'] === 'Rejected' && $status !== 'Rejected') {
        respond(false, 'Rejected results cannot be reopened from this workflow.', [], 409);
    }
    $order = one($pdo, 'SELECT * FROM lab_orders WHERE id = ? LIMIT 1', [(int) $result['order_id']]);
    $pdo->beginTransaction();
    $columns = 'status=?, reviewed_by=?, updated_at=CURRENT_TIMESTAMP';
    $params = [$status, $actor['id']];
    if ($status === 'Verified') {
        $columns .= ', verified_at=NOW(), rejected_reason=NULL';
    } elseif ($status === 'Released') {
        $columns .= ', released_at=NOW(), rejected_reason=NULL';
    } elseif ($status === 'Rejected') {
        $columns .= ', rejected_reason=?';
        $params[] = optional_string($data, 'reason', 'Rejected during laboratory review.');
    }
    $params[] = (int) $result['id'];
    $stmt = $pdo->prepare('UPDATE lab_results SET ' . $columns . ' WHERE id=?');
    $stmt->execute($params);

    if (in_array($status, ['Verified', 'Released', 'Rejected'], true)) {
        $stmt = $pdo->prepare('UPDATE lab_orders SET status=?, latest_update=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
        $stmt->execute([$status, 'Result status changed to ' . $status, (int) $order['id']]);
        $stmt = $pdo->prepare('UPDATE lab_order_items SET status=? WHERE order_id=?');
        $stmt->execute([$status, (int) $order['id']]);
    }
    if (in_array($status, ['Verified', 'Released'], true)) {
        notify_user($pdo, ['user_id' => (int) $order['doctor_id'], 'title' => 'New result available', 'message' => $result['result_number'] . ' is ' . strtolower($status) . ' and available for review.', 'type_name' => 'results', 'related_order_id' => (int) $order['id'], 'related_result_id' => (int) $result['id']]);
    }
    if ($status === 'Released') {
        notify_user($pdo, ['patient_id' => (int) $order['patient_id'], 'title' => 'New result released', 'message' => 'Your laboratory result ' . $result['result_number'] . ' is now available.', 'type_name' => 'results', 'related_order_id' => (int) $order['id'], 'related_result_id' => (int) $result['id']]);
    }
    if ($status === 'Rejected') {
        notify_user($pdo, ['user_id' => (int) $order['doctor_id'], 'title' => 'Result rejected', 'message' => $result['result_number'] . ' was rejected during laboratory review.', 'type_name' => 'results', 'related_order_id' => (int) $order['id'], 'related_result_id' => (int) $result['id']]);
    }
    audit_log($pdo, $actor, $status === 'Released' ? 'RELEASE' : ($status === 'Rejected' ? 'REJECT' : 'VERIFY'), 'Result', $status . ' ' . $result['result_number']);
    $pdo->commit();
    respond(true, 'Result status updated.', ['app' => app_data($pdo, $actor)]);
}

function update_result_content($pdo, $data, $actor)
{
    require_auth($pdo, ['Laboratory Staff']);
    $resultKey = require_field($data, 'resultId', 'Result');
    $result = result_by_identifier($pdo, $resultKey);
    if (!$result || !can_access_result($pdo, $actor, $result)) {
        respond(false, 'Result not found or not available to your role.', [], 404);
    }
    if (in_array($result['status'], ['Released', 'Rejected'], true)) {
        respond(false, 'Released or rejected results cannot be edited.', [], 409);
    }
    $findings = require_field($data, 'findings', 'Findings');
    $remarks = optional_string($data, 'remarks');
    $values = is_array($data['values'] ?? null) ? $data['values'] : [];
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('UPDATE lab_results SET findings=?, remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
    $stmt->execute([$findings, $remarks, (int) $result['id']]);
    $stmt = $pdo->prepare('DELETE FROM lab_result_values WHERE result_id=?');
    $stmt->execute([(int) $result['id']]);
    $stmt = $pdo->prepare('INSERT INTO lab_result_values (result_id, parameter_name, value_text, unit, reference_range, flag) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($values as $value) {
        if (!is_array($value) || trim((string) ($value['parameter'] ?? '')) === '') {
            continue;
        }
        $stmt->execute([(int) $result['id'], trim((string) $value['parameter']), trim((string) ($value['value'] ?? '')), trim((string) ($value['unit'] ?? '')), trim((string) ($value['referenceRange'] ?? '')), trim((string) ($value['flag'] ?? ''))]);
    }
    save_result_attachments($pdo, (int) $result['id'], $data['attachments'] ?? []);
    audit_log($pdo, $actor, 'UPDATE', 'Result', 'Edited ' . $result['result_number']);
    $pdo->commit();
    respond(true, 'Result updated.', ['app' => app_data($pdo, $actor)]);
}

function add_clinical_note($pdo, $data, $actor)
{
    require_auth($pdo, ['Doctor']);
    $resultKey = require_field($data, 'resultId', 'Result');
    $note = require_field($data, 'note', 'Clinical note');
    $result = result_by_identifier($pdo, $resultKey);
    if (!$result || !can_access_result($pdo, $actor, $result)) {
        respond(false, 'Result not found or not available to your role.', [], 404);
    }
    $order = one($pdo, 'SELECT * FROM lab_orders WHERE id = ? LIMIT 1', [(int) $result['order_id']]);
    if ((int) $order['doctor_id'] !== (int) $actor['id']) {
        respond(false, 'You can only add notes to your own results.', [], 403);
    }
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT INTO clinical_notes (result_id, doctor_id, note) VALUES (?, ?, ?)');
    $stmt->execute([(int) $result['id'], (int) $actor['id'], $note]);
    if ($result['status'] === 'Released') {
        notify_user($pdo, ['patient_id' => (int) $order['patient_id'], 'title' => 'Clinical note added', 'message' => $actor['name'] . ' added a note to result ' . $result['result_number'] . '.', 'type_name' => 'note', 'related_order_id' => (int) $order['id'], 'related_result_id' => (int) $result['id']]);
    }
    audit_log($pdo, $actor, 'UPDATE', 'Result', 'Added clinical note to ' . $result['result_number']);
    $pdo->commit();
    respond(true, 'Clinical note saved.', ['app' => app_data($pdo, $actor)]);
}

function update_patient_profile($pdo, $data, $actor)
{
    require_auth($pdo, ['Patient']);
    $patientId = (int) $actor['patientId'];
    $patient = one($pdo, 'SELECT * FROM patients WHERE id = ? LIMIT 1', [$patientId]);
    if (!$patient) {
        respond(false, 'Patient profile was not found.', [], 404);
    }
    $email = optional_string($data, 'email');
    $contact = optional_string($data, 'contact');
    if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(false, 'Enter a valid email address.', [], 422);
    }
    validate_max_length($email, 160, 'Email', 'email');
    validate_max_length($contact, 40, 'Contact number', 'contact');
    $dateOfBirth = optional_string($data, 'dateOfBirth', $patient['date_of_birth']);
    $sex = optional_string($data, 'sex', $patient['sex']);
    $address = optional_string($data, 'address', $patient['address']);
    if ($dateOfBirth) {
        $birthTime = strtotime($dateOfBirth);
        if ($birthTime === false || $birthTime > time() || $birthTime < strtotime('-120 years')) {
            respond(false, 'Enter a valid date of birth.', [], 422, ['dateOfBirth' => 'Invalid date']);
        }
        $dateOfBirth = date('Y-m-d', $birthTime);
    }
    if ($sex && !in_array($sex, ['Female', 'Male', 'Non-binary', 'Prefer not to say'], true)) {
        respond(false, 'Select a valid sex option.', [], 422, ['sex' => 'Invalid option']);
    }
    validate_max_length($address, 255, 'Address', 'address');
    if ($email) {
        $exists = one($pdo, 'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [$email, (int) $patient['user_id']]);
        if ($exists) {
            respond(false, 'Email address is already used by another account.', [], 409);
        }
    }
    $pdo->beginTransaction();
    if ($email) {
        $stmt = $pdo->prepare('UPDATE users SET email=?, contact=? WHERE id=?');
        $stmt->execute([$email, $contact, (int) $patient['user_id']]);
    } elseif ($contact) {
        $stmt = $pdo->prepare('UPDATE users SET contact=? WHERE id=?');
        $stmt->execute([$contact, (int) $patient['user_id']]);
    }
    $stmt = $pdo->prepare('UPDATE patients SET date_of_birth=?, sex=?, address=? WHERE id=?');
    $stmt->execute([
        $dateOfBirth,
        $sex,
        $address,
        $patientId,
    ]);
    audit_log($pdo, $actor, 'UPDATE', 'Patient', 'Updated patient profile ' . $patient['patient_code']);
    $pdo->commit();
    $freshUser = fetch_user($pdo, $actor['id']);
    respond(true, 'Profile updated successfully.', ['app' => app_data($pdo, $freshUser), 'user' => $freshUser]);
}

function change_password($pdo, $data, $actor)
{
    $userRow = one($pdo, 'SELECT password_hash FROM users WHERE id = ? LIMIT 1', [$actor['id']]);
    $current = require_field($data, 'currentPassword', 'Current password');
    $new = require_field($data, 'newPassword', 'New password');
    $confirm = require_field($data, 'confirmPassword', 'Confirm password');
    if ($new !== $confirm) {
        respond(false, 'New passwords do not match.', [], 422);
    }
    if (!valid_password($new)) {
        respond(false, 'New password must be at least 8 characters and include a letter and number.', [], 422);
    }
    if (!password_match_type($current, $userRow['password_hash'])) {
        respond(false, 'Current password is incorrect.', [], 401);
    }
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?');
    $stmt->execute([password_hash($new, PASSWORD_DEFAULT), $actor['id']]);
    audit_log($pdo, $actor, 'UPDATE', 'Authentication', 'Changed own password');
    $pdo->commit();
    respond(true, 'Password changed successfully.');
}

function deactivate_user($pdo, $data, $actor)
{
    require_auth($pdo, ['Admin']);
    $id = (int) require_field($data, 'id', 'User');
    if ($id === (int) $actor['id']) {
        respond(false, 'You cannot delete or deactivate your own Admin account.', [], 422);
    }
    $target = one($pdo, 'SELECT u.id, u.name, u.status, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1', [$id]);
    if (!$target) {
        respond(false, 'User not found.', [], 404);
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('UPDATE users SET status="Inactive", updated_at=CURRENT_TIMESTAMP WHERE id=?');
    $stmt->execute([$id]);
    audit_log($pdo, $actor, 'DELETE', 'User', 'Deactivated ' . $target['role'] . ' user ' . $target['name']);
    $pdo->commit();

    respond(true, 'User deactivated successfully.', ['users' => fetch_users($pdo), 'app' => app_data($pdo, $actor)]);
}

function notification_filter_sql($pdo, $user)
{
    if ($user['role'] === 'Admin') {
        return ['1 = 1', []];
    }
    $sql = '(user_id = ? OR role_name = ?';
    $params = [$user['id'], $user['role']];
    if ($user['role'] === 'Laboratory Staff') {
        $ids = lab_facility_ids($pdo, $user);
        if ($ids) {
            $sql .= ' AND (related_order_id IS NULL OR related_order_id IN (SELECT id FROM lab_orders WHERE facility_id IN (' . placeholders(count($ids)) . ')))';
            $params = array_merge($params, $ids);
        } else {
            $sql .= ' AND related_order_id IS NULL';
        }
    }
    if ($user['role'] === 'Patient' && $user['patientId']) {
        $sql .= ' OR patient_id = ?';
        $params[] = $user['patientId'];
    }
    $sql .= ')';
    return [$sql, $params];
}

try {
    $pdo = db();
    $action = $_GET['action'] ?? ($_POST['action'] ?? '');
    if ($action === '') {
        $compatibilityActions = [
            '/api/admin/audit-logs.php' => 'audit_logs',
            '/api/admin/reports.php' => 'reports_summary',
            '/api/admin/users.php' => 'list_users',
            '/api/auth/login.php' => 'login',
            '/api/auth/logout.php' => 'logout',
            '/api/auth/register.php' => 'register_patient',
            '/api/doctor/notes.php' => 'add_clinical_note',
            '/api/doctor/patients.php' => 'doctor_patients',
            '/api/doctor/results.php' => 'doctor_results',
            '/api/laboratory/orders.php' => 'lab_orders',
            '/api/laboratory/results.php' => 'list_all_results',
            '/api/laboratory/upload-result.php' => 'upload_result',
            '/api/laboratory/verify-result.php' => 'review_result',
            '/api/patient/notifications.php' => 'notifications',
            '/api/patient/profile.php' => 'patient_profile',
            '/api/patient/results.php' => 'patient_results',
        ];
        $requestPath = (string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
        $action = $compatibilityActions[$requestPath] ?? '';
    }
    $data = request_data();
    validate_csrf_request($action);

    if ($action === 'health') {
        respond(true, 'API is available.', ['database' => DB_DRIVER]);
    }

    if ($action === 'login') {
        $identifier = strtolower(require_field($data, 'identifier', 'Email or username'));
        $password = require_field($data, 'password', 'Password');
        $row = one($pdo, 'SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE (LOWER(u.email)=? OR LOWER(u.username)=?) AND u.status="Active" LIMIT 1', [$identifier, $identifier]);
        if (!$row) {
            usleep(250000);
            respond(false, 'Invalid email, username, or password.', [], 401);
        }
        $match = password_match_type($password, $row['password_hash']);
        if (!$match) {
            usleep(250000);
            respond(false, 'Invalid email, username, or password.', [], 401);
        }
        $user = fetch_user($pdo, (int) $row['id']);
        $pdo->beginTransaction();
        if ($match === 'demo_hash' || password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
            $stmt = $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?');
            $stmt->execute([password_hash($password, PASSWORD_DEFAULT), (int) $row['id']]);
        }
        audit_log($pdo, $user, 'LOGIN', 'Authentication', 'Successful login');
        $pdo->commit();
        clinic_regenerate_session();
        $_SESSION['user_id'] = (int) $row['id'];
        respond(true, 'Login successful.', ['user' => $user, 'csrfToken' => rotate_csrf_token()]);
    }

    if ($action === 'logout') {
        $user = current_user($pdo);
        if ($user) {
            try {
                audit_log($pdo, $user, 'LOGOUT', 'Authentication', 'User logged out');
            } catch (Throwable $ignored) {
                // Logout should clear the session even if audit logging is temporarily unavailable.
            }
        }
        clinic_destroy_session();
        respond(true, 'Logged out successfully.');
    }

    if ($action === 'session') {
        $user = current_user($pdo);
        respond((bool) $user, $user ? 'Session active.' : 'No active session.', ['user' => $user, 'csrfToken' => $_SESSION['csrf_token']], $user ? 200 : 401);
    }

    if ($action === 'download_result_file') {
        download_result_file($pdo, (int) ($_GET['id'] ?? 0), require_auth($pdo));
    }

    if ($action === 'download_result_details') {
        download_result_details($pdo, (int) ($_GET['id'] ?? 0), require_auth($pdo));
    }

    if ($action === 'register_patient') {
        $settings = clinic_maintenance_current($pdo);
        if (clinic_maintenance_is_active($settings)) {
            respond(false, $settings['message'], [
                'maintenance' => clinic_maintenance_public_settings($settings),
            ], 503);
        }

        $fullName = require_field($data, 'fullName', 'Full name');
        $email = strtolower(require_field($data, 'email', 'Email'));
        $username = strtolower(require_field($data, 'username', 'Username'));
        $password = require_field($data, 'password', 'Password');
        $dateOfBirth = require_field($data, 'dateOfBirth', 'Date of birth');
        $sex = require_field($data, 'sex', 'Sex');
        $contact = require_field($data, 'contact', 'Contact number');
        $address = require_field($data, 'address', 'Address');
        if (empty($data['termsAccepted']) || empty($data['privacyAcknowledged'])) {
            respond(false, 'Accept the terms and privacy notice to create an account.', [], 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respond(false, 'Enter a valid email address.', [], 422);
        }
        if (!valid_username($username)) {
            respond(false, 'Use a 3-20 character username with letters, numbers, dots, hyphens, or underscores.', [], 422);
        }
        if (!preg_match('/^(?=.*[A-Za-z])(?=.*\d).{8,}$/', $password)) {
            respond(false, 'Password must be at least 8 characters and include a letter and number.', [], 422);
        }
        $birthTime = strtotime($dateOfBirth);
        if ($birthTime === false || $birthTime > time() || $birthTime < strtotime('-120 years')) {
            respond(false, 'Enter a valid date of birth.', [], 422, ['dateOfBirth' => 'Invalid date']);
        }
        if (!in_array($sex, ['Female', 'Male', 'Non-binary', 'Prefer not to say'], true)) {
            respond(false, 'Select a valid sex option.', [], 422, ['sex' => 'Invalid option']);
        }
        if (!preg_match('/^[+\d][\d\s()\-]{7,17}$/', $contact)) {
            respond(false, 'Enter a valid contact number.', [], 422, ['contact' => 'Invalid contact']);
        }
        if (one($pdo, 'SELECT id FROM users WHERE email=? OR username=? LIMIT 1', [$email, $username])) {
            respond(false, 'An account already exists with that email or username.', [], 409);
        }
        $facilityId = find_facility_id($pdo, $data, true);
        if (!$facilityId) {
            respond(false, 'Patient registration is unavailable until an active facility is configured.', [], 503);
        }
        $pdo->beginTransaction();
        $userId = db_insert_id($pdo, 'INSERT INTO users (role_id, name, email, username, password_hash, avatar, contact, status) VALUES (?, ?, ?, ?, ?, ?, ?, "Active")', [role_id($pdo, 'Patient'), $fullName, $email, $username, password_hash($password, PASSWORD_DEFAULT), initials($fullName), $contact]);
        $stmt = $pdo->prepare('INSERT INTO patients (user_id, patient_code, date_of_birth, sex, address, primary_facility_id, privacy_acknowledged) VALUES (?, ?, ?, ?, ?, ?, 1)');
        $stmt->execute([$userId, generate_patient_code($pdo), date('Y-m-d', $birthTime), $sex, $address, $facilityId]);
        $user = fetch_user($pdo, $userId);
        notify_user($pdo, ['role_name' => 'Admin', 'title' => 'New patient registered', 'message' => $fullName . ' created a patient portal account.', 'type_name' => 'users']);
        audit_log($pdo, $user, 'CREATE', 'Patient', 'Registered new patient account');
        $pdo->commit();
        clinic_regenerate_session();
        $_SESSION['user_id'] = $userId;
        respond(true, 'Patient account created successfully.', ['user' => fetch_user($pdo, $userId), 'csrfToken' => rotate_csrf_token()]);
    }

    if ($action === 'maintenance_settings') {
        require_auth($pdo, ['Admin']);
        respond(true, 'Maintenance settings loaded.', [
            'maintenance' => clinic_maintenance_public_settings(clinic_maintenance_current($pdo)),
        ]);
    }

    if ($action === 'save_maintenance_settings') {
        save_maintenance_settings($pdo, $data, require_auth($pdo, ['Admin']));
    }

    if (in_array($action, ['app_data', 'store_read'], true)) {
        $user = require_auth($pdo);
        respond(true, 'Application data loaded.', app_data($pdo, $user));
    }

    if (in_array($action, ['list_users'], true)) {
        require_auth($pdo, ['Admin']);
        respond(true, 'Users loaded.', ['users' => fetch_users($pdo)]);
    }

    if (in_array($action, ['save_user', 'create_user', 'update_user'], true)) {
        save_user($pdo, $data, require_auth($pdo, ['Admin']));
    }

    if ($action === 'delete_user') {
        deactivate_user($pdo, $data, require_auth($pdo, ['Admin']));
    }

    if ($action === 'toggle_user_status') {
        $actor = require_auth($pdo, ['Admin']);
        $id = (int) require_field($data, 'id', 'User');
        $status = optional_string($data, 'status', 'Inactive') === 'Active' ? 'Active' : 'Inactive';
        if ($id === (int) $actor['id'] && $status !== 'Active') {
            respond(false, 'You cannot deactivate your own Admin account.', [], 422);
        }
        $target = one($pdo, 'SELECT id FROM users WHERE id = ? LIMIT 1', [$id]);
        if (!$target) {
            respond(false, 'User not found.', [], 404);
        }
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('UPDATE users SET status=? WHERE id=?');
        $stmt->execute([$status, $id]);
        audit_log($pdo, $actor, 'UPDATE', 'User', 'Set user #' . $id . ' to ' . $status);
        $pdo->commit();
        respond(true, 'User status updated.', ['users' => fetch_users($pdo)]);
    }

    if ($action === 'reset_user_password') {
        $actor = require_auth($pdo, ['Admin']);
        $id = (int) require_field($data, 'id', 'User');
        $password = require_field($data, 'password', 'New password');
        if (!valid_password($password)) {
            respond(false, 'Password must be at least 8 characters and include a letter and number.', [], 422, ['password' => 'Weak password']);
        }
        if (!one($pdo, 'SELECT id FROM users WHERE id = ? LIMIT 1', [$id])) {
            respond(false, 'User not found.', [], 404);
        }
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?');
        $stmt->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
        audit_log($pdo, $actor, 'UPDATE', 'Authentication', 'Reset password for user #' . $id);
        $pdo->commit();
        respond(true, 'Password reset successfully.');
    }

    if (in_array($action, ['list_facilities', 'available_facilities', 'lab_facilities'], true)) {
        $user = require_auth($pdo);
        respond(true, 'Facilities loaded.', ['facilities' => fetch_facilities($pdo, $user)]);
    }

    if (in_array($action, ['save_facility', 'create_facility', 'update_facility'], true)) {
        save_facility($pdo, $data, require_auth($pdo, ['Admin']));
    }

    if (in_array($action, ['list_tests', 'available_tests'], true)) {
        $user = require_auth($pdo);
        respond(true, 'Tests loaded.', ['tests' => fetch_tests($pdo, $user)]);
    }

    if (in_array($action, ['save_test', 'create_test', 'update_test'], true)) {
        save_test($pdo, $data, require_auth($pdo, ['Admin']));
    }

    if (in_array($action, ['list_all_orders', 'doctor_orders', 'lab_orders', 'patient_orders'], true)) {
        $user = require_auth($pdo);
        respond(true, 'Laboratory requests loaded.', ['orders' => fetch_orders($pdo, $user)]);
    }

    if (in_array($action, ['list_all_results', 'doctor_results', 'patient_results'], true)) {
        $user = require_auth($pdo);
        respond(true, 'Results loaded.', ['results' => fetch_results($pdo, $user)]);
    }

    if (in_array($action, ['doctor_patients'], true)) {
        $user = require_auth($pdo, ['Doctor']);
        respond(true, 'Patients loaded.', ['patients' => fetch_patients($pdo, $user, 'role'), 'availablePatients' => fetch_patients($pdo, $user, 'role')]);
    }

    if ($action === 'create_order') {
        create_order($pdo, $data, require_auth($pdo, ['Doctor']));
    }

    if ($action === 'update_order_status') {
        update_order_status($pdo, $data, require_auth($pdo, ['Laboratory Staff']));
    }

    if ($action === 'prepare_result_uploads') {
        $actor = require_auth($pdo, ['Laboratory Staff']);
        try {
            $uploads = clinic_storage_prepare_uploads($data['files'] ?? [], $actor);
        } catch (InvalidArgumentException $e) {
            respond(false, $e->getMessage(), [], 422, ['attachments' => $e->getMessage()]);
        }
        respond(true, 'Signed upload URLs created.', ['uploads' => $uploads]);
    }

    if ($action === 'upload_result') {
        upload_result($pdo, $data, require_auth($pdo, ['Laboratory Staff']));
    }

    if (in_array($action, ['update_result_status', 'review_result'], true)) {
        update_result_status($pdo, $data, require_auth($pdo, ['Laboratory Staff']));
    }

    if ($action === 'update_result_content') {
        update_result_content($pdo, $data, require_auth($pdo, ['Laboratory Staff']));
    }

    if ($action === 'release_result') {
        update_result_status($pdo, $data, require_auth($pdo, ['Laboratory Staff']), 'Released');
    }

    if ($action === 'reject_result') {
        update_result_status($pdo, $data, require_auth($pdo, ['Laboratory Staff']), 'Rejected');
    }

    if ($action === 'add_clinical_note') {
        add_clinical_note($pdo, $data, require_auth($pdo, ['Doctor']));
    }

    if ($action === 'patient_profile') {
        $user = require_auth($pdo, ['Patient']);
        respond(true, 'Patient profile loaded.', ['patients' => fetch_patients($pdo, $user, 'role')]);
    }

    if ($action === 'update_patient_profile') {
        update_patient_profile($pdo, $data, require_auth($pdo, ['Patient']));
    }

    if ($action === 'change_password') {
        change_password($pdo, $data, require_auth($pdo));
    }

    if (in_array($action, ['notifications'], true)) {
        $user = require_auth($pdo);
        respond(true, 'Notifications loaded.', ['notifications' => fetch_notifications($pdo, $user)]);
    }

    if ($action === 'mark_notification_read') {
        $user = require_auth($pdo);
        $id = (int) require_field($data, 'id', 'Notification');
        list($filter, $params) = notification_filter_sql($pdo, $user);
        $stmt = $pdo->prepare('UPDATE notifications SET is_read=1 WHERE id=? AND ' . $filter);
        $stmt->execute(array_merge([$id], $params));
        respond(true, 'Notification marked as read.', ['notifications' => fetch_notifications($pdo, $user)]);
    }

    if ($action === 'mark_all_notifications_read') {
        $user = require_auth($pdo);
        list($filter, $params) = notification_filter_sql($pdo, $user);
        $stmt = $pdo->prepare('UPDATE notifications SET is_read=1 WHERE ' . $filter);
        $stmt->execute($params);
        respond(true, 'All notifications marked as read.', ['notifications' => fetch_notifications($pdo, $user)]);
    }

    if (in_array($action, ['audit_logs'], true)) {
        $user = require_auth($pdo, ['Admin']);
        respond(true, 'Audit logs loaded.', ['audit' => fetch_audit($pdo, $user)]);
    }

    if (in_array($action, ['reports_summary'], true)) {
        $user = require_auth($pdo);
        $orders = fetch_orders($pdo, $user);
        $results = fetch_results($pdo, $user);
        respond(true, 'Reports loaded.', ['reports' => reports_summary($orders, $results)]);
    }

    if (in_array($action, ['admin_dashboard', 'doctor_dashboard', 'lab_dashboard', 'patient_dashboard', 'lab_queue'], true)) {
        $user = require_auth($pdo);
        respond(true, 'Dashboard loaded.', app_data($pdo, $user));
    }

    respond(false, 'Unknown API action.', [], 404);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(false, 'Database error. Please check the configured database and imported schema.', [], 500, error_details($e));
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(false, 'Server error while processing the request.', [], 500, error_details($e));
}
