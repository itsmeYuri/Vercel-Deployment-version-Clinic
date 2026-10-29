<?php
$assetBase = rtrim($assetBase ?? 'assets', '/');
$apiUrl = $apiUrl ?? '../api/index.php';
$loginUrl = $loginUrl ?? 'auth/login.php#login';
$maintenanceUrl = $maintenanceUrl ?? 'maintenance.php';
$roleUrls = $roleUrls ?? [
    'Admin' => 'admin/dashboard.php#dashboard',
    'Doctor' => 'doctor/dashboard.php#dashboard',
    'Laboratory Staff' => 'laboratory/dashboard.php#dashboard',
    'Patient' => 'patient/dashboard.php#dashboard',
];
?>
    <script>
      window.CLINIC_API_URL = "<?= e($apiUrl) ?>";
      window.CLINIC_LOGIN_URL = "<?= e($loginUrl) ?>";
      window.CLINIC_ROLE_URLS = <?= json_encode($roleUrls, JSON_UNESCAPED_SLASHES) ?>;
      window.CLINIC_CSRF_TOKEN = <?= json_encode(clinic_csrf_token(), JSON_UNESCAPED_SLASHES) ?>;
      window.CLINIC_MAINTENANCE_URL = <?= json_encode($maintenanceUrl, JSON_UNESCAPED_SLASHES) ?>;
      window.CLINIC_ASSET_BASE = <?= json_encode($assetBase, JSON_UNESCAPED_SLASHES) ?>;
    </script>
    <?php
    // Auth and server-rendered pages do not use reporting or result-processing tools.
    $pageScripts = !empty($requiredRole) && !isset($serverPageContent)
        ? ['lab-result-scanner', 'lab-utilization-analytics', 'lab-forecasting-analysis', 'lab-trend-analysis', 'report-charts', 'patient-result-tools', 'main']
        : ['main'];
    foreach ($pageScripts as $scriptName): ?>
    <script defer src="<?= e($assetBase) ?>/js/<?= e($scriptName) ?>.js?v=<?= e(substr(hash_file('sha256', __DIR__ . '/../../../public/assets/js/' . $scriptName . '.js'), 0, 16)) ?>"></script>
    <?php endforeach; ?>
  </body>
</html>
