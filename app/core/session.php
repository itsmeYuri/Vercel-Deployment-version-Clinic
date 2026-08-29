<?php

require_once __DIR__ . '/../config/database.php';

function clinic_session_secure_cookie()
{
    $forwardedProto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || $forwardedProto === 'https'
        || filter_var(clinic_env('CLINIC_COOKIE_SECURE', clinic_env('VERCEL', '') !== '' ? '1' : '0'), FILTER_VALIDATE_BOOLEAN);
}

function clinic_session_cookie_options($expires = 0)
{
    return [
        'expires' => $expires,
        'path' => '/',
        'secure' => clinic_session_secure_cookie(),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

function clinic_start_session()
{
    static $started = false;
    if ($started) {
        return;
    }
    $started = true;

    if (CLINIC_SESSION_DRIVER !== 'database') {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            ini_set('session.use_strict_mode', '1');
            session_name('CLINIC_SYSTEM_V2');
            $cookieOptions = clinic_session_cookie_options();
            unset($cookieOptions['expires']);
            $cookieOptions['lifetime'] = 0;
            session_set_cookie_params($cookieOptions);
            session_start();
        }
        if (empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return;
    }

    $_SESSION = [];
    $token = (string) ($_COOKIE['CLINIC_SESSION'] ?? '');
    $row = null;
    if (preg_match('/^[a-f0-9]{64}$/', $token)) {
        $stmt = db()->prepare('SELECT user_id, csrf_token FROM auth_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP LIMIT 1');
        $stmt->execute([hash('sha256', $token)]);
        $row = $stmt->fetch() ?: null;
    }
    if ($row) {
        if ($row['user_id'] !== null) {
            $_SESSION['user_id'] = (int) $row['user_id'];
        }
        $_SESSION['csrf_token'] = $row['csrf_token'];
    } else {
        $token = bin2hex(random_bytes(32));
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    $GLOBALS['clinicSessionToken'] = $token;
    setcookie('CLINIC_SESSION', $token, clinic_session_cookie_options(time() + CLINIC_SESSION_TTL));
    register_shutdown_function('clinic_persist_session');
}

function clinic_persist_session()
{
    if (CLINIC_SESSION_DRIVER !== 'database' || empty($GLOBALS['clinicSessionToken'])) {
        return;
    }
    try {
        $tokenHash = hash('sha256', $GLOBALS['clinicSessionToken']);
        $userId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
        $csrf = (string) ($_SESSION['csrf_token'] ?? bin2hex(random_bytes(32)));
        $expiresAt = date('Y-m-d H:i:sP', time() + CLINIC_SESSION_TTL);
        $sql = db_is_postgres()
            ? 'INSERT INTO auth_sessions (token_hash, user_id, csrf_token, expires_at, updated_at)
               VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT (token_hash) DO UPDATE SET user_id=EXCLUDED.user_id, csrf_token=EXCLUDED.csrf_token,
                   expires_at=EXCLUDED.expires_at, updated_at=CURRENT_TIMESTAMP'
            : 'INSERT INTO auth_sessions (token_hash, user_id, csrf_token, expires_at, updated_at)
               VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), csrf_token=VALUES(csrf_token),
                   expires_at=VALUES(expires_at), updated_at=CURRENT_TIMESTAMP';
        $stmt = db()->prepare($sql);
        $stmt->execute([$tokenHash, $userId, $csrf, $expiresAt]);
        if (random_int(1, 100) === 1) {
            db()->exec('DELETE FROM auth_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
        }
    } catch (Throwable $ignored) {
        // The request response must not be replaced by a shutdown-time session error.
    }
}

function clinic_regenerate_session()
{
    if (CLINIC_SESSION_DRIVER !== 'database') {
        session_regenerate_id(true);
        return;
    }
    $oldToken = (string) ($GLOBALS['clinicSessionToken'] ?? '');
    if ($oldToken !== '') {
        $stmt = db()->prepare('DELETE FROM auth_sessions WHERE token_hash = ?');
        $stmt->execute([hash('sha256', $oldToken)]);
    }
    $GLOBALS['clinicSessionToken'] = bin2hex(random_bytes(32));
    setcookie('CLINIC_SESSION', $GLOBALS['clinicSessionToken'], clinic_session_cookie_options(time() + CLINIC_SESSION_TTL));
}

function clinic_destroy_session()
{
    if (CLINIC_SESSION_DRIVER !== 'database') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', $params['secure'], $params['httponly']);
        }
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        return;
    }
    $token = (string) ($GLOBALS['clinicSessionToken'] ?? '');
    if ($token !== '') {
        $stmt = db()->prepare('DELETE FROM auth_sessions WHERE token_hash = ?');
        $stmt->execute([hash('sha256', $token)]);
    }
    $_SESSION = [];
    unset($GLOBALS['clinicSessionToken']);
    setcookie('CLINIC_SESSION', '', clinic_session_cookie_options(time() - 42000));
}
