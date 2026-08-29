# Vercel + Supabase deployment

This deployment keeps the current PHP pages, CSS, JavaScript, navigation, role workflows, validation, and API behavior. MySQL and local file uploads remain available for local development; production selects PostgreSQL, database-backed sessions, and private Supabase Storage through environment variables.

## 1. Create the Supabase resources

1. Create a Supabase project.
2. Open **SQL Editor**, paste `database/supabase_schema.sql`, and run it once.
3. Confirm that the 18 application tables, `auth_sessions`, and the private `lab-results` bucket exist.
4. In **Project Settings > Database**, copy the transaction-pooler connection string. Use port `6543`, replace its password placeholder, and URL-encode special characters in the password.
5. In **Project Settings > API**, copy the project URL, anon key, and service-role key.

The service-role key deliberately bypasses Storage policies and must exist only as a Vercel server environment variable. The browser receives only short-lived, single-object signed URLs. Row Level Security is enabled without public table policies because all application database access remains behind the PHP API.

## 2. Migrate existing data

The PostgreSQL schema preserves all existing application tables, columns, relationships, uniqueness rules, delete behavior, indexes, and status constraints. `result_files.stored_name` is widened from 180 to 500 characters so it can hold a Supabase object path.

Export the existing MySQL tables as CSV and import them in this dependency order:

1. `roles`, `facilities`, `users`
2. `patients`, `doctors`, `laboratory_staff`, `staff_facilities`
3. `test_definitions`, `lab_orders`, `lab_order_items`
4. `lab_results`, `lab_result_values`, `result_files`, `clinical_notes`
5. `notifications`, `audit_logs`, `maintenance_settings`, `system_settings`

Do not import `auth_sessions`; it is production runtime state. After importing explicit numeric IDs, run the following in Supabase SQL Editor so new inserts continue after the imported IDs:

```sql
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'roles','facilities','users','patients','doctors','laboratory_staff',
    'staff_facilities','test_definitions','lab_orders','lab_order_items',
    'lab_results','lab_result_values','result_files','clinical_notes',
    'notifications','audit_logs'
  ] LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM %I',
      t, 'id', t
    );
  END LOOP;
END;
$$;
```

For existing result attachments, upload each file from `public/uploads/results/` into the private `lab-results` bucket. Use an object path such as `results/migrated/<stored_name>`, then update the matching `result_files.stored_name` value to that object path. The application creates signed downloads at request time.

The original demo installer remains at `database/clinic_system_v2.sql` for MySQL. Its `INSERT` statements can also be used as the source data for a fresh Supabase demo project after the PostgreSQL schema has been created.

## 3. Configure Vercel

Import the repository as a Vercel project and add these Production and Preview environment variables:

| Variable | Required value |
|---|---|
| `SUPABASE_DB_URL` | Supabase transaction-pooler PostgreSQL URL on port 6543 |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Project anon/public key; reserved for future public client use |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret service-role key, server-side only |
| `SUPABASE_STORAGE_BUCKET` | `lab-results` |
| `CLINIC_STORAGE_DRIVER` | `supabase` |
| `CLINIC_SESSION_DRIVER` | `database` |
| `CLINIC_SESSION_TTL` | `43200` |
| `CLINIC_COOKIE_SECURE` | `1` |
| `CLINIC_APP_TIMEZONE` | `Asia/Manila` |
| `CLINIC_APP_DEBUG` | `0` |

Do not add a trailing slash to `SUPABASE_URL`. If the database password contains `@`, `:`, `/`, `#`, `%`, or other URL-reserved characters, percent-encode it in `SUPABASE_DB_URL`.

`vercel.json` deploys `api/index.php` and `api/vercel.php` on `vercel-php`, serves the existing static assets directly, preserves `/public/...php` page paths, and maps all `/api/...` requests to the central API.

## 4. Verify after deployment

1. Open `/public/auth/login.php` and sign in with each role.
2. Verify dashboards, navigation, notifications, filters, and profile/settings pages.
3. Create a laboratory order and advance its status.
4. Upload and release a result with a PDF or image attachment, then download it as an authorized user.
5. Confirm an unauthorized role cannot access restricted pages or result attachments.
6. Verify `/api/index.php?action=health` returns a successful PostgreSQL response.
7. Confirm Vercel logs contain no missing environment variable, PDO, or Storage errors.

## Operational notes

- The app continues to own authentication and password hashes; Supabase Auth is not substituted because doing so would change current authentication behavior and user IDs.
- Vercel functions have ephemeral local filesystems. Production sessions therefore use `auth_sessions`, and result attachments use Supabase Storage.
- Direct signed uploads keep attachment bodies outside the Vercel function request-size limit. A failed result-save request can leave an unreferenced object in Storage; periodically remove objects that have no matching `result_files.stored_name` row.
- Point-in-time backups, database password rotation, and service-role key rotation are managed in the Supabase/Vercel dashboards.
