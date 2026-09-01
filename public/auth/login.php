<?php
require_once __DIR__ . '/../../app/core/auth.php';

clinic_start_session();
$authNotice = $_SESSION['auth_notice'] ?? '';
unset($_SESSION['auth_notice']);

$pageTitle = 'Centralized Laboratory Results System';
$pageDescription = 'Secure login for the Centralized Laboratory Results System';
$assetBase = clinic_asset_base('../assets');
$apiUrl = '../../api/index.php';
$loginUrl = 'login.php#login';
$roleUrls = [
    'Admin' => '../admin/dashboard.php#dashboard',
    'Doctor' => '../doctor/dashboard.php#dashboard',
    'Laboratory Staff' => '../laboratory/dashboard.php#dashboard',
    'Patient' => '../patient/dashboard.php#dashboard',
];
require __DIR__ . '/../../app/views/layouts/header.php';
?>
    <main class="auth-shell">
      <section class="brand-panel" aria-labelledby="brand-title">
        <a class="brand" href="login.php#login" aria-label="Centralized Laboratory Results System home">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" role="img"><path d="M13 5a3 3 0 0 1 6 0v8h8a3 3 0 0 1 0 6h-8v8a3 3 0 0 1-6 0v-8H5a3 3 0 0 1 0-6h8V5Z" /></svg>
          </span>
          <span><strong id="brand-title">Centralized Laboratory Results System</strong><small>Healthcare made simpler</small></span>
        </a>

        <div class="illustration-wrap" aria-hidden="true">
          <span class="orbit orbit-one"></span>
          <span class="orbit orbit-two"></span>
          <img class="hero-logo-illustration" src="<?= e($assetBase) ?>/img/gen-and-rics-logo.png" alt="" />
          <svg class="health-illustration" viewBox="0 0 600 470" role="img">
            <ellipse cx="304" cy="429" rx="219" ry="22" fill="#79cfc8" opacity=".19" />
            <circle cx="299" cy="215" r="174" fill="#d9f4f1" opacity=".82" />
            <circle cx="299" cy="215" r="137" fill="#c5ebe8" opacity=".52" />
            <rect x="73" y="98" width="158" height="109" rx="19" fill="#fff" />
            <rect x="93" y="119" width="46" height="46" rx="13" fill="#e2f5f3" />
            <path d="M112 128h8v10h10v8h-10v10h-8v-10h-10v-8h10v-10Z" fill="#08a394" />
            <path d="M245 168c0-42 25-75 66-75s69 31 69 75c0 47-31 80-68 80s-67-34-67-80Z" fill="#e7a478" />
            <path d="M245 159c3-51 31-78 72-74 39 4 64 36 62 78-21-6-43-23-53-46-9 22-39 39-81 42Z" fill="#173e55" />
            <path d="M266 246c-48 16-70 51-74 147h236c-5-96-27-131-76-147-20 21-65 21-86 0Z" fill="#fff" />
            <path d="m272 250 39 66 38-66" fill="none" stroke="#b9dddd" stroke-width="8" stroke-linejoin="round" />
            <path d="M301 299h21l8 92h-38l9-92Z" fill="#0b938c" />
          </svg>
        </div>

        <div class="brand-copy">
          <p class="eyebrow">Connected care, every day</p>
          <h1>One place for better patient care.</h1>
        </div>
      </section>

      <section class="form-panel">
        <div class="mobile-brand">
          <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M13 5a3 3 0 0 1 6 0v8h8a3 3 0 0 1 0 6h-8v8a3 3 0 0 1-6 0v-8H5a3 3 0 0 1 0-6h8V5Z" /></svg></span>
          <span><strong>Centralized Laboratory Results System</strong><small>Healthcare made simpler</small></span>
        </div>

        <div class="form-card" id="login-screen">
          <header class="form-header">
            <span class="section-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" /></svg></span>
            <p class="eyebrow">Centralized Laboratory Results System</p>
            <h2>Welcome back</h2>
            <p>Sign in to securely access your laboratory results workspace.</p>
          </header>

          <div class="status-message<?= $authNotice !== '' ? ' is-visible error' : '' ?>" role="status" aria-live="polite"><?= e($authNotice) ?></div>

          <form id="login-form" novalidate>
            <div class="field">
              <label for="login-identifier">Email or username</label>
              <div class="input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM4 7l8 6 8-6" /></svg>
                <input id="login-identifier" name="identifier" type="text" autocomplete="username" placeholder="you@example.com" required />
              </div>
              <p class="field-error" id="login-identifier-error"></p>
            </div>

            <div class="field">
              <label for="login-password">Password</label>
              <div class="input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required />
                <button class="password-toggle" type="button" data-toggle-password="login-password" aria-label="Show password" aria-pressed="false">
                  <svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                  <svg class="eye-closed" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3 3.6M6.1 6.1C3.4 7.8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3.1-.5" /></svg>
                </button>
              </div>
              <p class="field-error" id="login-password-error"></p>
            </div>

            <button class="primary-button" type="submit">
              <span>Log in securely</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5" /></svg>
            </button>
          </form>

          <p class="form-switch">New to the laboratory results system? <a href="register.php">Create a patient account</a></p>
        </div>

        <footer>(c) <span id="current-year"></span> Centralized Laboratory Results System - Your privacy matters</footer>
      </section>
    </main>
<?php require __DIR__ . '/../../app/views/layouts/footer.php'; ?>
