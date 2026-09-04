<?php
require_once __DIR__ . '/../../app/core/helpers.php';
$pageTitle = 'Create Patient Account | ' . clinic_app_name();
$pageDescription = 'Create a secure ' . clinic_app_name() . ' patient account';
$apiUrl = '../../api/index.php';
$loginUrl = 'login.php#login';
$bodyClass = 'patient-registration-page';
$roleUrls = [
    'Admin' => '../admin/dashboard.php#dashboard',
    'Doctor' => '../doctor/dashboard.php#dashboard',
    'Laboratory Staff' => '../laboratory/dashboard.php#dashboard',
    'Patient' => '../patient/dashboard.php#dashboard',
];
require_once __DIR__ . '/../../app/config/database.php';
require_once __DIR__ . '/../../app/core/maintenance.php';
$assetBase = clinic_asset_base('../assets');
$registrationFacilities = [];
$registrationUnavailable = false;
try {
    $registrationPdo = db();
    clinic_maintenance_redirect_if_blocked($registrationPdo, 'Patient', 'registration');
    $registrationFacilities = $registrationPdo->query('SELECT id, name FROM facilities WHERE status = \'Active\' ORDER BY name')->fetchAll();
} catch (Throwable $ignored) {
    http_response_code(503);
    $registrationUnavailable = true;
}
require __DIR__ . '/../../app/views/layouts/header.php';
?>
    <main class="patient-register-shell">
      <section class="patient-register-visual">
        <a class="admin-brand register-brand" href="login.php#login">
          <span class="admin-brand-mark register-medical-mark"><svg viewBox="0 0 24 24"><path d="M10 2h4v8h8v4h-8v8h-4v-8H2v-4h8V2Z"/></svg></span>
          <span><strong><?= e(clinic_app_name()) ?></strong><small>Secure patient portal</small></span>
        </a>
        <div class="register-hero-art" aria-hidden="true">
          <svg viewBox="0 0 540 340"><ellipse cx="270" cy="307" rx="203" ry="18" fill="#bce9e5"/><circle cx="265" cy="163" r="140" fill="#d9f4f1"/><path d="M110 286V134l155-67 159 67v152" fill="#fff" stroke="#8ed3cd" stroke-width="6"/><path d="M232 91h65v52h52v65h-52v52h-65v-52h-52v-65h52V91Z" fill="#0aa397"/><rect x="174" y="229" width="182" height="57" rx="8" fill="#e4f4f6"/><path d="M70 306h400" stroke="#61c0b8" stroke-width="7" stroke-linecap="round"/></svg>
        </div>
        <div class="register-hero-copy">
          <p class="eyebrow">Secure access to your care</p>
          <h1>Your Health. Your Records. Always Accessible.</h1>
        </div>
      </section>

      <section class="patient-register-form-side">
        <div class="patient-register-card">
          <header><p class="eyebrow"><?= e(clinic_app_name()) ?></p><h2>Create Patient Account</h2><p>Fill in your details to create your secure patient profile.</p></header>
          <div class="register-status" role="status" aria-live="polite"></div>
          <?php if ($registrationUnavailable): ?><div class="register-status visible" role="alert">Registration is temporarily unavailable. Please try again later.</div><?php elseif (!$registrationFacilities): ?><div class="register-status visible" role="alert">Registration is paused because no active clinic is available.</div><?php endif; ?>
          <form id="patient-register-form" novalidate>
            <div class="form-grid">
              <div class="form-field full"><label for="patient-full-name">Full Name</label><input id="patient-full-name" name="fullName" placeholder="e.g. Sarah Johnson" autocomplete="name" required minlength="2"><small class="register-error"></small></div>
              <div class="form-field"><label for="patient-dob">Date of Birth</label><input id="patient-dob" name="dob" type="date" required><small class="register-error"></small></div>
              <div class="form-field"><label for="patient-sex">Sex</label><select id="patient-sex" name="sex" required><option value="">Select sex</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select><small class="register-error"></small></div>
              <div class="form-field"><label for="patient-email">Email Address</label><input id="patient-email" name="email" type="email" placeholder="sarah@example.com" autocomplete="email" required><small class="register-error"></small></div>
              <div class="form-field"><label for="patient-contact">Contact Number</label><input id="patient-contact" name="contact" type="tel" placeholder="0912 345 6789" autocomplete="tel" required><small class="register-error"></small></div>
              <div class="form-field full"><label for="patient-address">Address</label><input id="patient-address" name="address" placeholder="Street, city, province" autocomplete="street-address" required><small class="register-error"></small></div>
              <div class="form-field full"><label for="patient-facility">Primary Facility</label><select id="patient-facility" name="facilityId" required><option value="">Select your clinic</option><?php foreach ($registrationFacilities as $facility): ?><option value="<?= e($facility['id']) ?>"><?= e($facility['name']) ?></option><?php endforeach; ?></select><small class="register-error"></small></div>
              <div class="form-field full"><label for="patient-username">Username</label><input id="patient-username" name="username" placeholder="sarah.johnson" autocomplete="username" required minlength="3"><small class="register-error"></small></div>
              <div class="form-field"><label for="patient-password">Password</label><div class="patient-password-wrap"><input id="patient-password" name="password" type="password" placeholder="12–128 characters" autocomplete="new-password" required minlength="12" maxlength="128"><button class="password-toggle" type="button" data-password-toggle="patient-password" aria-label="Show password" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3 3.6M6.1 6.1C3.4 7.8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3.1-.5" /></svg></button></div><small class="register-error"></small></div>
              <div class="form-field"><label for="patient-confirm">Confirm Password</label><div class="patient-password-wrap"><input id="patient-confirm" name="confirm" type="password" placeholder="Repeat password" autocomplete="new-password" required><button class="password-toggle" type="button" data-password-toggle="patient-confirm" aria-label="Show password" aria-pressed="false"><svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg><svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3 3.6M6.1 6.1C3.4 7.8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3.1-.5" /></svg></button></div><small class="register-error"></small></div>
            </div>
            <label class="register-check"><input id="patient-terms" type="checkbox" required><span>I agree to the Terms and Conditions and Privacy Policy.</span></label>
            <label class="register-check"><input id="patient-privacy-ack" type="checkbox" required><span>I understand that I can only access my own medical information and will not attempt to access anyone else's data.</span></label>
            <button class="btn btn-primary register-submit" type="submit" <?= $registrationUnavailable || !$registrationFacilities ? 'disabled' : '' ?>>Create Account <span>-&gt;</span></button>
          </form>
          <p class="register-signin">Already have an account? <a href="login.php#login">Sign in here</a></p>
          <div class="register-security-footer">Secure access keeps your information safe and private.</div>
        </div>
      </section>
    </main>
<?php require __DIR__ . '/../../app/views/layouts/footer.php'; ?>
