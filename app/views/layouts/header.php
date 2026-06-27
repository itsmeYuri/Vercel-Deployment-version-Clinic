<?php
require_once __DIR__ . '/../../core/helpers.php';

$pageTitle = $pageTitle ?? 'Clinic Management System';
$pageDescription = $pageDescription ?? 'Secure Clinic Management System workspace';
$assetBase = rtrim($assetBase ?? 'assets', '/');
$bodyAttributes = $bodyAttributes ?? '';
$bodyClass = trim($bodyClass ?? '');
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="<?= e($pageDescription) ?>" />
    <title><?= e($pageTitle) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="<?= e($assetBase) ?>/css/styles.css" />
  </head>
  <body<?= $bodyClass !== '' ? ' class="' . e($bodyClass) . '"' : '' ?> <?= $bodyAttributes ?>>

