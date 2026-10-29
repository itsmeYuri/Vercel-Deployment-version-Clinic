<?php

// Keep local credentials and server-side project files out of the PHP dev server.
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH));
$path = str_replace('\\', '/', $path);
if ($path === '/api' || $path === '/api/' || $path === '/api/index.php') {
    require __DIR__ . '/api/index.php';
    return true;
}
if (preg_match('~(?:^|/)\.[^/]+|^/(?:app|database|tests|tmp|vendor|Main-Clinic-system)(?:/|$)|^/(?:composer\.(?:json|lock)|AUTHENTICATION_SETUP\.md|local-router\.php)$~i', $path)) {
    http_response_code(404);
    exit;
}

return false;
