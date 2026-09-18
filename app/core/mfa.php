<?php

// Challenges live in the database so native and serverless sessions behave identically.
function clinic_mfa_schema($pdo)
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS auth_mfa_challenges (user_id INTEGER PRIMARY KEY, token_hash CHAR(64) NOT NULL UNIQUE, session_hash CHAR(64) NOT NULL, code_hash VARCHAR(255) NOT NULL, credential_hash CHAR(64) NOT NULL, email VARCHAR(255) NOT NULL, expires_epoch BIGINT NOT NULL, sent_epoch BIGINT NOT NULL, window_epoch BIGINT NOT NULL, sends INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)');
    if (db_is_postgres()) $pdo->exec('ALTER TABLE auth_mfa_challenges ENABLE ROW LEVEL SECURITY');
}

function clinic_send_login_code($email, $code)
{
    $key = defined('CLINIC_RESEND_API_KEY') ? CLINIC_RESEND_API_KEY : (string) clinic_env('RESEND_API_KEY', '');
    $from = defined('CLINIC_MAIL_FROM') ? CLINIC_MAIL_FROM : (string) clinic_env('CLINIC_MAIL_FROM', '');
    if (!$key || !filter_var($from, FILTER_VALIDATE_EMAIL) || !function_exists('curl_init')) {
        throw new RuntimeException('Email verification is not configured. Ask the administrator to configure RESEND_API_KEY and CLINIC_MAIL_FROM.');
    }
    $curl = curl_init('https://api.resend.com/emails');
    curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['from' => $from, 'to' => [$email],
            'subject' => 'Your CLIRMS sign-in code',
            'text' => "Your sign-in code is: $code\nIt expires in 5 minutes. Do not share this code. If you did not request it, ignore this email."])]);
    $response = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if ($status < 200 || $status >= 300 || !isset(json_decode((string) $response, true)['id'])) {
        throw new RuntimeException('The verification email could not be sent. Please try again later or contact the administrator.');
    }
}

function clinic_mfa_start($pdo, $user)
{
    clinic_mfa_schema($pdo);
    if (!filter_var($user['email'], FILTER_VALIDATE_EMAIL)) respond(false, 'Your account needs a valid email address. Contact the administrator.', [], 422);
    $pdo->beginTransaction();
    // Lock the account even when it does not yet have a challenge.
    $account = one($pdo, 'SELECT id, password_hash FROM users WHERE id=? FOR UPDATE', [$user['id']]);
    $old = one($pdo, 'SELECT * FROM auth_mfa_challenges WHERE user_id=?', [$user['id']]);
    $now = time();
    $sameWindow = $old && (int) $old['window_epoch'] > $now - 900;
    if ($old && ((int) $old['sent_epoch'] > $now - 60 || ($sameWindow && ((int) $old['sends'] >= 5 || (int) $old['attempts'] >= 5)))) {
        $pdo->rollBack();
        respond(false, 'Please wait before requesting another code. A maximum of five codes or failed attempts is allowed per 15 minutes.', [], 429);
    }
    $token = bin2hex(random_bytes(32));
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $pdo->prepare('DELETE FROM auth_mfa_challenges WHERE user_id=?')->execute([$user['id']]);
    $pdo->prepare('INSERT INTO auth_mfa_challenges (user_id,token_hash,session_hash,code_hash,credential_hash,email,expires_epoch,sent_epoch,window_epoch,sends,attempts) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([$user['id'], hash('sha256', $token), hash('sha256', $_SESSION['csrf_token']), password_hash($code, PASSWORD_DEFAULT), hash('sha256', $account['password_hash']), $user['email'], $now + 300, $now, $sameWindow ? $old['window_epoch'] : $now, $sameWindow ? (int) $old['sends'] + 1 : 1, $sameWindow ? (int) $old['attempts'] : 0]);
    try {
        clinic_send_login_code($user['email'], $code);
    } catch (RuntimeException $error) {
        $pdo->rollBack();
        respond(false, $error->getMessage(), [], 503);
    }
    $pdo->commit();
    unset($_SESSION['user_id']);
    [$local, $domain] = explode('@', $user['email'], 2);
    return ['mfaRequired' => true, 'challenge' => $token, 'destination' => substr($local, 0, 1) . '***@' . $domain, 'expiresIn' => 300, 'resendAfter' => 60];
}

function clinic_mfa_verify($pdo, $data)
{
    clinic_mfa_schema($pdo);
    $token = (string) ($data['challenge'] ?? '');
    $code = (string) ($data['code'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) respond(false, 'Start a new sign-in to request a code.', [], 401);
    $pdo->beginTransaction();
    $row = one($pdo, 'SELECT * FROM auth_mfa_challenges WHERE token_hash=? FOR UPDATE', [hash('sha256', $token)]);
    if (!$row || !hash_equals($row['session_hash'], hash('sha256', $_SESSION['csrf_token'])) || (int) $row['expires_epoch'] <= time() || (int) $row['attempts'] >= 5) {
        $pdo->rollBack();
        respond(false, 'This code has expired or is unavailable. Start a new sign-in.', [], 401);
    }
    if (!preg_match('/^\d{6}$/', $code) || !password_verify($code, $row['code_hash'])) {
        $pdo->prepare('UPDATE auth_mfa_challenges SET attempts=attempts+1 WHERE user_id=?')->execute([$row['user_id']]);
        $pdo->commit();
        respond(false, 'Incorrect verification code.', [], 401);
    }
    $user = fetch_user($pdo, (int) $row['user_id']);
    $credentials = one($pdo, 'SELECT password_hash FROM users WHERE id=?', [$row['user_id']]);
    if (!$user || $user['status'] !== 'Active' || $user['email'] !== $row['email'] || !hash_equals($row['credential_hash'], hash('sha256', $credentials['password_hash']))) {
        $pdo->rollBack();
        respond(false, 'This account changed. Start a new sign-in.', [], 401);
    }
    $pdo->prepare('DELETE FROM auth_mfa_challenges WHERE user_id=?')->execute([$row['user_id']]);
    audit_log($pdo, $user, 'LOGIN', 'Authentication', 'Password and email verification completed');
    $pdo->commit();
    clinic_regenerate_session();
    $_SESSION['user_id'] = $user['id'];
    respond(true, 'Verification successful.', ['user' => $user, 'csrfToken' => rotate_csrf_token()]);
}
