<?php

require_once __DIR__ . '/../core/auth.php';
require_once __DIR__ . '/../core/maintenance.php';

if (empty($requiredRole)) {
    clinic_redirect('auth/login.php#login');
}

$currentUser = clinic_require_role($requiredRole);

$currentPage = $initialPage ?? pathinfo($_SERVER['SCRIPT_NAME'] ?? 'dashboard', PATHINFO_FILENAME);
clinic_maintenance_redirect_if_blocked(db(), $currentUser['role'], $currentPage);
