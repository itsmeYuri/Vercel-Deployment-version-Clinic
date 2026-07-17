<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';

function clinic_start_session()
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    session_name('CLINIC_SYSTEM_V2');
    $forwardedProto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    $secureCookie = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || $forwardedProto === 'https'
        || filter_var(clinic_env('CLINIC_COOKIE_SECURE', '0'), FILTER_VALIDATE_BOOLEAN);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secureCookie,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
}

function clinic_csrf_token()
{
    clinic_start_session();
    return $_SESSION['csrf_token'];
}

function clinic_public_user_from_row($row)
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
        'patientId' => isset($row['patient_id']) && $row['patient_id'] !== null ? (int) $row['patient_id'] : null,
    ];
}

function clinic_fetch_user($id)
{
    $pdo = db();
    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email, u.username, u.avatar, u.contact, u.status, r.name AS role,
                p.id AS patient_id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN patients p ON p.user_id = u.id
         WHERE u.id = ? AND u.status = "Active"
         LIMIT 1'
    );
    $stmt->execute([(int) $id]);

    return clinic_public_user_from_row($stmt->fetch());
}

function clinic_current_user()
{
    clinic_start_session();

    if (empty($_SESSION['user_id'])) {
        return null;
    }

    try {
        $user = clinic_fetch_user((int) $_SESSION['user_id']);
    } catch (Throwable $e) {
        unset($_SESSION['user_id']);
        $_SESSION['auth_notice'] = 'The database is temporarily unavailable. Please try again after MySQL starts.';
        return null;
    }

    if (!$user) {
        unset($_SESSION['user_id']);
    }

    return $user;
}

function clinic_role_home_path($role)
{
    $paths = [
        'Admin' => 'admin/dashboard.php#dashboard',
        'Doctor' => 'doctor/dashboard.php#dashboard',
        'Laboratory Staff' => 'laboratory/dashboard.php#dashboard',
        'Patient' => 'patient/dashboard.php#dashboard',
    ];

    return $paths[$role] ?? 'auth/login.php#login';
}

function clinic_require_auth()
{
    $user = clinic_current_user();
    if (!$user) {
        clinic_redirect('auth/login.php#login');
    }

    return $user;
}

function clinic_require_role($role)
{
    $user = clinic_require_auth();
    if ($user['role'] !== $role) {
        clinic_redirect(clinic_role_home_path($user['role']));
    }

    return $user;
}

function clinic_logout()
{
    clinic_start_session();
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', $params['secure'], $params['httponly']);
    }

    session_destroy();
}
