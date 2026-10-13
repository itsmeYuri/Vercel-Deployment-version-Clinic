<?php
require_once __DIR__ . '/../../app/core/auth.php';
require_once __DIR__ . '/../../app/core/google.php';
$user = clinic_require_auth();
$securityTab = in_array($_GET['tab'] ?? '', ['password', 'authenticator', 'google'], true) ? $_GET['tab'] : 'authenticator';
if (($_GET['embed'] ?? '') !== '1') {
    $dashboard = explode('#', clinic_role_home_path($user['role']))[0];
    clinic_redirect($dashboard . '?security=' . $securityTab . '#settings');
}
$securityTab = $securityTab === 'google' ? 'authenticator' : $securityTab;
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
      <nav class="security-tabs" role="tablist" aria-label="Account security settings">
        <button type="button" role="tab" id="password-tab" aria-controls="password-panel" data-security-tab="password">Password</button>
        <button type="button" role="tab" id="authenticator-tab" aria-controls="authenticator-panel" data-security-tab="authenticator">Authenticator &amp; Google</button>
      </nav>
      <div class="status-message" id="security-status" role="status" aria-live="polite"></div>
      <div id="password-panel" role="tabpanel" aria-labelledby="password-tab" data-security-panel="password"><section id="password-section">
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
      </div><div id="authenticator-panel" role="tabpanel" aria-labelledby="authenticator-tab" data-security-panel="authenticator" hidden>
      <p id="mfa-loading" class="security-loading" role="status">Checking authenticator status...</p>
      <section id="mfa-disabled" hidden>
        <div class="security-method-heading"><span class="security-method-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="m9 11 2 2 4-4M11 18h2"/></svg></span><div><h2>Authenticator app</h2><span class="security-method-state">Not enabled</span></div></div>
        <p>Add a verification code from your authenticator app to protect each sign-in.</p>
        <p class="security-reauth-note"><?= $googleCreated ? 'Signed in over five minutes ago? Sign in with Google again before setup.' : 'Signed in over five minutes ago? Confirm your current password below.' ?></p>
        <form id="mfa-begin-form">
          <?php if (!$googleCreated): ?><div class="field"><label for="begin-password">Current password, if requested</label><div class="input-wrap"><input id="begin-password" type="password" autocomplete="current-password"></div></div><?php endif; ?>
          <button class="primary-button" type="submit">Set up authenticator</button>
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
        <div class="security-method-heading"><span class="security-method-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="m9 11 2 2 4-4M11 18h2"/></svg></span><div><h2>Authenticator app</h2><span class="security-connected-badge">Enabled</span></div></div>
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
      <?php if ($googleLinked): ?>
      <section class="security-google-connected"><div class="security-method-heading"><span class="security-method-icon security-google-icon"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.75 7.18l7.73 6C44.43 38.03 46.98 31.68 46.98 24.55Z" />
                <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.92 7.51 2.56 10.78l7.97-6.19Z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.92-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.87 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48Z" />
              </svg></span><div><h2>Google sign-in</h2><p class="security-account-email">Ready for sign-in</p></div><span class="security-connected-badge">Connected</span></div><p>Use your connected Google account to sign in.</p></section>
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
    let data;
    try { data = await request('mfa_status'); } finally { $('#mfa-loading').hidden = true; }
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
    $('#mfa-disabled').hidden = true;
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
    document.querySelectorAll('[data-security-tab]').forEach(button => {
      const active = button.dataset.securityTab === tab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $('#security-status').textContent = '';
    $('#security-status').classList.remove('is-visible');
    if (tab === 'authenticator' && !mfaLoaded) showStatus().then(() => { mfaLoaded = true; }).catch(error => status(error.message, true));
  };
  document.querySelectorAll('[data-security-tab]').forEach(button => button.addEventListener('click', () => selectTab(button.dataset.securityTab)));
  document.querySelector('.security-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[data-security-tab]')];
    const index = tabs.indexOf(document.activeElement);
    const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    selectTab(next.dataset.securityTab);
    next.focus();
  });
  const resizePopup = () => parent.postMessage({ type: 'clinic-security-resize', height: Math.ceil(document.querySelector('.account-security-card').getBoundingClientRect().height) }, location.origin);
  new ResizeObserver(resizePopup).observe(document.querySelector('.account-security-card'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') parent.postMessage({ type: 'clinic-security-close' }, location.origin);
  });
  selectTab(<?= json_encode($securityTab) ?>);
})();
</script>
</body></html>
