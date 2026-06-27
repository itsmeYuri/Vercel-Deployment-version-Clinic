# Clinic System V2 Setup

Clinic System V2 is a PHP 8+/MySQL laboratory clinic portal with role-based dashboards for Admin, Doctor, Laboratory Staff, and Patient users.

## Requirements

- XAMPP or similar local stack with Apache, PHP 8+, MySQL/MariaDB, and the PHP `pdo_mysql` extension enabled
- A browser that can run `fetch()`
- This folder placed inside `xampp/htdocs`

## Database Setup

1. Start Apache and MySQL in XAMPP.
2. Open `http://localhost/phpmyadmin`.
3. Import `database/clinic_system_v2.sql`.
4. Confirm the database `clinic_system_v2` exists.
5. If your MySQL credentials are not `root` with an empty password, edit `app/config/database.php`.

The SQL file creates normalized tables for roles, users, patients, doctors, laboratory staff, facilities, tests, orders, results, result values, clinical notes, notifications, audit logs, and settings.

For local troubleshooting, you can temporarily set `APP_DEBUG` to `true` in `app/config/database.php` or set the environment variable `APP_DEBUG=1`. The API will then include the exception class and message in JSON error responses.

## Run

Open:

```text
http://localhost/Clinic System V2/public/
```

You can also open the project root:

```text
http://localhost/Clinic System V2/
```

If the folder name is different, replace `Clinic System V2` with your actual folder name.
Both entry points redirect to `public/auth/login.php`.

## Demo Accounts

Use either username or email on the login form.

| Role | Username | Email | Password |
| --- | --- | --- | --- |
| Admin | `admin` | `admin@clinic.com` | `admin123` |
| Doctor | `doctor` | `doctor@clinic.com` | `doctor123` |
| Laboratory Staff | `lab` | `labstaff@clinic.com` | `lab123` |
| Patient | `patient` | `patient@clinic.com` | `patient123` |

The SQL seed does not store plain-text passwords. Demo hashes are upgraded to PHP `password_hash()` values after each account logs in successfully.

The demo Laboratory Staff account is assigned to Central Medical Center and Northside Diagnostic so it can process open orders and review seeded pending results.
When an Admin saves a Laboratory Staff user from the single Assigned Facility field, the API replaces that user's editable facility scope with the selected facility.

## What Works

- PHP session login/logout and server-side role redirects
- Patient self-registration with hashed passwords
- Server-side role checks for every API action
- Role-based PHP page folders under `public/admin`, `public/doctor`, `public/laboratory`, and `public/patient`
- Admin user, facility, and test CRUD
- Admin and Doctor laboratory order creation
- Doctor patient views, order tracking, result review, and clinical notes
- Laboratory order status updates before result upload, result upload, verification, release, and rejection
- Patient-only personal orders and released results
- Notifications and audit logs stored in MySQL
- Dynamic dashboard metrics, tables, reports, drawers, search, and profile menus

## Troubleshooting

- `Database error`: Import `database/clinic_system_v2.sql` again and check `app/config/database.php`.
- `could not find driver`: enable `extension=pdo_mysql` in the PHP/XAMPP `php.ini`, then restart Apache.
- Login fails for every account: make sure MySQL is running and the API URL `api/index.php?action=health` returns JSON.
- Protected pages redirect to login: sign in again; sessions require Apache/PHP, not direct `file://` browsing.
- Blank dashboard: open browser dev tools and check the Network tab for failed `api/index.php` requests.

## Important Files

- `public/auth/login.php` - login page
- `public/auth/register.php` - patient self-registration page
- `public/admin/*`, `public/doctor/*`, `public/laboratory/*`, `public/patient/*` - protected role page routes
- `api/index.php` - existing API router, CRUD, and workflow actions
- `api/admin/*`, `api/doctor/*`, `api/laboratory/*`, `api/patient/*` - role-scoped API handler entry points
- `app/config/database.php` - PDO database connection
- `app/core/auth.php` - shared PHP session and page authorization helpers
- `app/views/layouts/*` - reusable header, sidebar, navbar, and footer includes
- `database/clinic_system_v2.sql` - schema and seeded demo data
- `public/assets/js/main.js` - API-driven frontend controller
- `public/assets/css/styles.css` - existing responsive UI styling
- `docs/DESIGN.md` - system design and workflow reference
