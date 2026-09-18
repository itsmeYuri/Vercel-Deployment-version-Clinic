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

$databaseUrl = clinic_env('CLINIC_DATABASE_URL', clinic_env('SUPABASE_DB_URL', clinic_env('DATABASE_URL', '')));
$databaseParts = $databaseUrl !== '' ? parse_url($databaseUrl) : false;
$usePostgres = is_array($databaseParts) && in_array(strtolower((string) ($databaseParts['scheme'] ?? '')), ['postgres', 'postgresql'], true);

define('DB_DRIVER', $usePostgres ? 'pgsql' : 'mysql');
define('DB_HOST', clinic_config_value('db_host', 'CLINIC_DB_HOST', '127.0.0.1'));
define('DB_PORT', (int) clinic_config_value('db_port', 'CLINIC_DB_PORT', '3306'));
define('DB_NAME', clinic_config_value('db_name', 'CLINIC_DB_NAME', 'clinic_system_v2'));
define('DB_USER', clinic_config_value('db_user', 'CLINIC_DB_USER', 'root'));
define('DB_PASS', clinic_config_value('db_pass', 'CLINIC_DB_PASS', ''));
define('DB_CHARSET', clinic_config_value('db_charset', 'CLINIC_DB_CHARSET', 'utf8mb4'));
define('APP_DEBUG', filter_var(clinic_config_value('app_debug', 'CLINIC_APP_DEBUG', '0'), FILTER_VALIDATE_BOOLEAN));
define('APP_TIMEZONE', clinic_config_value('app_timezone', 'CLINIC_APP_TIMEZONE', 'Asia/Manila'));
define('DB_TIMEZONE', clinic_config_value('db_timezone', 'CLINIC_DB_TIMEZONE', '+08:00'));
define('SUPABASE_URL', rtrim((string) clinic_env('SUPABASE_URL', ''), '/'));
define('SUPABASE_ANON_KEY', (string) clinic_env('SUPABASE_ANON_KEY', ''));
define('SUPABASE_SERVICE_ROLE_KEY', (string) clinic_env('SUPABASE_SERVICE_ROLE_KEY', ''));
define('SUPABASE_STORAGE_BUCKET', (string) clinic_env('SUPABASE_STORAGE_BUCKET', 'lab-results'));
define('CLINIC_SESSION_DRIVER', strtolower((string) clinic_env('CLINIC_SESSION_DRIVER', clinic_env('VERCEL', '') !== '' ? 'database' : 'native')));
define('CLINIC_SESSION_TTL', max(900, (int) clinic_env('CLINIC_SESSION_TTL', '43200')));

if ($usePostgres) {
    $GLOBALS['clinicDatabaseUrlParts'] = $databaseParts;
}

date_default_timezone_set(APP_TIMEZONE);

function clinic_normalize_sql($sql)
{
    if (DB_DRIVER !== 'pgsql') {
        return $sql;
    }
    // The original MySQL queries use double quotes for string literals. PostgreSQL
    // reserves double quotes for identifiers, so normalize those existing literals.
    return preg_replace_callback('/"([^"\\r\\n]*)"/', function ($match) {
        return "'" . str_replace("'", "''", $match[1]) . "'";
    }, $sql);
}

class ClinicPDO extends PDO
{
    public function prepare($query, $options = []): PDOStatement|false
    {
        return parent::prepare(clinic_normalize_sql($query), $options);
    }

    public function exec($statement): int|false
    {
        return parent::exec(clinic_normalize_sql($statement));
    }

    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false
    {
        $query = clinic_normalize_sql($query);
        if ($fetchMode === null) {
            return parent::query($query);
        }
        return parent::query($query, $fetchMode, ...$fetchModeArgs);
    }
}

function db()
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (DB_DRIVER === 'pgsql') {
        $parts = $GLOBALS['clinicDatabaseUrlParts'] ?? [];
        $host = (string) ($parts['host'] ?? '');
        $port = (int) ($parts['port'] ?? 5432);
        $name = ltrim((string) ($parts['path'] ?? '/postgres'), '/') ?: 'postgres';
        $user = rawurldecode((string) ($parts['user'] ?? 'postgres'));
        $pass = rawurldecode((string) ($parts['pass'] ?? ''));
        if ($host === '' || $pass === '') {
            throw new RuntimeException('SUPABASE_DB_URL must contain a PostgreSQL host, username, password, and database.');
        }
        $dsn = 'pgsql:host=' . $host . ';port=' . $port . ';dbname=' . $name . ';sslmode=require';
    } else {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $user = DB_USER;
        $pass = DB_PASS;
    }

    $pdo = new ClinicPDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Supavisor transaction mode does not support named server-side prepared statements.
        PDO::ATTR_EMULATE_PREPARES => DB_DRIVER === 'pgsql',
    ]);
    if (DB_DRIVER === 'mysql') {
        $pdo->exec('SET time_zone = ' . $pdo->quote(DB_TIMEZONE));
    }

    return $pdo;
}

function db_is_postgres()
{
    return DB_DRIVER === 'pgsql';
}

function db_insert_id($pdo, $sql, $params = [])
{
    if (db_is_postgres()) {
        $stmt = $pdo->prepare(rtrim($sql) . ' RETURNING id');
        $stmt->execute($params);
        return (int) $stmt->fetchColumn();
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (int) $pdo->lastInsertId();
}

function db_group_concat($expression, $orderBy, $separator = ', ')
{
    if (db_is_postgres()) {
        return 'string_agg((' . $expression . ')::text, ' . db()->quote($separator) . ' ORDER BY ' . $orderBy . ')';
    }
    return 'GROUP_CONCAT(' . $expression . ' ORDER BY ' . $orderBy . ' SEPARATOR ' . db()->quote($separator) . ')';
}
