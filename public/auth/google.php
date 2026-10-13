<?php

require_once __DIR__ . '/../../app/core/auth.php';
require_once __DIR__ . '/../../app/core/google.php';
require_once __DIR__ . '/../../vendor/autoload.php';

clinic_start_session();
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');

function clinic_google_fail($message)
{
    unset($_SESSION['oauth_flow']);
    $_SESSION['auth_notice'] = $message;
    clinic_redirect('auth/login.php#login');
}

function clinic_google_client($state = null, $verifier = null)
{
    $clientId = (string) clinic_env('CLINIC_GOOGLE_CLIENT_ID', '');
    $clientSecret = (string) clinic_env('CLINIC_GOOGLE_CLIENT_SECRET', '');
    $redirect = (string) clinic_env('CLINIC_GOOGLE_REDIRECT_URI', '');
    if ($clientId === '' || $clientSecret === '' || $redirect === '') {
        throw new RuntimeException('Google Sign-In is not configured.');
    }
    return new Google\Auth\OAuth2([
        'authorizationUri' => 'https://accounts.google.com/o/oauth2/v2/auth',
        'tokenCredentialUri' => 'https://oauth2.googleapis.com/token',
        'clientId' => $clientId,
        'clientSecret' => $clientSecret,
        'redirectUri' => $redirect,
        'scope' => 'openid email profile',
        'state' => $state,
        'codeVerifier' => $verifier,
    ]);
}

try {
    $pdo = db();
    if (!isset($_GET['code']) && !isset($_GET['error'])) {
        $mode = ($_GET['mode'] ?? '') === 'link' ? 'link' : 'login';
        $linkUserId = null;
        if ($mode === 'link') {
            if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') clinic_google_fail('Use the account security page to link Google.');
            $user = clinic_current_user();
            if (!$user) clinic_google_fail('Sign in before linking Google.');
            if ((int) ($_SESSION['recent_auth_at'] ?? 0) < time() - 300) clinic_google_fail('Sign in again before linking Google.');
            $csrf = (string) ($_POST['csrf_token'] ?? '');
            if ($csrf === '' || !hash_equals((string) $_SESSION['csrf_token'], $csrf)) clinic_google_fail('Security token expired. Try again.');
            $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id=?');
            $stmt->execute([$user['id']]);
            $row = $stmt->fetch();
            if (!$row || !password_verify((string) ($_POST['password'] ?? ''), $row['password_hash'])) clinic_google_fail('Current password is incorrect.');
            $linkUserId = $user['id'];
        }
        $state = bin2hex(random_bytes(32));
        $nonce = bin2hex(random_bytes(32));
        $client = clinic_google_client($state);
        $verifier = $client->generateCodeVerifier();
        $_SESSION['oauth_flow'] = [
            'state' => $state,
            'nonce' => $nonce,
            'verifier' => $verifier,
            'expires' => time() + 300,
            'mode' => $mode,
            'link_user_id' => $linkUserId,
        ];
        header('Location: ' . (string) $client->buildFullAuthorizationUri(['nonce' => $nonce, 'access_type' => 'online']), true, 302);
        exit;
    }

    $flow = $_SESSION['oauth_flow'] ?? null;
    unset($_SESSION['oauth_flow']);
    if (!is_array($flow) || (int) ($flow['expires'] ?? 0) < time()
        || !hash_equals((string) ($flow['state'] ?? ''), (string) ($_GET['state'] ?? ''))) {
        clinic_google_fail('Google sign-in expired. Try again.');
    }
    if (isset($_GET['error'])) clinic_google_fail('Google sign-in was cancelled or declined.');
    $code = (string) ($_GET['code'] ?? '');
    if ($code === '') clinic_google_fail('Google did not return an authorization code.');
    $client = clinic_google_client(null, $flow['verifier']);
    $client->setCode($code);
    $tokens = $client->fetchAuthToken();
    if (empty($tokens['id_token'])) clinic_google_fail('Google did not return a verified identity.');
    $claims = (new Google\Auth\AccessToken())->verify($tokens['id_token'], [
        'audience' => (string) clinic_env('CLINIC_GOOGLE_CLIENT_ID'),
    ]);
    $identityClaims = clinic_google_identity_from_claims($claims, (string) $flow['nonce'], (string) clinic_env('CLINIC_GOOGLE_CLIENT_ID'));
    if (!$identityClaims) {
        clinic_google_fail('Google identity verification failed.');
    }
    $subject = $identityClaims['subject'];
    $email = $identityClaims['email'];
    $stmt = $pdo->prepare('SELECT user_id FROM user_google_identities WHERE issuer=? AND subject=?');
    $stmt->execute(['https://accounts.google.com', $subject]);
    $identity = $stmt->fetch();

    if ($flow['mode'] === 'link') {
        $userId = (int) $flow['link_user_id'];
        if (!$userId || (int) ($_SESSION['user_id'] ?? 0) !== $userId || !clinic_current_user()) clinic_google_fail('Sign in again before linking Google.');
        if ($identity && (int) $identity['user_id'] !== $userId) clinic_google_fail('This Google account is already linked elsewhere.');
        if (!$identity) {
            $pdo->prepare('INSERT INTO user_google_identities (issuer, subject, user_id) VALUES (?, ?, ?)')->execute(['https://accounts.google.com', $subject, $userId]);
        }
        $_SESSION['auth_notice'] = 'Google account linked.';
        clinic_redirect(clinic_role_home_path(clinic_current_user()['role']));
    }

    $newGoogleAccount = false;
    if ($identity) {
        $userId = (int) $identity['user_id'];
    } else {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(email)=? LIMIT 1');
        $stmt->execute([$email]);
        if ($stmt->fetch()) clinic_google_fail('An account already uses this email. Sign in with your password, then link Google in Security settings.');
        $name = $identityClaims['name'];
        $username = 'google_' . bin2hex(random_bytes(8));
        $patientCode = 'PT-' . strtoupper(bin2hex(random_bytes(6)));
        $pdo->beginTransaction();
        $role = $pdo->query("SELECT id FROM roles WHERE name='Patient' LIMIT 1")->fetch();
        if (!$role) throw new RuntimeException('Patient role is not configured.');
        $stmt = $pdo->prepare('INSERT INTO users (role_id, name, email, username, password_hash, avatar, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([(int) $role['id'], $name, $email, $username, password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT), strtoupper(substr($name, 0, 1)), 'Active']);
        $userId = (int) $pdo->lastInsertId();
        if (db_is_postgres()) {
            $userId = (int) $pdo->query('SELECT lastval()')->fetchColumn();
        }
        $pdo->prepare('INSERT INTO patients (user_id, patient_code, privacy_acknowledged) VALUES (?, ?, 0)')->execute([$userId, $patientCode]);
        $pdo->prepare('INSERT INTO user_google_identities (issuer, subject, user_id) VALUES (?, ?, ?)')->execute(['https://accounts.google.com', $subject, $userId]);
        $pdo->commit();
        $newGoogleAccount = true;
    }
    $user = clinic_fetch_user($userId);
    if (!$user) clinic_google_fail('Your account is unavailable.');
    clinic_regenerate_session();
    unset($_SESSION['user_id'], $_SESSION['mfa_verified'], $_SESSION['pending_mfa_user_id'], $_SESSION['pending_mfa_expires_at']);
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $_SESSION['recent_auth_at'] = time();
    if (clinic_mfa_enabled($pdo, $userId)) {
        $_SESSION['pending_mfa_user_id'] = $userId;
        $_SESSION['pending_mfa_expires_at'] = time() + 300;
        clinic_redirect('auth/login.php#mfa');
    }
    $_SESSION['user_id'] = $userId;
    if ($newGoogleAccount) clinic_redirect('auth/security.php#password-section');
    clinic_redirect(clinic_role_home_path($user['role']));
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Google sign-in error: ' . $error->getMessage());
    clinic_google_fail('Google sign-in could not be completed. Check the setup and try again.');
}
