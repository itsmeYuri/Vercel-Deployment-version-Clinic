<?php

require_once __DIR__ . '/../app/core/helpers.php';

$cases = [
    ['/public/auth/login.php', '/public/auth/login.php#login', '/api/index.php'],
    ['/auth/login.php', '/auth/login.php#login', '/api/index.php'],
    ['/clinic/public/doctor/dashboard.php', '/clinic/public/auth/login.php#login', '/clinic/api/index.php'],
    ['/clinic/doctor/dashboard.php', '/clinic/auth/login.php#login', '/clinic/api/index.php'],
];

foreach ($cases as [$scriptName, $expectedPublic, $expectedApi]) {
    $_SERVER['SCRIPT_NAME'] = $scriptName;
    if (clinic_public_url('auth/login.php#login') !== $expectedPublic) {
        throw new RuntimeException('Unexpected public URL for ' . $scriptName);
    }
    if (clinic_api_url() !== $expectedApi) {
        throw new RuntimeException('Unexpected API URL for ' . $scriptName);
    }
}

echo "Path routing tests passed.\n";
