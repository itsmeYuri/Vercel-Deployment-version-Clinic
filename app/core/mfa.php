<?php

require_once __DIR__ . '/../config/database.php';

function clinic_mfa_key()
{
    $encoded = (string) clinic_env('CLINIC_MFA_ENCRYPTION_KEY', '');
    $key = base64_decode($encoded, true);
    if ($key === false || strlen($key) !== 32) {
        throw new RuntimeException('CLINIC_MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    }
    return $key;
}

function clinic_mfa_encrypt($secret)
{
    $nonce = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($secret, 'aes-256-gcm', clinic_mfa_key(), OPENSSL_RAW_DATA, $nonce, $tag);
    if ($cipher === false) {
        throw new RuntimeException('Could not encrypt MFA secret.');
    }
    return base64_encode($nonce . $tag . $cipher);
}

function clinic_mfa_decrypt($encoded)
{
    $raw = base64_decode((string) $encoded, true);
    if ($raw === false || strlen($raw) < 29) {
        throw new RuntimeException('Invalid MFA secret.');
    }
    $secret = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', clinic_mfa_key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
    if ($secret === false) {
        throw new RuntimeException('Could not decrypt MFA secret.');
    }
    return $secret;
}

function clinic_mfa_base32_encode($bytes)
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = 0;
    $buffer = 0;
    $output = '';
    foreach (unpack('C*', $bytes) as $byte) {
        $buffer = ($buffer << 8) | $byte;
        $bits += 8;
        while ($bits >= 5) {
            $bits -= 5;
            $output .= $alphabet[($buffer >> $bits) & 31];
        }
    }
    if ($bits > 0) {
        $output .= $alphabet[($buffer << (5 - $bits)) & 31];
    }
    return $output;
}

function clinic_mfa_base32_decode($secret)
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = 0;
    $buffer = 0;
    $output = '';
    foreach (str_split(strtoupper(rtrim((string) $secret, '='))) as $char) {
        $value = strpos($alphabet, $char);
        if ($value === false) {
            throw new InvalidArgumentException('Invalid TOTP secret.');
        }
        $buffer = ($buffer << 5) | $value;
        $bits += 5;
        if ($bits >= 8) {
            $bits -= 8;
            $output .= chr(($buffer >> $bits) & 255);
        }
    }
    return $output;
}

function clinic_mfa_totp($secret, $step)
{
    $counter = pack('N2', intdiv($step, 4294967296), $step % 4294967296);
    $digest = hash_hmac('sha1', $counter, clinic_mfa_base32_decode($secret), true);
    $offset = ord($digest[19]) & 15;
    $number = unpack('N', substr($digest, $offset, 4))[1] & 0x7fffffff;
    return str_pad((string) ($number % 1000000), 6, '0', STR_PAD_LEFT);
}

function clinic_mfa_matching_step($secret, $code, $now = null)
{
    if (!preg_match('/^[0-9]{6}$/D', (string) $code)) {
        return null;
    }
    $current = intdiv($now ?? time(), 30);
    foreach ([$current - 1, $current, $current + 1] as $step) {
        if (hash_equals(clinic_mfa_totp($secret, $step), (string) $code)) {
            return $step;
        }
    }
    return null;
}

function clinic_mfa_record($pdo, $userId)
{
    $stmt = $pdo->prepare('SELECT * FROM user_mfa WHERE user_id = ? LIMIT 1');
    $stmt->execute([(int) $userId]);
    return $stmt->fetch() ?: null;
}

function clinic_mfa_enabled($pdo, $userId)
{
    $record = clinic_mfa_record($pdo, $userId);
    return $record && $record['enabled_at'] !== null;
}

function clinic_mfa_claim_step($pdo, $userId, $code)
{
    $record = clinic_mfa_record($pdo, $userId);
    if (!$record || $record['enabled_at'] === null) {
        return false;
    }
    $step = clinic_mfa_matching_step(clinic_mfa_decrypt($record['secret_ciphertext']), $code);
    if ($step === null) {
        return false;
    }
    $stmt = $pdo->prepare('UPDATE user_mfa SET last_accepted_step = ? WHERE user_id = ? AND enabled_at IS NOT NULL AND (last_accepted_step IS NULL OR last_accepted_step < ?)');
    $stmt->execute([$step, $userId, $step]);
    return $stmt->rowCount() === 1;
}

function clinic_mfa_recovery_codes($pdo, $userId)
{
    $pdo->prepare('DELETE FROM user_mfa_recovery WHERE user_id = ?')->execute([$userId]);
    $codes = [];
    $stmt = $pdo->prepare('INSERT INTO user_mfa_recovery (user_id, code_hash) VALUES (?, ?)');
    for ($i = 0; $i < 10; $i++) {
        $code = strtoupper(bin2hex(random_bytes(16)));
        $codes[] = $code;
        $stmt->execute([$userId, hash('sha256', $code)]);
    }
    return $codes;
}

function clinic_mfa_claim_recovery($pdo, $userId, $code)
{
    $code = strtoupper(str_replace('-', '', trim((string) $code)));
    if (!preg_match('/^[0-9A-F]{32}$/D', $code)) {
        return false;
    }
    $stmt = $pdo->prepare('DELETE FROM user_mfa_recovery WHERE user_id = ? AND code_hash = ?');
    $stmt->execute([$userId, hash('sha256', $code)]);
    return $stmt->rowCount() === 1;
}
