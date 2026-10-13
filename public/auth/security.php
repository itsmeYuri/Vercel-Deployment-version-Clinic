<?php
require_once __DIR__ . '/../../app/core/auth.php';
require_once __DIR__ . '/../../app/core/google.php';
$user = clinic_require_auth();
$securityTab = in_array($_GET['tab'] ?? '', ['password', 'authenticator', 'google'], true) ? $_GET['tab'] : 'authenticator';
if (($_GET['embed'] ?? '') !== '1') {
    $dashboard = explode('#', clinic_role_home_path($user['role']))[0];
    clinic_redirect($dashboard . '?security=' . $securityTab . '#settings');
}
$bodyClass = 'security-popup-content';
$googleIdentity = db()->prepare('SELECT 1 FROM user_google_identities WHERE user_id = ? LIMIT 1');
$googleIdentity->execute([$user['id']]);
$googleLinked = (bool) $googleIdentity->fetchColumn();
$googleCreated = $googleLinked && (bool) preg_match('/^google_[a-f0-9]{16}$/', (string) $user['username']);
$recentAuth = (int) ($_SESSION['recent_auth_at'] ?? 0) >= time() - 300;
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
$pageTitle = 'Account security | ' . clinic_app_name();
$pageDescription = 'Manage account sign-in security.';
$assetBase = clinic_asset_base('../assets');
$apiUrl = clinic_api_url();
$loginUrl = clinic_public_url('auth/login.php#login');
require __DIR__ . '/../../app/views/layouts/header.php';
?>
<main class="auth-shell account-security-shell">
  <section class="form-panel account-security-panel">
    <div class="form-card account-security-card">
      <nav class="security-tabs" aria-label="Account security settings">
        <button type="button" data-security-tab="password">Password</button>
        <button type="button" data-security-tab="authenticator">Authenticator</button>
        <button type="button" data-security-tab="google">Google sign-in</button>
      </nav>
      <div class="status-message" id="security-status" role="status" aria-live="polite"></div>
      <div data-security-panel="password"><section id="password-section">
        <h2><?= $googleCreated ? 'Set an account password' : 'Change password' ?></h2>
        <p><?= $googleCreated ? 'Create a password for email sign-in. Your recent Google sign-in confirms this change.' : 'Use your current password to choose a new one.' ?></p>
        <?php if ($googleCreated && !$recentAuth): ?><p class="security-hint">For your security, sign out and sign in with Google again before setting a password.</p><?php endif; ?>
        <form id="security-password-form">
          <?php if (!$googleCreated): ?><div class="field"><label for="security-current-password">Current password</label><div class="input-wrap"><input id="security-current-password" type="password" autocomplete="current-password" required></div></div><?php endif; ?>
          <div class="field"><label for="security-new-password">New password</label><div class="input-wrap"><input id="security-new-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div><small>Use 12–128 characters, including a letter and a number.</small></div>
          <div class="field"><label for="security-confirm-password">Confirm new password</label><div class="input-wrap"><input id="security-confirm-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></div></div>
          <button class="primary-button" type="submit"><?= $googleCreated ? 'Set password' : 'Update password' ?></button>
        </form>
      </section>
      </div><div data-security-panel="authenticator" hidden>
      <section id="mfa-disabled" hidden>
        <h2>Set up an authenticator</h2>
        <p><?= $googleCreated ? 'Your recent Google sign-in lets you start setup. If it has been more than five minutes, sign in with Google again.' : 'If it has been more than five minutes since sign-in, confirm your current password.' ?></p>
        <form id="mfa-begin-form">
          <?php if (!$googleCreated): ?><div class="field"><label for="begin-password">Current password, if requested</label><div class="input-wrap"><input id="begin-password" type="password" autocomplete="current-password"></div></div><?php endif; ?>
          <button class="primary-button" type="submit">Start MFA setup</button>
        </form>
      </section>
      <section id="mfa-setup" hidden>
        <h2>Scan this code</h2>
        <p>Scan with Google Authenticator, Microsoft Authenticator, or another TOTP app. The setup expires in ten minutes.</p>
        <div class="security-qr-panel"><div id="mfa-qr" role="img" aria-label="Authenticator setup QR code"></div><p>Scan this code with your authenticator app.</p></div>
        <p class="security-manual-key">Manual setup key <code id="mfa-secret"></code></p>
        <form id="mfa-confirm-form">
          <div class="field"><label for="confirm-code">Six-digit authenticator code</label><div class="input-wrap"><input id="confirm-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></div></div>
          <button class="primary-button" type="submit">Enable MFA</button>
        </form>
      </section>
      <section id="mfa-enabled" hidden>
        <h2>Authenticator enabled</h2>
        <p>Every sign-in now needs a current code or a recovery code.</p>
        <form id="mfa-recovery-form">
          <?php if (!$googleCreated): ?><div class="field"><label for="recovery-password">Current password, if requested</label><div class="input-wrap"><input id="recovery-password" type="password" autocomplete="current-password"></div></div><?php endif; ?>
          <div class="field"><label for="recovery-code">Current authenticator or recovery code</label><div class="input-wrap"><input id="recovery-code" autocomplete="one-time-code" required></div></div>
          <button class="primary-button" type="submit">Replace recovery codes</button>
        </form>
        <form id="mfa-disable-form">
          <?php if (!$googleCreated): ?><div class="field"><label for="disable-password">Current password, if requested</label><div class="input-wrap"><input id="disable-password" type="password" autocomplete="current-password"></div></div><?php endif; ?>
          <div class="field"><label for="disable-code">Current authenticator or recovery code</label><div class="input-wrap"><input id="disable-code" autocomplete="one-time-code" required></div></div>
          <button class="btn btn-secondary" type="submit">Disable MFA</button>
        </form>
      </section>
      <section id="recovery-display" hidden>
        <h2>Save your recovery codes</h2>
        <p>Each code works once. Store them somewhere private. They will not appear again.</p>
        <pre id="recovery-list"></pre>
        <button class="btn btn-secondary" id="recovery-done" type="button">I saved these codes</button>
      </section>
      </div><div data-security-panel="google" hidden>
      <?php if ($googleLinked): ?>
      <section class="security-google-connected"><h2>Google sign-in</h2><p>Your Google account is connected. You can use it to sign in.</p><span class="security-connected-badge">Connected</span></section>
      <?php elseif (clinic_env('CLINIC_GOOGLE_CLIENT_ID', '') !== '' && clinic_env('CLINIC_GOOGLE_CLIENT_SECRET', '') !== '' && clinic_env('CLINIC_GOOGLE_REDIRECT_URI', '') !== ''): ?>
      <section>
        <h2>Google sign-in</h2>
        <p>Link a Google account to this signed-in account. Confirm your current password first.</p>
        <form method="post" target="_top" action="<?= e(clinic_public_url('auth/google.php?mode=link')) ?>">
          <input type="hidden" name="csrf_token" value="<?= e(clinic_csrf_token()) ?>">
          <div class="field"><label for="google-link-password">Current password</label><div class="input-wrap"><input id="google-link-password" name="password" type="password" autocomplete="current-password" required></div></div>
          <button class="btn btn-secondary" type="submit">Link Google account</button>
        </form>
      </section>
      <?php else: ?><section><h2>Google sign-in</h2><p>Google sign-in is not available for this system yet.</p></section><?php endif; ?>
      </div>
    </div>
  </section>
</main>
<script src="<?= e($assetBase) ?>/vendor/qrcodejs/qrcode.min.js"></script>
<script>
(() => {
  const $ = (selector) => document.querySelector(selector);
  const status = (message, error = false) => {
    const el = $('#security-status');
    el.textContent = message;
    el.classList.add('is-visible');
    el.classList.toggle('error', error);
  };
  const request = async (action, payload = {}) => {
    const response = await fetch(<?= json_encode($apiUrl) ?> + '?action=' + encodeURIComponent(action), {
      method: 'POST', credentials: 'same-origin', headers: {
        'Content-Type': 'application/json', 'X-CSRF-Token': window.CLINIC_CSRF_TOKEN || <?= json_encode(clinic_csrf_token()) ?>,
      }, body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'Request failed.');
    return result.data;
  };
  const showStatus = async () => {
    const data = await request('mfa_status');
    $('#mfa-disabled').hidden = data.enabled;
    $('#mfa-enabled').hidden = !data.enabled;
    $('#mfa-setup').hidden = true;
  };
  const submit = (selector, handler) => $(selector).addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try { await handler(); } catch (error) { status(error.message, true); } finally { button.disabled = false; }
  });
  submit('#mfa-begin-form', async () => {
    const data = await request('mfa_begin', { password: $('#begin-password')?.value || '' });
    $('#mfa-secret').textContent = data.secret;
    $('#mfa-qr').replaceChildren();
    new QRCode($('#mfa-qr'), { text: data.uri, width: 180, height: 180 });
    $('#mfa-setup').hidden = false;
    status('Scan the QR code, then enter the current code to enable MFA.');
  });
  const revealCodes = (codes) => {
    $('#recovery-list').textContent = codes.join('\n');
    $('#recovery-display').hidden = false;
    $('#recovery-display').scrollIntoView({ block: 'nearest' });
  };
  submit('#mfa-confirm-form', async () => {
    const data = await request('mfa_confirm', { code: $('#confirm-code').value });
    await showStatus();
    revealCodes(data.recoveryCodes);
    status('MFA enabled. Save your recovery codes now.');
  });
  submit('#mfa-recovery-form', async () => {
    const data = await request('mfa_recovery_regenerate', { password: $('#recovery-password')?.value || '', code: $('#recovery-code').value });
    revealCodes(data.recoveryCodes);
    status('New recovery codes generated. Old codes no longer work.');
  });
  submit('#mfa-disable-form', async () => {
    await request('mfa_disable', { password: $('#disable-password')?.value || '', code: $('#disable-code').value });
    await showStatus();
    status('MFA disabled.');
  });
  $('#recovery-done').addEventListener('click', () => { $('#recovery-list').textContent = ''; $('#recovery-display').hidden = true; });
  submit('#security-password-form', async () => {
    const newPassword = $('#security-new-password').value;
    const confirmPassword = $('#security-confirm-password').value;
    if (newPassword !== confirmPassword) throw new Error('New passwords do not match.');
    await request('change_password', { currentPassword: $('#security-current-password')?.value || '', newPassword, confirmPassword });
    $('#security-password-form').reset();
    status('Password saved. You can now sign in with your email and new password.');
    $('#security-status').scrollIntoView({ block: 'nearest' });
  });
  let mfaLoaded = false;
  const selectTab = (tab) => {
    document.querySelectorAll('[data-security-panel]').forEach(panel => { panel.hidden = panel.dataset.securityPanel !== tab; });
    document.querySelectorAll('[data-security-tab]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.securityTab === tab)); });
    $('#security-status').textContent = '';
    $('#security-status').classList.remove('is-visible');
    if (tab === 'authenticator' && !mfaLoaded) showStatus().then(() => { mfaLoaded = true; }).catch(error => status(error.message, true));
  };
  document.querySelectorAll('[data-security-tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.securityTab)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') parent.postMessage({ type: 'clinic-security-close' }, location.origin);
  });
  selectTab(<?= json_encode($securityTab) ?>);
})();
</script>
</body></html>
