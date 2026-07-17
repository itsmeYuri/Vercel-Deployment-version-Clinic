USE clinic_system_v2;

CREATE TABLE IF NOT EXISTS maintenance_settings (
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
  INDEX idx_maintenance_enabled (is_enabled),
  INDEX idx_maintenance_created (created_at),
  CONSTRAINT fk_maintenance_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS result_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  result_id INT NOT NULL,
  original_name VARCHAR(180) NOT NULL,
  stored_name VARCHAR(180) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_result_files_result FOREIGN KEY (result_id) REFERENCES lab_results(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE lab_orders
SET priority = CASE
  WHEN priority IN ('Urgent', 'High', 'Priority') THEN 'Priority'
  ELSE 'Regular'
END;

ALTER TABLE lab_orders
  MODIFY priority VARCHAR(40) NOT NULL DEFAULT 'Regular';

INSERT INTO maintenance_settings
  (id, is_enabled, scope, affected_roles, affected_pages, message, reason, start_at, end_at, created_by)
SELECT
  1, 0, 'all', '["Doctor","Laboratory Staff","Patient"]', '[]',
  'The system is currently undergoing maintenance. Please try again later.',
  NULL, NULL, NULL, (SELECT MIN(u.id) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'Admin')
WHERE NOT EXISTS (SELECT 1 FROM maintenance_settings WHERE id = 1);

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('clinic_name', 'Centralized Laboratory Results System')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
