-- Clinic System V2 - DEMO DATA FOR SUPABASE/POSTGRESQL
-- Run database/supabase_schema.sql first, then run this file once in Supabase SQL Editor.
-- DEMO ONLY: the credentials below are public and must never be used for real patient data.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users)
     OR EXISTS (SELECT 1 FROM roles)
     OR EXISTS (SELECT 1 FROM facilities)
     OR EXISTS (SELECT 1 FROM lab_orders) THEN
    RAISE EXCEPTION 'This seed is intended to run once on a fresh schema with no application data.';
  END IF;
END $$;

INSERT INTO roles (id, name, description) VALUES
  (1, 'Admin', 'System administrator with full access.'),
  (2, 'Doctor', 'Creates laboratory requests and reviews results.'),
  (3, 'Laboratory Staff', 'Processes laboratory requests and results.'),
  (4, 'Patient', 'Views personal requests and released results.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO facilities (id, name, address, phone, email, status) VALUES
  (1, 'Central Medical Center', '120 Rizal Avenue, Manila', '+63 2 8123 4567', 'central@example.test', 'Active'),
  (2, 'Northside Diagnostic Center', '48 Quezon Boulevard, Quezon City', '+63 2 8555 0192', 'northside@example.test', 'Active'),
  (3, 'Riverside Community Clinic', '76 Riverside Drive, Pasig', '+63 2 8638 2140', 'riverside@example.test', 'Active');

-- These are bcrypt hashes for the documented demo-only passwords.
INSERT INTO users (id, role_id, name, email, username, password_hash, avatar, contact, status) VALUES
  (1, 1, 'Admin User', 'admin@clinic.com', 'admin', '$2y$12$BjBVgvhl/4L7UNYkqqg8Ye3Cnz3yCgRILQrDzeLiHMFXrzvmD6VVO', 'AU', '+63 917 820 4621', 'Active'),
  (2, 2, 'Dr. Amelia Carter', 'doctor@clinic.com', 'doctor', '$2y$12$53pTfdXLy7rocyC4zvpL4OrEaq2MVXxfqWxf3GdaZAc8sSYEEE.sC', 'AC', '+63 917 804 2216', 'Active'),
  (3, 3, 'Laboratory Staff User', 'labstaff@clinic.com', 'lab', '$2y$12$wWI3.w6LCHT8tHrNjCG8.OelA3kd3iGSODCsznlPlA1hNYRbzOKhy', 'LS', '+63 917 542 1803', 'Active'),
  (4, 4, 'Sarah Johnson', 'patient@clinic.com', 'patient', '$2y$12$4u299uVHERBDy80D0uv9GulSOfswcQ2ww1CJTKNFZGJ1Pt.FLPemS', 'SJ', '+63 917 482 1064', 'Active'),
  (5, 2, 'Dr. Gabriel Cruz', 'gabriel.cruz@example.test', 'gcruz', '$2y$12$53pTfdXLy7rocyC4zvpL4OrEaq2MVXxfqWxf3GdaZAc8sSYEEE.sC', 'GC', '+63 917 110 2244', 'Active'),
  (6, 3, 'Marco Villanueva', 'marco.v@example.test', 'marco', '$2y$12$wWI3.w6LCHT8tHrNjCG8.OelA3kd3iGSODCsznlPlA1hNYRbzOKhy', 'MV', '+63 917 772 1984', 'Active'),
  (7, 4, 'Maria Santos', 'maria.santos@example.test', 'maria.santos', '$2y$12$4u299uVHERBDy80D0uv9GulSOfswcQ2ww1CJTKNFZGJ1Pt.FLPemS', 'MS', '+63 917 230 1111', 'Active'),
  (8, 4, 'Daniel Chua', 'daniel.chua@example.test', 'daniel.chua', '$2y$12$4u299uVHERBDy80D0uv9GulSOfswcQ2ww1CJTKNFZGJ1Pt.FLPemS', 'DC', '+63 917 230 2222', 'Active'),
  (9, 4, 'Elena Garcia', 'elena.garcia@example.test', 'elena.garcia', '$2y$12$4u299uVHERBDy80D0uv9GulSOfswcQ2ww1CJTKNFZGJ1Pt.FLPemS', 'EG', '+63 917 230 3333', 'Active');

INSERT INTO patients (id, user_id, patient_code, date_of_birth, sex, address, primary_facility_id, emergency_contact_name, emergency_contact_phone) VALUES
  (1, 4, 'PT-10492', DATE '1992-03-14', 'Female', '28 Sampaguita Street, Quezon City', 1, 'Michael Johnson', '+63 917 502 7781'),
  (2, 7, 'PT-20410', DATE '1989-06-11', 'Female', '14 Mabini Street, Manila', 1, 'Ramon Santos', '+63 917 802 7711'),
  (3, 8, 'PT-20411', DATE '1985-09-03', 'Male', '48 Luna Avenue, Quezon City', 2, 'Angela Chua', '+63 917 802 7722'),
  (4, 9, 'PT-88302', DATE '1978-12-21', 'Female', '8 Riverside Drive, Pasig', 3, 'Luis Garcia', '+63 917 802 7733');

INSERT INTO doctors (id, user_id, specialty, assigned_facility_id, license_no) VALUES
  (1, 2, 'Internal Medicine', 1, 'MD-DEMO-001'),
  (2, 5, 'Family Medicine', 2, 'MD-DEMO-002');

INSERT INTO laboratory_staff (id, user_id, employee_no, default_facility_id, department) VALUES
  (1, 3, 'LAB-DEMO-001', 1, 'Hematology'),
  (2, 6, 'LAB-DEMO-002', 2, 'Clinical Chemistry');

INSERT INTO staff_facilities (id, user_id, facility_id) VALUES
  (1, 3, 1), (2, 3, 2), (3, 6, 1), (4, 6, 2), (5, 6, 3);

INSERT INTO test_definitions (id, code, name, category, sample_type, turnaround_time, price, reference_range, instructions, status) VALUES
  (1, 'CBC', 'Complete Blood Count', 'Hematology', 'Whole Blood', '4 hours', 650.00, 'See parameter ranges', 'No fasting required.', 'Active'),
  (2, 'CMP', 'Comprehensive Metabolic Panel', 'Clinical Chemistry', 'Serum', '8 hours', 1250.00, 'Panel dependent', 'Fasting preferred.', 'Active'),
  (3, 'LIPID', 'Lipid Profile', 'Clinical Chemistry', 'Serum', '6 hours', 1200.00, 'Panel dependent', 'Fast for 8-12 hours.', 'Active'),
  (4, 'HBA1C', 'Hemoglobin A1c', 'Clinical Chemistry', 'Whole Blood', '6 hours', 950.00, '< 5.7%', 'No fasting required.', 'Active'),
  (5, 'THYROID', 'Thyroid Panel', 'Immunology', 'Serum', '24 hours', 1800.00, 'Panel dependent', 'Collect serum sample.', 'Active'),
  (6, 'UA', 'Urinalysis', 'Clinical Microscopy', 'Urine', '3 hours', 380.00, 'Normal microscopy', 'Use a clean-catch specimen.', 'Active'),
  (7, 'CRP', 'C-Reactive Protein', 'Immunology', 'Serum', '8 hours', 1100.00, '< 10 mg/L', 'Collect serum sample.', 'Active'),
  (8, 'ESR', 'Erythrocyte Sedimentation Rate', 'Hematology', 'Whole Blood', '6 hours', 700.00, '0-20 mm/hr', 'Collect EDTA blood.', 'Inactive');

-- Current workflow examples.
INSERT INTO lab_orders (id, order_number, patient_id, doctor_id, facility_id, priority, status, clinical_notes, latest_update, created_at) VALUES
  (1, 'DEMO-LAB-0001', 1, 2, 1, 'Priority', 'Released', 'Persistent fatigue and fever.', 'Result released', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  (2, 'DEMO-LAB-0002', 3, 2, 2, 'Regular', 'Processing', 'Routine lipid monitoring.', 'Sample processing', CURRENT_TIMESTAMP - INTERVAL '5 hours'),
  (3, 'DEMO-LAB-0003', 4, 2, 3, 'Priority', 'Sample Collected', 'Thyroid and glucose monitoring.', 'Sample collected', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  (4, 'DEMO-LAB-0004', 2, 5, 1, 'Regular', 'Verified', 'Repeat CBC after respiratory symptoms.', 'Result verified', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (5, 'DEMO-LAB-0005', 2, 5, 2, 'Priority', 'Released', 'Inflammatory marker monitoring.', 'Result released', CURRENT_TIMESTAMP - INTERVAL '3 days'),
  (6, 'DEMO-LAB-0006', 1, 2, 1, 'Regular', 'Pending Sample', 'Urinalysis before follow-up.', 'Collection scheduled', CURRENT_TIMESTAMP - INTERVAL '4 days'),
  (7, 'DEMO-LAB-0007', 4, 5, 3, 'Regular', 'Result Uploaded', 'Annual thyroid review.', 'Awaiting review', CURRENT_TIMESTAMP - INTERVAL '5 days'),
  (8, 'DEMO-LAB-0008', 3, 5, 2, 'Regular', 'Cancelled', 'Patient rescheduled.', 'Request cancelled', CURRENT_TIMESTAMP - INTERVAL '6 days');

-- Historical requests provide meaningful utilization and forecasting charts.
INSERT INTO lab_orders (id, order_number, patient_id, doctor_id, facility_id, priority, status, clinical_notes, latest_update, created_at)
SELECT
  100 + day_no,
  'DEMO-HIST-' || LPAD(day_no::text, 4, '0'),
  1 + ((day_no - 1) % 4),
  CASE WHEN day_no % 2 = 0 THEN 2 ELSE 5 END,
  1 + ((day_no - 1) % 3),
  CASE WHEN day_no % 5 = 0 THEN 'Priority' ELSE 'Regular' END,
  CASE day_no % 6
    WHEN 0 THEN 'Released'
    WHEN 1 THEN 'Verified'
    WHEN 2 THEN 'Processing'
    WHEN 3 THEN 'Sample Collected'
    WHEN 4 THEN 'Pending Sample'
    ELSE 'Result Uploaded'
  END,
  'Generated demonstration request for analytics.',
  'Historical demonstration activity',
  CURRENT_TIMESTAMP - (day_no || ' days')::interval
FROM generate_series(1, 42) AS day_no;

INSERT INTO lab_order_items (order_id, test_definition_id, test_name, status)
SELECT
  lo.id,
  1 + ((lo.id - 1) % 7),
  td.name,
  lo.status
FROM lab_orders lo
JOIN test_definitions td ON td.id = 1 + ((lo.id - 1) % 7)
WHERE lo.order_number LIKE 'DEMO-%';

-- Add a second test to selected requests so test volume differs from request volume.
INSERT INTO lab_order_items (order_id, test_definition_id, test_name, status)
SELECT lo.id, 1, td.name, lo.status
FROM lab_orders lo
JOIN test_definitions td ON td.id = 1
WHERE lo.order_number LIKE 'DEMO-%'
  AND lo.id % 4 = 0
  AND NOT EXISTS (
    SELECT 1 FROM lab_order_items li WHERE li.order_id = lo.id AND li.test_definition_id = 1
  );

INSERT INTO lab_results (id, result_number, order_id, uploaded_by, reviewed_by, status, findings, remarks, verified_at, released_at, created_at) VALUES
  (1, 'DEMO-RES-0001', 1, 3, 6, 'Released', 'CBC and metabolic values are within expected ranges.', 'Quality control passed.', CURRENT_TIMESTAMP - INTERVAL '90 minutes', CURRENT_TIMESTAMP - INTERVAL '60 minutes', CURRENT_TIMESTAMP - INTERVAL '110 minutes'),
  (2, 'DEMO-RES-0002', 4, 6, 6, 'Verified', 'WBC is mildly elevated. Correlate clinically.', 'Specimen quality accepted.', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (3, 'DEMO-RES-0003', 5, 3, 6, 'Released', 'CRP improved compared with the prior sample.', 'Quality control passed.', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '3 days'),
  (4, 'DEMO-RES-0004', 7, 6, NULL, 'Pending Review', 'Thyroid values entered for review.', 'Pending senior review.', NULL, NULL, CURRENT_TIMESTAMP - INTERVAL '4 days');

INSERT INTO lab_results (id, result_number, order_id, uploaded_by, reviewed_by, status, findings, remarks, verified_at, released_at, created_at)
SELECT
  100 + ROW_NUMBER() OVER (ORDER BY lo.id),
  'DEMO-HRES-' || LPAD(lo.id::text, 4, '0'),
  lo.id,
  CASE WHEN lo.id % 2 = 0 THEN 3 ELSE 6 END,
  6,
  CASE WHEN lo.status = 'Released' THEN 'Released' ELSE 'Verified' END,
  'Historical demonstration result; values reviewed for dashboard analytics.',
  'Automated demo quality-control entry.',
  lo.created_at + INTERVAL '5 hours',
  CASE WHEN lo.status = 'Released' THEN lo.created_at + INTERVAL '6 hours' ELSE NULL END,
  lo.created_at + INTERVAL '4 hours'
FROM lab_orders lo
WHERE lo.order_number LIKE 'DEMO-HIST-%'
  AND lo.status IN ('Released', 'Verified');

INSERT INTO lab_result_values (result_id, test_definition_id, parameter_name, value_text, unit, reference_range, flag) VALUES
  (1, 1, 'WBC', '7.2', 'x10^9/L', '4.5-11.0', 'Regular'),
  (1, 1, 'RBC', '4.62', 'x10^12/L', '4.2-5.4', 'Regular'),
  (1, 1, 'Hemoglobin', '13.8', 'g/dL', '12.0-15.5', 'Regular'),
  (1, 1, 'Platelets', '274', 'x10^9/L', '150-450', 'Regular'),
  (2, 1, 'WBC', '12.4', 'x10^9/L', '4.5-11.0', 'Priority'),
  (2, 1, 'Hemoglobin', '14.2', 'g/dL', '13.5-17.5', 'Regular'),
  (3, 7, 'CRP', '8.4', 'mg/L', '< 10', 'Regular'),
  (4, 5, 'TSH', '2.7', 'mIU/L', '0.4-4.0', 'Regular');

INSERT INTO lab_result_values (result_id, test_definition_id, parameter_name, value_text, unit, reference_range, flag)
SELECT lr.id, 1, 'WBC', (6.0 + (lr.id % 40) / 10.0)::numeric(4,1)::text, 'x10^9/L', '4.5-11.0', 'Regular'
FROM lab_results lr
WHERE lr.result_number LIKE 'DEMO-HRES-%';

INSERT INTO clinical_notes (result_id, doctor_id, note, created_at) VALUES
  (1, 2, 'Values are acceptable. Continue the current care plan.', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
  (2, 2, 'Repeat CBC if symptoms persist.', CURRENT_TIMESTAMP - INTERVAL '20 hours'),
  (3, 5, 'Inflammatory marker is improving. Continue scheduled follow-up.', CURRENT_TIMESTAMP - INTERVAL '36 hours');

-- No result_files rows are seeded because they must reference real private Storage objects.
INSERT INTO notifications (user_id, patient_id, role_name, title, message, type_name, related_order_id, related_result_id, is_read, created_at) VALUES
  (NULL, NULL, 'Laboratory Staff', 'New laboratory request received', 'DEMO-LAB-0006 is ready for intake.', 'orders', 6, NULL, 0, CURRENT_TIMESTAMP - INTERVAL '4 hours'),
  (NULL, 1, NULL, 'New result released', 'Your CBC result is available.', 'results', 1, 1, 0, CURRENT_TIMESTAMP - INTERVAL '55 minutes'),
  (2, NULL, NULL, 'New result available', 'A result is ready for clinical review.', 'results', 1, 1, 0, CURRENT_TIMESTAMP - INTERVAL '50 minutes'),
  (2, NULL, NULL, 'Request status updated', 'DEMO-LAB-0004 is verified.', 'orders', 4, 2, 0, CURRENT_TIMESTAMP - INTERVAL '1 day'),
  (NULL, NULL, 'Laboratory Staff', 'Result pending review', 'DEMO-RES-0004 is awaiting review.', 'results', 7, 4, 0, CURRENT_TIMESTAMP - INTERVAL '4 days'),
  (NULL, 2, NULL, 'Result released', 'Your CRP result is available.', 'results', 5, 3, 0, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (NULL, NULL, 'Admin', 'New patient registered', 'A demonstration patient was added.', 'users', NULL, NULL, 1, CURRENT_TIMESTAMP - INTERVAL '3 days');

INSERT INTO audit_logs (user_id, user_name, role_name, action, module, details, ip_address, created_at) VALUES
  (1, 'Admin User', 'Admin', 'LOGIN', 'Authentication', 'Successful demonstration login', '127.0.0.1', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
  (2, 'Dr. Amelia Carter', 'Doctor', 'CREATE', 'Laboratory Request', 'Submitted DEMO-LAB-0001', '127.0.0.1', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  (3, 'Laboratory Staff User', 'Laboratory Staff', 'CREATE', 'Result', 'Uploaded DEMO-RES-0001', '127.0.0.1', CURRENT_TIMESTAMP - INTERVAL '110 minutes'),
  (6, 'Marco Villanueva', 'Laboratory Staff', 'RELEASE', 'Result', 'Released DEMO-RES-0001', '127.0.0.1', CURRENT_TIMESTAMP - INTERVAL '60 minutes'),
  (2, 'Dr. Amelia Carter', 'Doctor', 'UPDATE', 'Result', 'Added clinical note to DEMO-RES-0001', '127.0.0.1', CURRENT_TIMESTAMP - INTERVAL '45 minutes');

UPDATE maintenance_settings
SET is_enabled = 0,
    scope = 'all',
    affected_roles = '["Doctor","Laboratory Staff","Patient"]',
    affected_pages = '[]',
    created_by = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('clinic_name', 'Centralized Laboratory Results System - Demo'),
  ('default_facility_id', '1'),
  ('result_release_policy', 'Only released results are visible to patients.'),
  ('audit_retention_days', '365')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = CURRENT_TIMESTAMP;

-- Advance identity sequences after inserting explicit demo IDs.
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'roles', 'facilities', 'users', 'patients', 'doctors', 'laboratory_staff',
    'staff_facilities', 'test_definitions', 'lab_orders', 'lab_order_items',
    'lab_results', 'lab_result_values', 'clinical_notes', 'notifications', 'audit_logs'
  ] LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM %I',
      table_name, 'id', table_name
    );
  END LOOP;
END $$;

COMMIT;

-- Summary returned by Supabase SQL Editor after a successful seed.
SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM patients) AS patients,
  (SELECT COUNT(*) FROM facilities) AS facilities,
  (SELECT COUNT(*) FROM test_definitions) AS tests,
  (SELECT COUNT(*) FROM lab_orders) AS laboratory_requests,
  (SELECT COUNT(*) FROM lab_results) AS results,
  (SELECT COUNT(*) FROM notifications) AS notifications,
  (SELECT COUNT(*) FROM audit_logs) AS audit_entries;
