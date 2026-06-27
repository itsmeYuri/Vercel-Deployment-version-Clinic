<?php
require_once __DIR__ . '/../../app/core/auth.php';

clinic_logout();
clinic_redirect('auth/login.php#login');

