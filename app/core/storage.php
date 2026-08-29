<?php

require_once __DIR__ . '/../config/database.php';

function clinic_storage_driver()
{
    $configured = strtolower((string) clinic_env('CLINIC_STORAGE_DRIVER', ''));
    if ($configured !== '') {
        return $configured;
    }
    return SUPABASE_URL !== '' && SUPABASE_SERVICE_ROLE_KEY !== '' ? 'supabase' : 'local';
}

function clinic_storage_is_supabase()
{
    return clinic_storage_driver() === 'supabase';
}

function clinic_storage_require_config()
{
    if (SUPABASE_URL === '' || SUPABASE_SERVICE_ROLE_KEY === '' || SUPABASE_STORAGE_BUCKET === '') {
        throw new RuntimeException('Supabase Storage is not fully configured.');
    }
}

function clinic_storage_path_url($path)
{
    return implode('/', array_map('rawurlencode', array_filter(explode('/', trim((string) $path, '/')), 'strlen')));
}

function clinic_storage_request($method, $endpoint, $body = null)
{
    clinic_storage_require_config();
    $curl = curl_init(SUPABASE_URL . '/storage/v1' . $endpoint);
    $headers = [
        'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY,
        'apikey: ' . SUPABASE_SERVICE_ROLE_KEY,
        'Accept: application/json',
    ];
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body, JSON_UNESCAPED_SLASHES),
    ]);
    $raw = curl_exec($curl);
    if ($raw === false) {
        $message = curl_error($curl);
        curl_close($curl);
        throw new RuntimeException('Supabase Storage request failed: ' . $message);
    }
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    $decoded = json_decode($raw, true);
    if ($status < 200 || $status >= 300) {
        $message = is_array($decoded) ? ($decoded['message'] ?? $decoded['error'] ?? 'Storage request failed.') : 'Storage request failed.';
        throw new RuntimeException((string) $message);
    }
    return is_array($decoded) ? $decoded : [];
}

function clinic_storage_signature($path, $name, $mime, $size, $expiresAt)
{
    return hash_hmac('sha256', implode('|', [$path, $name, $mime, (int) $size, (int) $expiresAt]), SUPABASE_SERVICE_ROLE_KEY);
}

function clinic_storage_prepare_uploads($files, $actor)
{
    if (!clinic_storage_is_supabase()) {
        return [];
    }
    $allowed = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!is_array($files) || count($files) > 5) {
        throw new InvalidArgumentException('Attach no more than five files per request.');
    }
    $total = array_sum(array_map(function ($file) { return (int) ($file['size'] ?? 0); }, $files));
    if ($total > 25 * 1024 * 1024) {
        throw new InvalidArgumentException('The total attachment size cannot exceed 25 MB.');
    }
    $uploads = [];
    foreach ($files as $file) {
        $name = trim((string) ($file['name'] ?? ''));
        $mime = trim((string) ($file['type'] ?? ''));
        $size = (int) ($file['size'] ?? 0);
        if ($name === '' || !isset($allowed[$mime]) || $size <= 0 || $size > 10 * 1024 * 1024) {
            throw new InvalidArgumentException('Attachments must be PDF, JPG, PNG, or WEBP files up to 10 MB.');
        }
        $path = 'results/' . (int) $actor['id'] . '/' . date('Y/m') . '/' . bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
        $endpoint = '/object/upload/sign/' . rawurlencode(SUPABASE_STORAGE_BUCKET) . '/' . clinic_storage_path_url($path);
        $response = clinic_storage_request('POST', $endpoint, []);
        $relativeUrl = (string) ($response['url'] ?? $response['signedURL'] ?? '');
        if ($relativeUrl === '') {
            throw new RuntimeException('Supabase Storage did not return a signed upload URL.');
        }
        $signedUrl = str_starts_with($relativeUrl, 'http') ? $relativeUrl : SUPABASE_URL . '/storage/v1' . $relativeUrl;
        $expiresAt = time() + 7200;
        $uploads[] = [
            'name' => $name,
            'type' => $mime,
            'size' => $size,
            'storagePath' => $path,
            'uploadUrl' => $signedUrl,
            'expiresAt' => $expiresAt,
            'signature' => clinic_storage_signature($path, $name, $mime, $size, $expiresAt),
        ];
    }
    return $uploads;
}

function clinic_storage_verify_metadata($file)
{
    $path = trim((string) ($file['storagePath'] ?? ''));
    $name = trim((string) ($file['name'] ?? ''));
    $mime = trim((string) ($file['type'] ?? ''));
    $size = (int) ($file['size'] ?? 0);
    $expiresAt = (int) ($file['expiresAt'] ?? 0);
    $signature = (string) ($file['signature'] ?? '');
    return $path !== '' && $signature !== '' && $expiresAt >= time()
        && hash_equals(clinic_storage_signature($path, $name, $mime, $size, $expiresAt), $signature);
}

function clinic_storage_signed_download_url($path, $downloadName)
{
    $endpoint = '/object/sign/' . rawurlencode(SUPABASE_STORAGE_BUCKET) . '/' . clinic_storage_path_url($path);
    $response = clinic_storage_request('POST', $endpoint, ['expiresIn' => 60]);
    $relativeUrl = (string) ($response['signedURL'] ?? $response['signedUrl'] ?? '');
    if ($relativeUrl === '') {
        throw new RuntimeException('Supabase Storage did not return a signed download URL.');
    }
    $url = str_starts_with($relativeUrl, 'http') ? $relativeUrl : SUPABASE_URL . '/storage/v1' . $relativeUrl;
    return $url . (str_contains($url, '?') ? '&' : '?') . 'download=' . rawurlencode($downloadName);
}
