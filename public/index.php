<?php
require_once __DIR__ . '/../app/core/auth.php';
require_once __DIR__ . '/../app/core/lab-packages.php';

$packages = [];
$catalogueUnavailable = false;
try {
    $packages = clinic_lab_packages(db(), true);
} catch (PDOException $error) {
    error_log('Public package catalogue unavailable: ' . $error->getCode());
    $catalogueUnavailable = true;
}
$assetBase = clinic_asset_base('assets');
$loginUrl = clinic_public_url('auth/login.php#login');
$name = clinic_app_name();
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Explore available laboratory test packages and access your laboratory results workspace.">
  <title><?= e($name) ?> | Laboratory services</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="<?= e($assetBase) ?>/css/landing.css?v=<?= e(substr(hash_file('sha256', __DIR__ . '/assets/css/landing.css'), 0, 16)) ?>">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="<?= e(clinic_public_url('index.php')) ?>" aria-label="<?= e($name) ?> home">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-name"><?= e($name) ?></span>
    </a>
    <nav aria-label="Main navigation">
      <a class="nav-packages" href="#packages">Laboratory packages</a>
      <a class="nav-signin" href="<?= e($loginUrl) ?>">Sign in <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></a>
    </nav>
  </header>
  <main id="main">
    <section class="hero" aria-labelledby="hero-title"><div class="hero-inner">
      <div class="hero-copy">
        <h1 id="hero-title">Laboratory services</h1>
        <p>Browse the clinic’s laboratory test packages. Sign in to follow your requests and view results once they’re released.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="<?= e($loginUrl) ?>">Sign in <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></a>
          <a class="button button-secondary" href="#packages">View packages</a>
        </div>
      </div>
      <div class="hero-main"><img class="hero-logo" src="<?= e($assetBase) ?>/img/gen-and-rics-logo.png" alt="<?= e($name) ?> logo" width="280" height="280"></div>
    </div></section>
    <section class="packages-section<?= $packages ? '' : ' is-empty' ?>" id="packages" aria-labelledby="packages-title">
      <div class="section-heading"><h2 id="packages-title">Laboratory packages</h2><p>See what each package includes and its published price. Ask the clinic about availability and preparation instructions.</p></div>
      <?php if ($packages): ?><div class="package-list">
        <?php foreach ($packages as $package): ?><article class="package-row"><div class="package-main"><h3><?= e($package['name']) ?></h3><p><?= e($package['description']) ?></p></div><div class="package-tests"><h4>Included tests</h4><ul><?php foreach ($package['tests'] as $test): ?><li><?= e($test['name']) ?></li><?php endforeach; ?></ul></div><div class="package-purchase"><span>Package price</span><strong>PHP <?= e(number_format($package['price'], 2)) ?></strong></div></article><?php endforeach; ?>
      </div><?php else: ?><div class="package-empty"><div><h3>Packages will appear here when published.</h3><p><?= $catalogueUnavailable ? 'Package details are temporarily unavailable. Please check back later.' : 'The clinic has not published any packages yet.' ?></p></div></div><?php endif; ?>
    </section>
  </main>
  <footer class="site-footer"><span>&copy; <?= date('Y') ?> <?= e($name) ?></span><span>Healthcare made simpler</span></footer>
</body>
</html>
