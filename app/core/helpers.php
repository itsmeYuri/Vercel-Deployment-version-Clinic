<?php

function e($value)
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
}

function clinic_public_url($path = '')
{
    $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
    $publicPos = strpos($scriptDir, '/public');
    if ($publicPos !== false) {
        $base = substr($scriptDir, 0, $publicPos + 7);
    } else {
        $publicSubdirs = ['admin', 'doctor', 'laboratory', 'patient', 'auth', 'test-results'];
        $lastSegment = trim(basename($scriptDir), '/');
        $base = in_array($lastSegment, $publicSubdirs, true) ? dirname($scriptDir) : $scriptDir;
    }

    return rtrim($base, '/') . '/' . ltrim($path, '/');
}

function clinic_redirect($path)
{
    header('Location: ' . clinic_public_url($path));
    exit;
}
