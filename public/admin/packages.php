<?php
require_once __DIR__ . '/../../app/core/auth.php';
require_once __DIR__ . '/../../app/core/lab-packages.php';

$admin = clinic_require_role('Admin');
$pdo = db();
$error = '';
$saved = isset($_GET['saved']);
$schemaReady = true;
try {
    $pdo->query('SELECT id FROM lab_packages LIMIT 1');
} catch (PDOException $exception) {
    $schemaReady = false;
}
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals(clinic_csrf_token(), (string) ($_POST['csrf_token'] ?? ''))) {
        http_response_code(403);
        $error = 'Your session expired. Reload this page and try again.';
    } elseif (!$schemaReady) {
        $error = 'The package tables have not been installed yet.';
    } else {
        try {
            clinic_save_lab_package($pdo, $_POST, $admin);
            header('Location: ' . clinic_public_url('admin/packages.php?saved=1'), true, 303);
            exit;
        } catch (InvalidArgumentException $exception) {
            $error = $exception->getMessage();
        } catch (Throwable $exception) {
            error_log('Saving lab package failed: ' . $exception->getMessage());
            $error = 'The package could not be saved. Please try again.';
        }
    }
}
$tests = $pdo->query("SELECT id, name, code, status FROM test_definitions ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);
$packages = $schemaReady ? clinic_lab_packages($pdo) : [];
$assetBase = clinic_asset_base('../assets');
$dashboardUrl = clinic_public_url('admin/dashboard.php#dashboard');
ob_start();
?>
<div class="packages-page"><div class="page-heading"><div><h1>Laboratory packages</h1><p>Compose test bundles for the public landing page. Drafts stay private until published.</p></div></div>
<?php if (!$schemaReady): ?><div class="notice error" role="alert">Package tables are missing. Run <code>database/migrations/20261029_lab_packages.sql</code> in Supabase SQL Editor, then reload this page.</div><?php endif; ?>
<?php if ($error): ?><div class="notice error" role="alert"><?= e($error) ?></div><?php elseif ($saved): ?><div class="notice success" role="status">Package saved. Published packages appear on the landing page.</div><?php endif; ?>
<div class="package-admin-layout"><section aria-labelledby="editor-heading" class="editor-panel"><div class="panel-title"><h2 id="editor-heading">Create a package</h2><p>Enter the offer exactly as visitors should see it.</p></div><form method="post" class="package-form"><input type="hidden" name="csrf_token" value="<?= e(clinic_csrf_token()) ?>"><label>Package name<input type="text" name="name" maxlength="160" required placeholder="e.g. Wellness screening"></label><label>Description<textarea name="description" maxlength="1500" rows="3" placeholder="Describe what this bundle includes"></textarea></label><div class="form-pair"><label>Package price (PHP)<input name="price" type="number" min="0" max="99999999.99" step="0.01" required placeholder="0.00"></label><label>Display order<input name="display_order" type="number" min="0" max="9999" value="0" required></label></div><fieldset><legend>Included tests</legend><p>Select tests from the existing laboratory catalogue.</p><div class="test-options"><?php foreach ($tests as $test): ?><label><input type="checkbox" name="test_ids[]" value="<?= (int) $test['id'] ?>" <?= $test['status'] !== 'Active' ? 'disabled' : '' ?>><span><?= e($test['name']) ?><small><?= e($test['code']) ?><?= $test['status'] !== 'Active' ? ' · Inactive' : '' ?></small></span></label><?php endforeach; ?></div></fieldset><label>Visibility<select name="status"><option value="Draft">Draft — private</option><option value="Published">Published — public</option></select></label><button class="save-button" type="submit" <?= !$schemaReady ? 'disabled' : '' ?>>Save package</button></form></section>
<section aria-labelledby="existing-heading" class="existing-panel"><div class="panel-title"><h2 id="existing-heading">Existing packages</h2><p><?= count($packages) ?> package<?= count($packages) === 1 ? '' : 's' ?> in the catalogue</p></div><?php if (!$packages): ?><div class="empty-packages">No packages yet. Create the first bundle using the form.</div><?php endif; ?><?php foreach ($packages as $package): ?><details class="existing-package"><summary><span class="package-summary-copy"><strong><?= e($package['name']) ?></strong><small><?= count($package['tests']) ?> tests · PHP <?= e(number_format($package['price'], 2)) ?></small></span><em class="<?= $package['status'] === 'Published' ? 'published' : '' ?>"><?= e($package['status']) ?></em><svg class="disclosure-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><form method="post" class="package-form"><input type="hidden" name="csrf_token" value="<?= e(clinic_csrf_token()) ?>"><input type="hidden" name="id" value="<?= $package['id'] ?>"><label>Package name<input type="text" name="name" maxlength="160" required value="<?= e($package['name']) ?>"></label><label>Description<textarea name="description" maxlength="1500" rows="3"><?= e($package['description']) ?></textarea></label><div class="form-pair"><label>Package price (PHP)<input name="price" type="number" min="0" max="99999999.99" step="0.01" required value="<?= e(number_format($package['price'], 2, '.', '')) ?>"></label><label>Display order<input name="display_order" type="number" min="0" max="9999" required value="<?= $package['displayOrder'] ?>"></label></div><fieldset><legend>Included tests</legend><div class="test-options"><?php $selected = array_column($package['tests'], 'id'); foreach ($tests as $test): ?><label><input type="checkbox" name="test_ids[]" value="<?= (int) $test['id'] ?>" <?= in_array((int) $test['id'], $selected, true) ? 'checked' : '' ?> <?= $test['status'] !== 'Active' ? 'disabled' : '' ?>><span><?= e($test['name']) ?><small><?= e($test['code']) ?><?= $test['status'] !== 'Active' ? ' · Inactive' : '' ?></small></span></label><?php endforeach; ?></div></fieldset><label>Visibility<select name="status"><option value="Draft" <?= $package['status'] === 'Draft' ? 'selected' : '' ?>>Draft — private</option><option value="Published" <?= $package['status'] === 'Published' ? 'selected' : '' ?>>Published — public</option></select></label><button class="save-button" type="submit">Save changes</button></form></details><?php endforeach; ?></section></div></div>

<?php
$serverPageContent = ob_get_clean();
$requiredRole = 'Admin';
$initialPage = 'packages';
$pageTitle = 'Laboratory Packages | ' . clinic_app_name();
$pageStyles = ['packages-admin'];
require __DIR__ . '/../../app/views/pages/app-shell.php';
