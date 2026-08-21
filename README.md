# Clinic System V2

Clinic System V2 is a PHP and MySQL/MariaDB application for laboratory orders, results, notifications, and role-based clinic workflows.

## Requirements

- PHP 8.1 or newer with PDO MySQL enabled
- MySQL or MariaDB
- A web server, or PHP's built-in development server

## Install on another computer

1. Copy this entire project folder.
2. Import `database/clinic_system_v2.sql` into MySQL/MariaDB. This is the only database file required.
3. Copy `app/config/local.example.php` to `app/config/local.php` if a local configuration does not already exist.
4. Update the database host, port, database name, username, and password in `app/config/local.php`.
5. From the project root, run:

   ```powershell
   php -S 127.0.0.1:8000 -t .
   ```

6. Open <http://127.0.0.1:8000>.

The database installer recreates the application tables and demo data. Back up an existing database before importing it.

## Directory structure

```text
api/          JSON API and compatibility endpoint wrappers
app/          Configuration, authentication, middleware, models, and shared views
database/     Single portable database installer
docs/         Design and implementation notes
public/       Browser entry points, assets, and protected upload storage
tests/        Integration test suite
index.php     Project-root web entry point
```

## Local and generated files

- `app/config/local.php` contains machine-specific database settings and is intentionally ignored by Git.
- `public/uploads/results/` contains runtime result attachments. Only `.gitkeep` belongs in a clean project copy; copy real attachments separately when migrating production data.
- Temporary test output, logs, dependency folders, and local database data are excluded through `.gitignore`.

## Documentation

- [Doctor and Laboratory Staff roles](docs/DOCTOR_AND_LABORATORY_STAFF.md)

## Laboratory Result Image Scanner

Laboratory Staff can capture or select a JPG, PNG, or WEBP result image on the result-upload page. Local browser OCR detects supported laboratory parameters and fills the result value, unit, reference range, and flag fields for staff review. The OCR engine and English language data are stored under `public/assets/vendor/tesseract/`, so scanning does not require an internet connection or upload the image to a third-party OCR service.

OCR output is assistive only. Laboratory Staff must compare every populated field with the source report before uploading the result.

## Verification

Check PHP syntax across the project:

```powershell
Get-ChildItem -Recurse -Filter *.php | ForEach-Object { php -l $_.FullName }
```

The integration test is available at `tests/integration.php`. It writes test records, so run it only against a disposable test database.
