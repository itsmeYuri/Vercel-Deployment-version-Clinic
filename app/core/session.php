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

function clinic_session_unavailable(Throwable $error)
{
    error_log('Database session initialization failed: ' . $error->getMessage());
    http_response_code(503);
    header('Cache-Control: no-store, private');
    $path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (preg_match('~^/api(?:/|$)~', $path)) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'ok' => false,
            'message' => 'Sign-in is temporarily unavailable. Please contact the administrator.',
            'data' => [],
            'errors' => new stdClass(),
        ], JSON_UNESCAPED_SLASHES);
    } else {
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Sign-in is temporarily unavailable. Please contact the administrator.';
    }
    exit;
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
    $validToken = (bool) preg_match('/^[a-f0-9]{64}$/', $token);
    if (!$validToken) {
        $token = bin2hex(random_bytes(32));
    }
    try {
        $row = null;
        if ($validToken) {
            $stmt = db()->prepare('SELECT user_id, csrf_token, mfa_verified, pending_mfa_user_id, pending_mfa_expires_at, oauth_flow, recent_auth_at, auth_notice FROM auth_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP LIMIT 1');
            $stmt->execute([hash('sha256', $token)]);
            $row = $stmt->fetch() ?: null;
        }
    } catch (PDOException $error) {
        clinic_session_unavailable($error);
    }
    if ($row) {
        if ($row['user_id'] !== null) {
            $_SESSION['user_id'] = (int) $row['user_id'];
        }
        if (!empty($row['mfa_verified'])) {
            $_SESSION['mfa_verified'] = true;
        }
        if ($row['pending_mfa_user_id'] !== null && strtotime((string) $row['pending_mfa_expires_at']) > time()) {
            $_SESSION['pending_mfa_user_id'] = (int) $row['pending_mfa_user_id'];
            $_SESSION['pending_mfa_expires_at'] = strtotime((string) $row['pending_mfa_expires_at']);
        }
        if (!empty($row['oauth_flow'])) {
            $_SESSION['oauth_flow'] = json_decode($row['oauth_flow'], true);
        }
        if (!empty($row['recent_auth_at'])) {
            $_SESSION['recent_auth_at'] = strtotime((string) $row['recent_auth_at']);
        }
        if (!empty($row['auth_notice'])) {
            $_SESSION['auth_notice'] = $row['auth_notice'];
        }
        $_SESSION['csrf_token'] = $row['csrf_token'];
    } else {
        if ($validToken) {
            $token = bin2hex(random_bytes(32));
        }
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
        $expiresAt = db_is_postgres() ? date('Y-m-d H:i:sP', time() + CLINIC_SESSION_TTL) : date('Y-m-d H:i:s', time() + CLINIC_SESSION_TTL);
        $verified = !empty($_SESSION['mfa_verified']) ? 1 : 0;
        $pendingId = isset($_SESSION['pending_mfa_user_id']) ? (int) $_SESSION['pending_mfa_user_id'] : null;
        $pendingExpiry = $pendingId ? (db_is_postgres() ? date('Y-m-d H:i:sP', (int) $_SESSION['pending_mfa_expires_at']) : date('Y-m-d H:i:s', (int) $_SESSION['pending_mfa_expires_at'])) : null;
        $oauthFlow = !empty($_SESSION['oauth_flow']) ? json_encode($_SESSION['oauth_flow']) : null;
        $recentAuth = !empty($_SESSION['recent_auth_at']) ? (db_is_postgres() ? date('Y-m-d H:i:sP', (int) $_SESSION['recent_auth_at']) : date('Y-m-d H:i:s', (int) $_SESSION['recent_auth_at'])) : null;
        $authNotice = isset($_SESSION['auth_notice']) ? mb_substr((string) $_SESSION['auth_notice'], 0, 255) : null;
        $sql = db_is_postgres()
            ? 'INSERT INTO auth_sessions (token_hash, user_id, csrf_token, expires_at, mfa_verified, pending_mfa_user_id, pending_mfa_expires_at, oauth_flow, recent_auth_at, auth_notice, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT (token_hash) DO UPDATE SET user_id=EXCLUDED.user_id, csrf_token=EXCLUDED.csrf_token,
                   expires_at=EXCLUDED.expires_at, mfa_verified=EXCLUDED.mfa_verified,
                   pending_mfa_user_id=EXCLUDED.pending_mfa_user_id, pending_mfa_expires_at=EXCLUDED.pending_mfa_expires_at,
                   oauth_flow=EXCLUDED.oauth_flow, recent_auth_at=EXCLUDED.recent_auth_at,
                   auth_notice=EXCLUDED.auth_notice,
                   updated_at=CURRENT_TIMESTAMP'
            : 'INSERT INTO auth_sessions (token_hash, user_id, csrf_token, expires_at, mfa_verified, pending_mfa_user_id, pending_mfa_expires_at, oauth_flow, recent_auth_at, auth_notice, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), csrf_token=VALUES(csrf_token),
                   expires_at=VALUES(expires_at), mfa_verified=VALUES(mfa_verified),
                   pending_mfa_user_id=VALUES(pending_mfa_user_id), pending_mfa_expires_at=VALUES(pending_mfa_expires_at),
                   oauth_flow=VALUES(oauth_flow), recent_auth_at=VALUES(recent_auth_at),
                   auth_notice=VALUES(auth_notice),
                   updated_at=CURRENT_TIMESTAMP';
        $stmt = db()->prepare($sql);
        $stmt->execute([$tokenHash, $userId, $csrf, $expiresAt, $verified, $pendingId, $pendingExpiry, $oauthFlow, $recentAuth, $authNotice]);
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
