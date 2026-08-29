<?php

// Vercel sends all non-asset page requests here. Only the existing public PHP
// entry points are includable; application/configuration files can never be served.
$projectRoot = dirname(__DIR__);
$publicRoot = realpath($projectRoot . '/public');
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));

if ($path === '/' || $path === '') {
    require $projectRoot . '/index.php';
    exit;
}

$relative = ltrim(str_replace('\\', '/', $path), '/');
if (!str_starts_with($relative, 'public/') || !str_ends_with(strtolower($relative), '.php')) {
    http_response_code(404);
    echo 'Page not found.';
    exit;
}

$target = realpath($projectRoot . '/' . $relative);
if ($target === false || $publicRoot === false || !str_starts_with($target, $publicRoot . DIRECTORY_SEPARATOR)) {
    http_response_code(404);
    echo 'Page not found.';
    exit;
}

// Preserve the original page identity for redirects, role middleware, and
// maintenance-page matching after Vercel's internal rewrite.
$_SERVER['SCRIPT_NAME'] = '/' . $relative;
$_SERVER['PHP_SELF'] = '/' . $relative;
require $target;
