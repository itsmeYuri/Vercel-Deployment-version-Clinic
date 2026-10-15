# Local verification

These tests use the local demo database. Do not run the HTTP smoke scripts against production.

1. Run `node --test tests/*.test.js` and `php tests/result-anomaly.test.php` for deterministic comparison, glossary, forecast, and anomaly checks.
2. If your local MariaDB demo database predates the existing authentication migration, run `php tests/migrate-local-auth.php` once. This only accepts `127.0.0.1` or `localhost` MariaDB.
3. Start the project-root PHP server: `php -S 127.0.0.1:8099 -t .`.
4. In a second terminal run `php tests/database-smoke.php`, `php tests/http-smoke.php`, and `php tests/lab-http-smoke.php`.

The HTTP scripts sign in with the repository's demo patient and lab staff accounts, verify access to released results and notifications, check download and role protection, and call the live validation endpoint. They do not create, verify, release, or delete patient results. They are not a substitute for an authenticated browser check on the deployment environment.
