SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS clinic_system_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clinic_system_v2;

DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS auth_login_attempts;
DROP TABLE IF EXISTS maintenance_settings;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS clinical_notes;
DROP TABLE IF EXISTS result_files;
DROP TABLE IF EXISTS lab_result_values;
DROP TABLE IF EXISTS result_workflow_events;
DROP TABLE IF EXISTS lab_results;
DROP TABLE IF EXISTS lab_order_items;
DROP TABLE IF EXISTS lab_orders;
DROP TABLE IF EXISTS staff_facilities;
DROP TABLE IF EXISTS laboratory_staff;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS test_definitions;
DROP TABLE IF EXISTS facilities;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(180) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE facilities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(160) NULL,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_facilities_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(8) NOT NULL,
  contact VARCHAR(40) NULL,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_users_role_status (role_id, status),
  INDEX idx_users_email (email),
  INDEX idx_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  patient_code VARCHAR(32) NOT NULL UNIQUE,
  date_of_birth DATE NULL,
  sex VARCHAR(40) NULL,
  address VARCHAR(255) NULL,
  primary_facility_id INT NULL,
  emergency_contact_name VARCHAR(120) NULL,
  emergency_contact_phone VARCHAR(40) NULL,
  privacy_acknowledged TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_patients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_patients_facility FOREIGN KEY (primary_facility_id) REFERENCES facilities(id) ON DELETE SET NULL,
  INDEX idx_patients_facility (primary_facility_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  specialty VARCHAR(120) NULL,
  assigned_facility_id INT NULL,
  license_no VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doctors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_doctors_facility FOREIGN KEY (assigned_facility_id) REFERENCES facilities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE laboratory_staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  employee_no VARCHAR(80) NULL,
  default_facility_id INT NULL,
  department VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lab_staff_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_lab_staff_facility FOREIGN KEY (default_facility_id) REFERENCES facilities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE staff_facilities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  facility_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_facilities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_facilities_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  UNIQUE KEY uq_staff_facility (user_id, facility_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE test_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(100) NOT NULL,
  sample_type VARCHAR(80) NOT NULL,
  turnaround_time VARCHAR(80) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  reference_range VARCHAR(180) NULL,
  instructions TEXT NULL,
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tests_status_category (status, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lab_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  facility_id INT NOT NULL,
  priority VARCHAR(40) NOT NULL DEFAULT 'Regular',
  status VARCHAR(60) NOT NULL DEFAULT 'Pending',
  clinical_notes TEXT NULL,
  latest_update VARCHAR(180) NOT NULL DEFAULT 'Laboratory request submitted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_orders_doctor FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT fk_orders_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_doctor (doctor_id),
  INDEX idx_orders_patient (patient_id),
  INDEX idx_orders_facility (facility_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lab_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  test_definition_id INT NULL,
  test_name VARCHAR(160) NOT NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES lab_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_test FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id) ON DELETE SET NULL,
  INDEX idx_order_items_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lab_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  result_number VARCHAR(40) NOT NULL UNIQUE,
  order_id INT NOT NULL,
  uploaded_by INT NOT NULL,
  reviewed_by INT NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'Pending Review',
  findings TEXT NULL,
  remarks TEXT NULL,
  rejected_reason TEXT NULL,
  verified_at DATETIME NULL,
  released_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_results_order FOREIGN KEY (order_id) REFERENCES lab_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_results_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id),
  CONSTRAINT fk_results_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_results_status (status),
  INDEX idx_results_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lab_result_values (
  id INT AUTO_INCREMENT PRIMARY KEY,
  result_id INT NOT NULL,
  test_definition_id INT NULL,
  parameter_name VARCHAR(120) NOT NULL,
  value_text VARCHAR(120) NOT NULL,
  unit VARCHAR(60) NULL,
  reference_range VARCHAR(120) NULL,
  flag VARCHAR(40) NULL,
  CONSTRAINT fk_result_values_result FOREIGN KEY (result_id) REFERENCES lab_results(id) ON DELETE CASCADE,
  CONSTRAINT fk_result_values_test FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE result_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  result_id INT NOT NULL,
  original_name VARCHAR(180) NOT NULL,
  stored_name VARCHAR(180) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_result_files_result FOREIGN KEY (result_id) REFERENCES lab_results(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE clinical_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  result_id INT NOT NULL,
  doctor_id INT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clinical_notes_result FOREIGN KEY (result_id) REFERENCES lab_results(id) ON DELETE CASCADE,
  CONSTRAINT fk_clinical_notes_doctor FOREIGN KEY (doctor_id) REFERENCES users(id),
  INDEX idx_notes_result (result_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  patient_id INT NULL,
  role_name VARCHAR(60) NULL,
  title VARCHAR(160) NOT NULL,
  message VARCHAR(255) NOT NULL,
  type_name VARCHAR(40) NOT NULL DEFAULT 'orders',
  related_order_id INT NULL,
  related_result_id INT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_order FOREIGN KEY (related_order_id) REFERENCES lab_orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_result FOREIGN KEY (related_result_id) REFERENCES lab_results(id) ON DELETE SET NULL,
  INDEX idx_notifications_user (user_id, is_read),
  INDEX idx_notifications_patient (patient_id, is_read),
  INDEX idx_notifications_role (role_name, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_name VARCHAR(120) NOT NULL,
  role_name VARCHAR(60) NOT NULL,
  action VARCHAR(40) NOT NULL,
  module VARCHAR(80) NOT NULL,
  details VARCHAR(255) NOT NULL,
  ip_address VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_settings (
  id INT NOT NULL PRIMARY KEY,
  is_enabled TINYINT(1) NOT NULL DEFAULT 0,
  scope VARCHAR(40) NOT NULL DEFAULT 'all',
  affected_roles TEXT NULL,
  affected_pages TEXT NULL,
  message VARCHAR(255) NOT NULL DEFAULT 'The system is currently undergoing maintenance. Please try again later.',
  reason VARCHAR(255) NULL,
  start_at DATETIME NULL,
  end_at DATETIME NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_maintenance_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_maintenance_enabled (is_enabled),
  INDEX idx_maintenance_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE system_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE result_workflow_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  result_id INT NOT NULL,
  user_id INT NULL,
  action VARCHAR(30) NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_workflow_result FOREIGN KEY (result_id) REFERENCES lab_results(id) ON DELETE CASCADE,
  CONSTRAINT fk_workflow_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_result_workflow_result (result_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_login_attempts (
  key_hash CHAR(64) PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  blocked_until DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_login_attempts_blocked (blocked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (id, name, description) VALUES
(1, 'Admin', 'System administrator with full access.'),
(2, 'Doctor', 'Clinical user who submits laboratory requests and reviews results.'),
(3, 'Laboratory Staff', 'Laboratory operations user who processes requests and results.'),
(4, 'Patient', 'Patient portal account with access to personal records.');

INSERT INTO facilities (id, name, address, phone, email, status) VALUES
(1, 'Central Medical Center', '120 Rizal Avenue, Manila', '+63 2 8123 4567', 'central@clinic.local', 'Active'),
(2, 'Northside Diagnostic', '48 Quezon Boulevard, Quezon City', '+63 2 8555 0192', 'northside@clinic.local', 'Active'),
(3, 'Riverside Clinic', '76 Riverside Drive, Pasig', '+63 2 8638 2140', 'riverside@clinic.local', 'Active'),
(4, 'Westbrook Health Hub', '19 Westbrook Road, Makati', '+63 2 8821 9073', 'westbrook@clinic.local', 'Active');

-- Demo passwords use bcrypt hashes; the SQL file contains no plain-text passwords.
INSERT INTO users (id, role_id, name, email, username, password_hash, avatar, contact, status) VALUES
(1, 1, 'Admin User', 'admin@clinic.com', 'admin', '$2y$12$BjBVgvhl/4L7UNYkqqg8Ye3Cnz3yCgRILQrDzeLiHMFXrzvmD6VVO', 'AU', '+63 917 820 4621', 'Active'),
(2, 2, 'Dr. Amelia Carter', 'doctor@clinic.com', 'doctor', '$2y$12$53pTfdXLy7rocyC4zvpL4OrEaq2MVXxfqWxf3GdaZAc8sSYEEE.sC', 'AC', '+63 917 804 2216', 'Active'),
(3, 3, 'Lab Staff User', 'labstaff@clinic.com', 'lab', '$2y$12$wWI3.w6LCHT8tHrNjCG8.OelA3kd3iGSODCsznlPlA1hNYRbzOKhy', 'LS', '+63 917 542 1803', 'Active'),
(4, 4, 'Sarah Johnson', 'patient@clinic.com', 'patient', '$2y$12$4u299uVHERBDy80D0uv9GulSOfswcQ2ww1CJTKNFZGJ1Pt.FLPemS', 'SJ', '+63 917 482 1064', 'Active'),
(5, 2, 'Dr. Gabriel Cruz', 'gabriel.cruz@clinic.com', 'gcruz', '$2y$12$53pTfdXLy7rocyC4zvpL4OrEaq2MVXxfqWxf3GdaZAc8sSYEEE.sC', 'GC', '+63 917 110 2244', 'Active'),
(6, 2, 'Dr. Amelia Reyes', 'amelia.reyes@clinic.com', 'areyes', '$2y$12$53pTfdXLy7rocyC4zvpL4OrEaq2MVXxfqWxf3GdaZAc8sSYEEE.sC', 'AR', '+63 917 210 8451', 'Active'),
(7, 3, 'Marco Villanueva', 'marco.v@clinic.com', 'marco', '$2y$12$wWI3.w6LCHT8tHrNjCG8.OelA3kd3iGSODCsznlPlA1hNYRbzOKhy', 'MV', '+63 917 772 1984', 'Active'),
(8, 3, 'Sofia Ramos', 'sofia.ramos@clinic.com', 'sofia', '$2y$12$wWI3.w6LCHT8tHrNjCG8.OelA3kd3iGSODCsznlPlA1hNYRbzOKhy', 'SR', '+63 917 883 1204', 'Active'),
(9, 4, 'Maria Santos', 'maria.santos@example.com', 'maria.santos', '$2y$12$4u299uVHERBDy80D0uv9GulSOfswcQ2ww1CJTKNFZGJ1Pt.FLPemS', 'MS', '+63 917 230 1111', 'Active'),
(10, 4, 'Daniel Chua', 'daniel.chua@example.com', 'daniel.chua', '$2y$12$4u299uVHERBDy80D0uv9GulSOfswcQ2ww1CJTKNFZGJ1Pt.FLPemS', 'DC', '+63 917 230 2222', 'Active'),
(11, 4, 'Elena Garcia', 'elena.garcia@example.com', 'elena.garcia', '$2y$12$4u299uVHERBDy80D0uv9GulSOfswcQ2ww1CJTKNFZGJ1Pt.FLPemS', 'EG', '+63 917 230 3333', 'Active'),
(12, 4, 'John Mendoza', 'john.mendoza@example.com', 'john.mendoza', '$2y$12$4u299uVHERBDy80D0uv9GulSOfswcQ2ww1CJTKNFZGJ1Pt.FLPemS', 'JM', '+63 917 230 4444', 'Active');

INSERT INTO patients (id, user_id, patient_code, date_of_birth, sex, address, primary_facility_id, emergency_contact_name, emergency_contact_phone) VALUES
(1, 4, 'PT-10492', '1992-03-14', 'Female', '28 Sampaguita Street, Quezon City, Metro Manila', 1, 'Michael Johnson', '+63 917 502 7781'),
(2, 9, 'PT-20410', '1989-06-11', 'Female', '14 Mabini Street, Manila', 1, 'Ramon Santos', '+63 917 802 7711'),
(3, 10, 'PT-20411', '1985-09-03', 'Male', '48 Luna Avenue, Quezon City', 2, 'Angela Chua', '+63 917 802 7722'),
(4, 11, 'PT-88302', '1978-12-21', 'Female', '8 Riverside Drive, Pasig', 3, 'Luis Garcia', '+63 917 802 7733'),
(5, 12, 'PT-18440', '1991-02-18', 'Male', '91 Taft Avenue, Manila', 1, 'Carla Mendoza', '+63 917 802 7744');

INSERT INTO doctors (user_id, specialty, assigned_facility_id, license_no) VALUES
(2, 'Internal Medicine', 1, 'MD-2026-001'),
(5, 'Family Medicine', 2, 'MD-2026-002'),
(6, 'Endocrinology', 3, 'MD-2026-003');

INSERT INTO laboratory_staff (user_id, employee_no, default_facility_id, department) VALUES
(3, 'LAB-001', 1, 'Hematology'),
(7, 'LAB-002', 1, 'Clinical Chemistry'),
(8, 'LAB-003', 2, 'Immunology');

INSERT INTO staff_facilities (user_id, facility_id) VALUES
(3, 1),
(3, 2),
(7, 1),
(8, 2);

INSERT INTO test_definitions (id, code, name, category, sample_type, turnaround_time, price, reference_range, instructions, status) VALUES
(1, 'CBC', 'Complete Blood Count', 'Hematology', 'Whole Blood', '4 hours', 650.00, 'See parameter ranges', 'No fasting required.', 'Active'),
(2, 'CMP', 'Comprehensive Metabolic Panel', 'Clinical Chemistry', 'Serum', '8 hours', 1250.00, 'Panel dependent', 'Fasting preferred.', 'Active'),
(3, 'LIPID', 'Lipid Profile', 'Clinical Chemistry', 'Serum', '6 hours', 1200.00, 'Panel dependent', 'Fast for 8-12 hours.', 'Active'),
(4, 'HBA1C', 'Hemoglobin A1c', 'Clinical Chemistry', 'Whole Blood', '6 hours', 950.00, '< 5.7%', 'No fasting required.', 'Active'),
(5, 'THYROID', 'Thyroid Panel', 'Immunology', 'Serum', '24 hours', 1800.00, 'Panel dependent', 'Collect serum sample.', 'Active'),
(6, 'UA', 'Urinalysis', 'Clinical Microscopy', 'Urine', '3 hours', 380.00, 'Normal microscopy', 'Midstream clean-catch specimen.', 'Active'),
(7, 'CRP', 'C-Reactive Protein', 'Immunology', 'Serum', '8 hours', 1100.00, '< 10 mg/L', 'Collect serum sample.', 'Active'),
(8, 'ESR', 'Erythrocyte Sedimentation Rate', 'Hematology', 'Whole Blood', '6 hours', 700.00, '0-20 mm/hr', 'Collect EDTA blood.', 'Inactive');

INSERT INTO lab_orders (id, order_number, patient_id, doctor_id, facility_id, priority, status, clinical_notes, latest_update, created_at) VALUES
(1, 'LAB-2026-0842', 1, 2, 1, 'Priority', 'Released', 'Persistent fatigue and fever. Rule out infection.', 'Result released - 10:32 AM', '2026-06-25 08:14:00'),
(2, 'LAB-2026-0841', 3, 2, 2, 'Regular', 'Processing', 'Routine lipid monitoring.', 'Sample processed - 9:46 AM', '2026-06-25 09:01:00'),
(3, 'LAB-2026-0840', 4, 2, 3, 'Priority', 'Sample Collected', 'Follow-up thyroid and glucose monitoring.', 'Sample collected - 4:20 PM', '2026-06-24 16:20:00'),
(4, 'LAB-2026-0839', 5, 2, 1, 'Regular', 'Verified', 'Repeat CBC after respiratory symptoms.', 'Verified - Jun 24', '2026-06-24 10:08:00'),
(5, 'LAB-2026-0838', 2, 5, 2, 'Priority', 'Released', 'Inflammatory marker monitoring.', 'Result released - Jun 23', '2026-06-23 13:04:00'),
(6, 'LAB-2026-0837', 1, 2, 1, 'Regular', 'Pending Sample', 'Urinalysis before follow-up visit.', 'Collection scheduled', '2026-06-23 08:52:00'),
(7, 'LAB-2026-0836', 4, 6, 3, 'Regular', 'Sample Collected', 'Diabetes monitoring.', 'Sample collected - 8:15 AM', '2026-06-22 08:15:00'),
(8, 'LAB-2026-0835', 3, 5, 2, 'Regular', 'Result Uploaded', 'Thyroid panel annual review.', 'Awaiting review', '2026-06-22 11:42:00');

INSERT INTO lab_order_items (order_id, test_definition_id, test_name, status) VALUES
(1, 1, 'Complete Blood Count', 'Released'),
(1, 2, 'Comprehensive Metabolic Panel', 'Released'),
(2, 3, 'Lipid Profile', 'Processing'),
(3, 5, 'Thyroid Panel', 'Sample Collected'),
(3, 4, 'Hemoglobin A1c', 'Sample Collected'),
(4, 1, 'Complete Blood Count', 'Verified'),
(5, 7, 'C-Reactive Protein', 'Released'),
(6, 6, 'Urinalysis', 'Pending Sample'),
(7, 4, 'Hemoglobin A1c', 'Sample Collected'),
(8, 5, 'Thyroid Panel', 'Pending Review');

INSERT INTO lab_results (id, result_number, order_id, uploaded_by, reviewed_by, status, findings, remarks, verified_at, released_at, created_at) VALUES
(1, 'RES-260621', 1, 3, 7, 'Released', 'CBC parameters are within expected range. CMP values are clinically acceptable.', 'Specimen received in good condition. Quality control passed.', '2026-06-25 10:18:00', '2026-06-25 10:32:00', '2026-06-25 09:54:00'),
(2, 'RES-260620', 4, 7, 7, 'Verified', 'WBC is mildly elevated. Correlate clinically.', 'Specimen quality accepted.', '2026-06-24 16:18:00', NULL, '2026-06-24 15:31:00'),
(3, 'RES-260619', 5, 8, 8, 'Released', 'CRP has improved compared with previous sample.', 'Quality control passed.', '2026-06-23 14:16:00', '2026-06-23 14:42:00', '2026-06-23 13:46:00'),
(4, 'RES-260618', 8, 8, NULL, 'Pending Review', 'Thyroid panel values entered for review.', 'Pending senior review.', NULL, NULL, '2026-06-22 16:05:00');

INSERT INTO lab_result_values (result_id, test_definition_id, parameter_name, value_text, unit, reference_range, flag) VALUES
(1, 1, 'WBC', '7.2', 'x10^9/L', '4.5-11.0', 'Regular'),
(1, 1, 'RBC', '4.62', 'x10^12/L', '4.2-5.4', 'Regular'),
(1, 1, 'Hemoglobin', '13.8', 'g/dL', '12.0-15.5', 'Regular'),
(1, 1, 'Platelets', '274', 'x10^9/L', '150-450', 'Regular'),
(2, 1, 'WBC', '12.4', 'x10^9/L', '4.5-11.0', 'Priority'),
(2, 1, 'Hemoglobin', '14.2', 'g/dL', '13.5-17.5', 'Regular'),
(3, 7, 'CRP', '8.4', 'mg/L', '< 10', 'Regular'),
(4, 5, 'TSH', '2.7', 'mIU/L', '0.4-4.0', 'Regular');

INSERT INTO clinical_notes (result_id, doctor_id, note, created_at) VALUES
(1, 2, 'CBC and metabolic values are within acceptable range. Continue current care plan.', '2026-06-25 11:10:00'),
(2, 2, 'Repeat CBC if fever or respiratory symptoms persist.', '2026-06-24 17:25:00'),
(3, 5, 'Inflammatory marker is improving. Continue follow-up as scheduled.', '2026-06-23 15:10:00');

INSERT INTO notifications (user_id, patient_id, role_name, title, message, type_name, related_order_id, related_result_id, is_read, created_at) VALUES
(NULL, NULL, 'Laboratory Staff', 'New laboratory request received', 'LAB-2026-0837 is ready for laboratory intake.', 'orders', 6, NULL, 0, '2026-06-25 08:40:00'),
(NULL, 1, NULL, 'New result released', 'Your CBC result is now available to view.', 'results', 1, 1, 0, '2026-06-25 10:35:00'),
(2, NULL, NULL, 'New result available', 'CBC result for Sarah Johnson is ready for clinical review.', 'results', 1, 1, 0, '2026-06-25 10:34:00'),
(2, NULL, NULL, 'Laboratory request status updated', 'LAB-2026-0839 is now verified.', 'orders', 4, 2, 0, '2026-06-24 16:20:00'),
(NULL, NULL, 'Laboratory Staff', 'Result pending review', 'RES-260618 is waiting for laboratory review.', 'results', 8, 4, 0, '2026-06-22 16:06:00'),
(NULL, 2, NULL, 'Result released', 'Your C-Reactive Protein result is available.', 'results', 5, 3, 0, '2026-06-23 14:45:00'),
(NULL, NULL, 'Admin', 'New patient registered', 'Maria Santos was added to the patient list.', 'users', NULL, NULL, 1, '2026-06-23 08:00:00'),
(NULL, NULL, 'Admin', 'Facility workload changed', 'Northside Diagnostic has active priority laboratory requests.', 'facility', NULL, NULL, 0, '2026-06-25 09:12:00');

INSERT INTO audit_logs (user_id, user_name, role_name, action, module, details, ip_address, created_at) VALUES
(1, 'Admin User', 'Admin', 'LOGIN', 'Authentication', 'Successful login from local demo', '127.0.0.1', '2026-06-25 07:48:00'),
(2, 'Dr. Amelia Carter', 'Doctor', 'CREATE', 'Laboratory Request', 'Submitted LAB-2026-0842 for Sarah Johnson', '127.0.0.1', '2026-06-25 08:14:00'),
(3, 'Lab Staff User', 'Laboratory Staff', 'CREATE', 'Result', 'Uploaded RES-260621 for LAB-2026-0842', '127.0.0.1', '2026-06-25 09:54:00'),
(7, 'Marco Villanueva', 'Laboratory Staff', 'RELEASE', 'Result', 'Released RES-260621 to patient portal', '127.0.0.1', '2026-06-25 10:32:00'),
(2, 'Dr. Amelia Carter', 'Doctor', 'UPDATE', 'Result', 'Added clinical note to RES-260621', '127.0.0.1', '2026-06-25 11:10:00'),
(1, 'Admin User', 'Admin', 'UPDATE', 'Facility', 'Updated Central Medical Center staffing', '127.0.0.1', '2026-06-25 11:30:00');

INSERT INTO maintenance_settings (id, is_enabled, scope, affected_roles, affected_pages, message, reason, start_at, end_at, created_by) VALUES
(1, 0, 'all', '["Doctor","Laboratory Staff","Patient"]', '[]', 'The system is currently undergoing maintenance. Please try again later.', NULL, NULL, NULL, 1);

INSERT INTO system_settings (setting_key, setting_value) VALUES
('clinic_name', 'Centralized Laboratory Results System'),
('default_facility_id', '1'),
('result_release_policy', 'Only released results are visible to patients.'),
('audit_retention_days', '365');
