# Authentication setup

## Implementation

Password and Google sign-in use the same application account and role system. A user with MFA enabled gets a five-minute restricted challenge session after either sign-in method. Protected PHP pages and API actions do not accept that session until a valid six-digit TOTP or single-use recovery code is supplied. The full session token and CSRF token rotate when authentication completes.

Authenticator setup generates a unique 160-bit secret. The server encrypts it with AES-256-GCM before database storage. The setup QR is created locally in the browser; its `otpauth://` value is shown only to the signed-in account during enrollment. Setup expires after ten minutes and MFA activates only when the user confirms a code. TOTP uses 30-second steps, six digits, SHA-1, and a one-step clock allowance on either side. An atomic database update rejects reuse of an accepted step. Ten 128-bit recovery codes are shown once; only SHA-256 hashes are stored, and a database delete consumes each code once.

Google uses an authorization-code OpenID Connect flow with state, nonce, and PKCE S256. The official `google/auth` library exchanges the code and verifies the ID token signature, audience, and expiry. The callback checks issuer, nonce, subject, and verified email. The Google issuer and subject identify linked accounts. Matching email alone never links an existing account. A new Google account receives only the Patient role and a patient profile; the user can complete optional patient details afterward. Existing users link from Account security after signing in, with a recent sign-in and password confirmation. Google sign-in obeys the same MFA challenge.

The existing database-backed login limiter applies to password, MFA, recovery, and reauthentication attempts. Password login and session protection use the existing CSRF and cookie controls. New Google patients are recorded with privacy acknowledgement unset; the app does not claim they accepted terms they have not seen. Keep the server clock synchronized; TOTP will fail if it drifts beyond the allowed window.

## Local setup

1. Install PHP 8.1 or newer with `pdo_mysql` for local MariaDB (or `pdo_pgsql` for PostgreSQL), plus `openssl`, `curl`, and `mbstring`. Enable `zip` for Composer on Windows. Install [Composer](https://getcomposer.org/download/) and run `composer install` in the project root. `composer.json` and `composer.lock` pin Google Auth and the existing PHPMailer dependency. Do not edit `vendor/` by hand.
2. This machine has a MariaDB service on port `3307`. The running local app uses an isolated database named `clinic_auth_local`, populated from the local archived clinic schema and `database/authentication_migration.mysql.sql`. It does not use the existing `clinic_system_v2` database. To set up another MariaDB database, import a copy of the clinic MySQL schema into a new database, then run `database/authentication_migration.mysql.sql` in that database. For Supabase instead, run `database/supabase_schema.sql` in a new project or back up an existing project and apply `database/authentication_migration.sql`.
3. Generate an encryption key locally: `php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"`. Set `CLINIC_MFA_ENCRYPTION_KEY` in the local process environment. Keep the same key across restarts. Losing it makes enrolled secrets unreadable. Do not put the key in the repository.
4. For this machine's MariaDB instance, set `CLINIC_DB_HOST=127.0.0.1`, `CLINIC_DB_PORT=3307`, `CLINIC_DB_NAME=clinic_auth_local`, and local `CLINIC_DB_USER` / `CLINIC_DB_PASS`. The running app uses the limited `clinic_auth_app` user; its local password is in ignored `tmp/local-db-pass.txt`, and the MFA key is in ignored `tmp/local-auth-key.txt`. Leave `CLINIC_DATABASE_URL`, `SUPABASE_DB_URL`, and `DATABASE_URL` unset so the app selects MySQL/MariaDB. Set `CLINIC_SESSION_DRIVER=database` and `CLINIC_COOKIE_SECURE=0` only for HTTP localhost. The archived demo users have legacy hashes, so `CLINIC_ALLOW_DEMO_HASHES=1` is set for this disposable database; keep it `0` elsewhere. For a remote PostgreSQL connection instead, use `CLINIC_DATABASE_URL` or `SUPABASE_DB_URL`; `CLINIC_DB_SSLMODE` defaults to `require`.
5. To restart this local instance, run the following from the project root in PowerShell, then open `http://127.0.0.1:8099/public/auth/login.php`:

   ```powershell
   $env:CLINIC_DB_HOST='127.0.0.1'
   $env:CLINIC_DB_PORT='3307'
   $env:CLINIC_DB_NAME='clinic_auth_local'
   $env:CLINIC_DB_USER='clinic_auth_app'
   $env:CLINIC_DB_PASS=Get-Content -Raw 'tmp/local-db-pass.txt'
   $env:CLINIC_MFA_ENCRYPTION_KEY=Get-Content -Raw 'tmp/local-auth-key.txt'
   $env:CLINIC_SESSION_DRIVER='database'
   $env:CLINIC_COOKIE_SECURE='0'
   $env:CLINIC_ALLOW_DEMO_HASHES='1'
   php -S 127.0.0.1:8099 -t . local-router.php
   ```

`.env.example` lists variable names and placeholders; it is not loaded. The app loads ignored `.env.local` automatically for local credentials. Process environment variables take precedence. Keep real secrets out of `.env.example` and use `local-router.php` when starting the PHP development server, so `.env.local` cannot be downloaded over HTTP.

| Variable | Purpose |
| --- | --- |
| `CLINIC_MFA_ENCRYPTION_KEY` | Base64-encoded 32-byte AES key for TOTP secrets. Required before MFA setup or challenge. |
| `CLINIC_GOOGLE_CLIENT_ID` | Google Web application OAuth client ID. Enables the Google button. |
| `CLINIC_GOOGLE_CLIENT_SECRET` | Secret for the same Google Web application client. |
| `CLINIC_GOOGLE_REDIRECT_URI` | Exact callback registered with Google, including scheme, host, port, and path. |
| `CLINIC_DATABASE_URL` / `SUPABASE_DB_URL` | Existing PostgreSQL connection settings. |
| `CLINIC_DB_SSLMODE` | PostgreSQL TLS mode; defaults to `require`. |
| `CLINIC_DB_HOST`, `CLINIC_DB_PORT`, `CLINIC_DB_NAME`, `CLINIC_DB_USER`, `CLINIC_DB_PASS` | MariaDB/MySQL connection settings when no PostgreSQL URL is set. |
| `CLINIC_SESSION_DRIVER` | Set to `database` for shared sessions. |
| `CLINIC_COOKIE_SECURE` | Keep `1` on HTTPS; set `0` only on local HTTP. |

## Google Cloud Console

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create or choose a project. Configure the OAuth consent screen, add the app name and support contact, and add test users while the app is in testing status. Create an OAuth Client ID of type **Web application**. Copy its Client ID and Client Secret into the process environment. Add an authorized redirect URI that exactly matches `CLINIC_GOOGLE_REDIRECT_URI`. For the local server command above, use `http://127.0.0.1:8099/public/auth/google.php`. A Vercel deployment, if chosen later, would use its HTTPS `/auth/google.php` URL; no deployment is part of this change. Sign-in requests `openid email profile` only.

## Manual verification

- Register a patient or use a disposable demo user, then sign in with a password. In Settings, choose **Authenticator and Google sign-in**. Start setup, scan the QR with Google Authenticator or Microsoft Authenticator, enter the current six-digit code, and save the displayed recovery codes outside the app. Sign out and sign back in to see the MFA challenge.
- At the challenge, use a current authenticator code. Try a wrong code, the same accepted code again, and an expired code. Each should fail. A recovery code signs in once; reuse must fail. Account security can replace recovery codes or disable MFA after recent authentication and a current second factor.
- With Google credentials configured, click **Continue with Google**. A new verified Google identity creates a Patient account. An existing email without an explicit link is refused. Sign into that existing account, open Account security, and link Google there. After Google sign-in, an MFA-enabled account must complete the same challenge. Real Google authorization cannot be tested without user-provided OAuth credentials.

Common problems: a missing migration breaks database sessions; a changed MFA key breaks code checks; clock drift rejects TOTP; a redirect URI mismatch is rejected by Google; a Google button stays hidden until all three Google configuration variables are set; expired OAuth or MFA challenge sessions require starting sign-in again. Google-only accounts can perform sensitive MFA changes within five minutes of a fresh Google sign-in; after that, sign out and sign in again to refresh authentication.

Live Google authorization requires a Google OAuth client and a user completing the sign-in flow. Check the callback, new Patient account creation, existing-account linking, and MFA challenge before using it beyond local development.

## Files changed

| File | Purpose |
| --- | --- |
| `app/core/mfa.php` | TOTP, encryption, atomic accepted-step and recovery-code claims. |
| `app/core/google.php` | Validates Google identity claims after signed-token verification. |
| `app/core/session.php` | Persists pending MFA, verified MFA, OAuth flow, recent authentication, and notices in database sessions. |
| `app/core/auth.php` | Checks MFA authorization on PHP page access. |
| `app/config/database.php` | Loads ignored `.env.local` as a fallback to process variables and supports explicit PostgreSQL TLS mode. |
| `local-router.php` | Denies HTTP access to local secrets and server-side files when using the PHP development server. |
| `api/index.php` | Password challenge, MFA enrollment, verification, disable, recovery, and API gating. |
| `public/auth/google.php` | Google authorization, callback verification, patient creation, and explicit linking. |
| `public/auth/security.php` | Account MFA and Google linking controls. |
| `public/auth/login.php` | Google button with logo and MFA challenge form. |
| `public/assets/js/main.js` | Login challenge behavior and settings links. |
| `public/assets/css/styles.css` | Account security layout and MFA challenge visibility. |
| `public/assets/vendor/qrcodejs/qrcode.min.js`, `LICENSE` | Local QR renderer and its license. |
| `database/supabase_schema.sql` | New authentication tables and database session columns for fresh Supabase projects. |
| `database/authentication_migration.sql` | Same database additions for existing Supabase projects. |
| `database/authentication_migration.mysql.sql` | Authentication tables and session columns for the local MariaDB option. |
| `.env.example` | New variable names and placeholders. |
| `.gitignore` | Excludes local secrets and temporary files from Git. |
| `composer.json`, `composer.lock` | Reproducible maintained dependencies. |
| `AUTHENTICATION_SETUP.md` | This guide. |
