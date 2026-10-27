# Result explanation migration

Existing Supabase PostgreSQL databases: run `20261027_result_explanations.sql` in the SQL Editor before deploying code that reads explanations. It creates one new table and changes no existing records. Fresh installations get the same table from `database/supabase_schema.sql`; do not rerun that whole schema against an existing database just for this feature.

Local MySQL databases: run `20261027_result_explanations.mysql.sql` once before starting the updated application. The migration uses `CREATE TABLE IF NOT EXISTS` and leaves existing rows intact.

Rollback: stop using the explanation feature, export any explanation rows that need to be retained, then drop `result_explanations`. Dropping that table deletes those explanation drafts and approvals; it does not delete laboratory results. Review the exported data before any rollback.

The PostgreSQL table has RLS enabled and no browser-access policy. The authenticated PHP backend remains the only application path for reads and writes. The application database role must have permission to use the new table.
