<?php
$assetBase = rtrim($assetBase ?? 'assets', '/');
$apiUrl = $apiUrl ?? '../api/index.php';
$loginUrl = $loginUrl ?? 'auth/login.php#login';
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
    </script>
    <script src="<?= e($assetBase) ?>/js/main.js"></script>
  </body>
</html>

