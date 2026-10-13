<?php

function clinic_google_created_account($pdo, $userId, $username)
{
    if (!preg_match('/^google_[a-f0-9]{16}$/', (string) $username)) {
        return false;
    }
    $stmt = $pdo->prepare('SELECT 1 FROM user_google_identities WHERE user_id = ? LIMIT 1');
    $stmt->execute([(int) $userId]);
    return (bool) $stmt->fetchColumn();
}

function clinic_google_identity_from_claims($claims, $expectedNonce, $clientId)
{
    if (!is_array($claims)
        || !in_array($claims['iss'] ?? '', ['https://accounts.google.com', 'accounts.google.com'], true)
        || ($claims['email_verified'] ?? false) !== true
        || !is_string($claims['sub'] ?? null) || $claims['sub'] === '' || strlen($claims['sub']) > 255
        || !is_string($claims['email'] ?? null) || strlen($claims['email']) > 160
        || !filter_var($claims['email'], FILTER_VALIDATE_EMAIL)
        || !is_string($claims['nonce'] ?? null) || !hash_equals($expectedNonce, $claims['nonce'])
        || (isset($claims['azp']) && $claims['azp'] !== $clientId)) {
        return null;
    }
    return [
        'issuer' => 'https://accounts.google.com',
        'subject' => $claims['sub'],
        'email' => strtolower($claims['email']),
        'name' => mb_substr(trim((string) ($claims['name'] ?? 'Google user')), 0, 120),
    ];
}
