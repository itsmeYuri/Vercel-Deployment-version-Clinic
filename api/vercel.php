<?php

$projectRoot = dirname(__DIR__);
$publicRoot = realpath($projectRoot . '/public');
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));

if ($path === '/' || $path === '') {
    header('Location: /auth/login.php#login', true, 302);
    exit;
}

$relative = ltrim(str_replace('\\', '/', $path), '/');
if (str_starts_with($relative, 'public/')) {
    $cleanPath = '/' . substr($relative, 7);
    $query = (string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_QUERY);
    header('Location: ' . $cleanPath . ($query !== '' ? '?' . $query : ''), true, 308);
    exit;
}

if (!str_ends_with(strtolower($relative), '.php')) {
    http_response_code(404);
    echo 'Page not found.';
    exit;
}

$target = realpath($publicRoot . '/' . $relative);
if ($target === false || $publicRoot === false || !str_starts_with($target, $publicRoot . DIRECTORY_SEPARATOR)) {
    http_response_code(404);
    echo 'Page not found.';
    exit;
}

$_SERVER['SCRIPT_NAME'] = '/' . $relative;
$_SERVER['PHP_SELF'] = '/' . $relative;
require $target;
