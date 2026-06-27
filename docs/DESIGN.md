# Clinic Management System V2 Design Reference

## Overview

Clinic System V2 is a PHP/MySQL laboratory clinic portal. The existing HTML/CSS UI is preserved, while role pages are organized as PHP routes and application state is served by `api/index.php` plus role-scoped API handler entry points.

The frontend uses:

- `public/auth/*.php` login and registration pages
- `public/admin`, `public/doctor`, `public/laboratory`, and `public/patient` protected page folders
- `public/assets/css/styles.css` for the existing design system
- `public/assets/js/main.js` for API-backed rendering, forms, drawers, search, navigation, and workflow actions

The backend uses:

- PHP sessions for authentication
- PDO prepared statements through `pdo_mysql`
- `password_hash()` and `password_verify()` for real accounts
- JSON responses with `success`, `message`, `data`, and `errors`
- Server-side role authorization on protected actions

## Roles

| Role | Page | Access |
| --- | --- | --- |
| Admin | `public/admin/dashboard.php` | Users, facilities, tests, order creation, all orders, all results, reports, audit, notifications |
| Doctor | `public/doctor/dashboard.php` | Assigned/connected patients, own orders, own results, clinical notes |
| Laboratory Staff | `public/laboratory/dashboard.php` | Orders/results for assigned facilities, result upload/review/release |
| Patient | `public/patient/dashboard.php` | Own orders, own released results, own profile and notifications |

Unauthorized users are redirected to the login page or their own role dashboard.

## Database Summary

Primary tables:

- `roles`
- `users`
- `patients`
- `doctors`
- `laboratory_staff`
- `facilities`
- `staff_facilities`
- `test_definitions`
- `lab_orders`
- `lab_order_items`
- `lab_results`
- `lab_result_values`
- `clinical_notes`
- `result_files`
- `notifications`
- `audit_logs`
- `system_settings`

Important visibility rules:

- Doctors only receive orders/results where `lab_orders.doctor_id` matches their user ID.
- Lab staff only receive orders/results for facilities in `staff_facilities`.
- Patients only receive orders for their `patients.id`.
- Patients only receive results where `lab_results.status = 'Released'`.

## API Summary

Authentication:

- `login`
- `logout`
- `session`
- `register_patient`

Shared data:

- `app_data`
- `notifications`
- `mark_notification_read`
- `mark_all_notifications_read`
- `change_password`

Admin:

- `list_users`
- `save_user`
- `toggle_user_status`
- `reset_user_password`
- `list_facilities`
- `save_facility`
- `list_tests`
- `save_test`
- `list_all_orders`
- `list_all_results`
- `reports_summary`
- `audit_logs`

Doctor:

- `doctor_patients`
- `available_facilities`
- `available_tests`
- `create_order`
- `doctor_orders`
- `doctor_results`
- `add_clinical_note`

Laboratory:

- `lab_orders`
- `update_order_status`
- `upload_result`
- `review_result`
- `release_result`
- `reject_result`
- `lab_queue`
- `lab_facilities`

Patient:

- `patient_orders`
- `patient_results`
- `patient_profile`
- `update_patient_profile`

## Workflows

### Login

1. User enters username/email and password.
2. API validates the account against MySQL.
3. Passwords are checked with `password_verify()`. Seed demo hashes are upgraded after first login.
4. API starts a PHP session.
5. Frontend redirects to the correct role dashboard.

### Patient Registration

1. Patient submits the public registration form.
2. API validates required fields and duplicate username/email.
3. API creates a `users` row with role `Patient`.
4. API creates a linked `patients` profile and starts a session.
5. Patient is redirected to `public/patient/dashboard.php#dashboard`.

### Admin Or Doctor Creates Order

1. Admin or Doctor opens `Create Laboratory Order`.
2. Frontend loads patients, active facilities, and active tests from `app_data`.
3. Admin selects the requesting doctor; Doctor accounts are used automatically as the requester.
4. API creates `lab_orders` and `lab_order_items`.
5. API notifies Laboratory Staff and the patient.
6. API writes an audit log.

### Lab Processes Result

1. Lab staff sees assigned facility orders only.
2. Lab staff updates pre-result order statuses or uploads structured result findings.
3. Uploaded results start as `Pending Review`.
4. Lab staff verifies the result before release, or rejects it during review.
5. Released results notify the doctor and patient.

Orders with uploaded, verified, released, rejected, or cancelled result workflows cannot be moved backward with order-status actions. Those states are controlled by the result workflow.

### Doctor Adds Clinical Note

1. Doctor opens a result tied to their order.
2. Doctor saves a clinical note.
3. API inserts `clinical_notes`, notifies the patient, and writes an audit log.

### Patient Views Results

1. Patient opens `My Results`.
2. API returns only released results for the signed-in patient profile.
3. The result drawer shows structured values, lab findings, remarks, and the latest clinical note.

## Demo Credentials

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin123` |
| Doctor | `doctor` | `doctor123` |
| Laboratory Staff | `lab` | `lab123` |
| Patient | `patient` | `patient123` |

The login page demo buttons only autofill these database-backed credentials.

The `lab` demo user is assigned to two facilities in `staff_facilities`, including the facility with the seeded pending-review result.
The Admin user form exposes one Assigned Facility field for Laboratory Staff records; saving that form replaces the editable `staff_facilities` scope with the selected facility.
