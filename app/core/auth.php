<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/session.php';

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
        $_SESSION['auth_notice'] = 'The database is temporarily unavailable. Please try again shortly.';
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
    clinic_destroy_session();
}
