<?php

return [
    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'clinic_system_v2',
    'db_user' => 'root',
    'db_pass' => '',
    'db_charset' => 'utf8mb4',
    'app_debug' => false,
    'app_timezone' => 'Asia/Manila',
    'db_timezone' => '+08:00',
    // Required for login MFA when running locally. Use a verified sender address.
    'resend_api_key' => '',
    'mail_from' => '',
];
