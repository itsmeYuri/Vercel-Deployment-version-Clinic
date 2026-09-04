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
    <script src="<?= e($assetBase) ?>/js/lab-result-scanner.js?v=<?= e((string) filemtime(__DIR__ . '/../../../public/assets/js/lab-result-scanner.js')) ?>"></script>
    <script src="<?= e($assetBase) ?>/js/lab-utilization-analytics.js?v=<?= e((string) filemtime(__DIR__ . '/../../../public/assets/js/lab-utilization-analytics.js')) ?>"></script>
    <script src="<?= e($assetBase) ?>/js/lab-forecasting-analysis.js?v=<?= e((string) filemtime(__DIR__ . '/../../../public/assets/js/lab-forecasting-analysis.js')) ?>"></script>
    <script src="<?= e($assetBase) ?>/js/main.js?v=<?= e((string) filemtime(__DIR__ . '/../../../public/assets/js/main.js')) ?>"></script>
  </body>
</html>
