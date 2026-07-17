<?php

function clinic_env($name, $default = null)
{
    $value = getenv($name);
    return $value === false || $value === '' ? $default : $value;
}

$clinicLocalConfig = is_file(__DIR__ . '/local.php') ? (require __DIR__ . '/local.php') : [];
if (!is_array($clinicLocalConfig)) {
    $clinicLocalConfig = [];
}

function clinic_config_value($local, $envName, $default)
{
    return clinic_env($envName, array_key_exists($local, $GLOBALS['clinicLocalConfig']) ? $GLOBALS['clinicLocalConfig'][$local] : $default);
}

define('DB_HOST', clinic_config_value('db_host', 'CLINIC_DB_HOST', '127.0.0.1'));
define('DB_PORT', (int) clinic_config_value('db_port', 'CLINIC_DB_PORT', '3306'));
define('DB_NAME', clinic_config_value('db_name', 'CLINIC_DB_NAME', 'clinic_system_v2'));
define('DB_USER', clinic_config_value('db_user', 'CLINIC_DB_USER', 'root'));
define('DB_PASS', clinic_config_value('db_pass', 'CLINIC_DB_PASS', ''));
define('DB_CHARSET', clinic_config_value('db_charset', 'CLINIC_DB_CHARSET', 'utf8mb4'));
define('APP_DEBUG', filter_var(clinic_config_value('app_debug', 'CLINIC_APP_DEBUG', '0'), FILTER_VALIDATE_BOOLEAN));
define('APP_TIMEZONE', clinic_config_value('app_timezone', 'CLINIC_APP_TIMEZONE', 'Asia/Manila'));
define('DB_TIMEZONE', clinic_config_value('db_timezone', 'CLINIC_DB_TIMEZONE', '+08:00'));

date_default_timezone_set(APP_TIMEZONE);

function db()
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec('SET time_zone = ' . $pdo->quote(DB_TIMEZONE));

    return $pdo;
}
