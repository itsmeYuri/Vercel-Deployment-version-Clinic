<?php

require_once __DIR__ . '/../core/auth.php';

if (empty($requiredRole)) {
    clinic_redirect('auth/login.php#login');
}

$currentUser = clinic_require_role($requiredRole);

