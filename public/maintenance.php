<?php
require_once __DIR__ . '/../app/config/database.php';
require_once __DIR__ . '/../app/core/helpers.php';
require_once __DIR__ . '/../app/core/maintenance.php';
require_once __DIR__ . '/../app/core/auth.php';

$assetBase = 'assets';
$pageTitle = 'System Under Maintenance | Centralized Laboratory Results System';
$pageDescription = 'The laboratory results system is temporarily under maintenance.';
$bodyClass = 'maintenance-public-page';
clinic_start_session();

try {
    $settings = clinic_maintenance_current(db());
} catch (Throwable $e) {
    $settings = clinic_maintenance_empty_settings();
}

$message = $settings['message'] ?: CLINIC_MAINTENANCE_DEFAULT_MESSAGE;
$reason = $settings['reason'] ?? null;
$endAt = $settings['end_at'] ?? null;
$isSignedIn = !empty($_SESSION['user_id']);
$actionUrl = $isSignedIn ? clinic_public_url('auth/logout.php') : clinic_public_url('auth/login.php#login');
$actionText = $isSignedIn ? 'Logout' : 'Back to Login';

require __DIR__ . '/../app/views/layouts/header.php';
?>
    <main class="maintenance-shell">
      <section class="maintenance-card-public" aria-labelledby="maintenance-title">
        <a class="admin-brand maintenance-brand" href="<?= e(clinic_public_url('auth/login.php#login')) ?>">
          <span class="admin-brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8V2Z"/></svg></span>
          <span><strong>Centralized Laboratory Results System</strong><small>System notice</small></span>
        </a>
        <div class="maintenance-public-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M9 15h6"/></svg>
        </div>
        <p class="eyebrow">Maintenance Mode</p>
        <h1 id="maintenance-title">System Under Maintenance</h1>
        <p class="maintenance-public-message"><?= e($message) ?></p>
        <p class="maintenance-public-detail">Thank you for your patience.</p>
        <?php if ($reason): ?>
          <p class="maintenance-public-detail"><strong>Reason:</strong> <?= e($reason) ?></p>
        <?php endif; ?>
        <?php if ($endAt): ?>
          <p class="maintenance-public-detail"><strong>Expected end:</strong> <?= e(date('M j, Y g:i A', strtotime($endAt))) ?></p>
        <?php endif; ?>
        <a class="btn btn-primary maintenance-public-action" href="<?= e($actionUrl) ?>"><?= e($actionText) ?></a>
      </section>
    </main>
<?php require __DIR__ . '/../app/views/layouts/footer.php'; ?>
