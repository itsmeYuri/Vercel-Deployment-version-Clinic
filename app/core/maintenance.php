<?php

const CLINIC_MAINTENANCE_DEFAULT_MESSAGE = 'The system is currently undergoing maintenance. Please try again later.';

function clinic_maintenance_allowed_roles()
{
    return ['Admin', 'Doctor', 'Laboratory Staff', 'Patient'];
}

function clinic_maintenance_allowed_pages()
{
    return [
        'dashboard', 'users', 'facilities', 'tests', 'orders', 'results', 'reports',
        'audit', 'notifications', 'settings', 'maintenance', 'registration',
        'create-order', 'upload', 'review', 'operations', 'patients', 'queue', 'profile',
    ];
}

function clinic_maintenance_decode_list($value)
{
    if (is_array($value)) {
        return array_values(array_filter(array_map('trim', $value), 'strlen'));
    }
    if ($value === null || $value === '') {
        return [];
    }
    $decoded = json_decode((string) $value, true);
    if (is_array($decoded)) {
        return array_values(array_filter(array_map('trim', $decoded), 'strlen'));
    }
    return array_values(array_filter(array_map('trim', explode(',', (string) $value)), 'strlen'));
}

function clinic_maintenance_empty_settings()
{
    return [
        'id' => null,
        'is_enabled' => false,
        'scope' => 'all',
        'affected_roles' => [],
        'affected_pages' => [],
        'message' => CLINIC_MAINTENANCE_DEFAULT_MESSAGE,
        'reason' => null,
        'start_at' => null,
        'end_at' => null,
        'created_by' => null,
        'created_at' => null,
        'updated_at' => null,
    ];
}

function clinic_maintenance_ensure_table($pdo)
{
    static $checked = false;
    if ($checked) {
        return;
    }

    if (db_is_postgres()) {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS maintenance_settings (
              id INTEGER NOT NULL PRIMARY KEY,
              is_enabled SMALLINT NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
              scope VARCHAR(40) NOT NULL DEFAULT 'all',
              affected_roles TEXT NULL,
              affected_pages TEXT NULL,
              message VARCHAR(255) NOT NULL DEFAULT 'The system is currently undergoing maintenance. Please try again later.',
              reason VARCHAR(255) NULL,
              start_at TIMESTAMP NULL,
              end_at TIMESTAMP NULL,
              created_by INTEGER NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"
        );
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_maintenance_enabled ON maintenance_settings (is_enabled)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_maintenance_updated ON maintenance_settings (updated_at)');
    } else {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS maintenance_settings (
              id INT NOT NULL PRIMARY KEY,
              is_enabled TINYINT(1) NOT NULL DEFAULT 0,
              scope VARCHAR(40) NOT NULL DEFAULT 'all',
              affected_roles TEXT NULL,
              affected_pages TEXT NULL,
              message VARCHAR(255) NOT NULL DEFAULT 'The system is currently undergoing maintenance. Please try again later.',
              reason VARCHAR(255) NULL,
              start_at DATETIME NULL,
              end_at DATETIME NULL,
              created_by INT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_maintenance_enabled (is_enabled),
              INDEX idx_maintenance_updated (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }
    $checked = true;
}

function clinic_maintenance_normalize_settings($row)
{
    if (!$row) {
        return clinic_maintenance_empty_settings();
    }
    return [
        'id' => (int) $row['id'],
        'is_enabled' => (bool) $row['is_enabled'],
        'scope' => $row['scope'] ?: 'all',
        'affected_roles' => clinic_maintenance_decode_list($row['affected_roles'] ?? null),
        'affected_pages' => clinic_maintenance_decode_list($row['affected_pages'] ?? null),
        'message' => $row['message'] ?: CLINIC_MAINTENANCE_DEFAULT_MESSAGE,
        'reason' => $row['reason'] ?? null,
        'start_at' => $row['start_at'] ?? null,
        'end_at' => $row['end_at'] ?? null,
        'created_by' => isset($row['created_by']) && $row['created_by'] !== null ? (int) $row['created_by'] : null,
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function clinic_maintenance_current($pdo)
{
    try {
        $stmt = $pdo->query('SELECT * FROM maintenance_settings WHERE id = 1 LIMIT 1');
        return clinic_maintenance_normalize_settings($stmt->fetch());
    } catch (Throwable $e) {
        return clinic_maintenance_empty_settings();
    }
}

function clinic_maintenance_is_active($settings, $now = null)
{
    if (empty($settings['is_enabled'])) {
        return false;
    }
    $time = $now ? strtotime($now) : time();
    if (!empty($settings['start_at']) && strtotime($settings['start_at']) > $time) {
        return false;
    }
    if (!empty($settings['end_at']) && strtotime($settings['end_at']) < $time) {
        return false;
    }
    return true;
}

function clinic_maintenance_role_key($role)
{
    $map = [
        'Admin' => 'admin',
        'Doctor' => 'doctor',
        'Laboratory Staff' => 'laboratory',
        'Patient' => 'patient',
    ];
    return $map[$role] ?? strtolower((string) $role);
}

function clinic_maintenance_page_key($page)
{
    $page = strtolower(trim((string) $page));
    $page = basename($page, '.php');
    $map = [
        'upload-result' => 'upload',
        'verify-result' => 'review',
        'audit-logs' => 'audit',
        'register' => 'registration',
    ];
    return $map[$page] ?? $page;
}

function clinic_maintenance_sanitize_list($values, $allowed)
{
    $values = clinic_maintenance_decode_list($values);
    return array_values(array_intersect($values, $allowed));
}

function clinic_maintenance_decision($pdo, $role, $page)
{
    $settings = clinic_maintenance_current($pdo);
    $pageKey = clinic_maintenance_page_key($page);
    $roleKey = clinic_maintenance_role_key($role);
    $blocked = false;

    if (clinic_maintenance_is_active($settings)) {
        if ($role === 'Admin') {
            $blocked = false;
        } elseif ($settings['scope'] === 'all') {
            $blocked = true;
        } elseif (in_array($settings['scope'], ['admin', 'doctor', 'laboratory', 'patient'], true)) {
            $blocked = $settings['scope'] === $roleKey;
        } elseif ($settings['scope'] === 'roles') {
            $blocked = in_array($role, $settings['affected_roles'], true);
        } elseif ($settings['scope'] === 'pages') {
            $blocked = in_array($pageKey, array_map('clinic_maintenance_page_key', $settings['affected_pages']), true);
        }
    }

    return [
        'blocked' => $blocked,
        'page' => $pageKey,
        'role' => $role,
        'settings' => $settings,
    ];
}

function clinic_maintenance_public_settings($settings)
{
    return [
        'id' => $settings['id'],
        'isEnabled' => (bool) $settings['is_enabled'],
        'isActive' => clinic_maintenance_is_active($settings),
        'scope' => $settings['scope'],
        'affectedRoles' => $settings['affected_roles'],
        'affectedPages' => $settings['affected_pages'],
        'message' => $settings['message'],
        'reason' => $settings['reason'],
        'startAt' => $settings['start_at'],
        'endAt' => $settings['end_at'],
        'createdBy' => $settings['created_by'],
        'createdAt' => $settings['created_at'],
        'updatedAt' => $settings['updated_at'],
    ];
}

function checkMaintenanceMode($role, $currentPage)
{
    return clinic_maintenance_decision(db(), $role, $currentPage);
}

function clinic_maintenance_redirect_if_blocked($pdo, $role, $page)
{
    $decision = clinic_maintenance_decision($pdo, $role, $page);
    if (!$decision['blocked']) {
        return;
    }
    $params = http_build_query(['role' => $role, 'page' => $decision['page']]);
    header('Location: ' . clinic_public_url('maintenance.php?' . $params));
    exit;
}
