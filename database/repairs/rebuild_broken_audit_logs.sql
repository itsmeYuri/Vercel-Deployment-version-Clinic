USE clinic_system_v2;

-- Manual recovery only for MySQL/MariaDB error 1932, where audit_logs remains
-- in the schema dictionary but its InnoDB table cannot be opened. Do not run
-- this script against a healthy audit_logs table because it removes its rows.
-- Back up all readable tables before applying this repair.
DROP TABLE IF EXISTS audit_logs;

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
