-- Run once in local MySQL or MariaDB before publishing laboratory packages.
CREATE TABLE IF NOT EXISTS lab_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lab_packages_public (status, display_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS lab_package_tests (
  package_id INT NOT NULL,
  test_id INT NOT NULL,
  PRIMARY KEY (package_id, test_id),
  INDEX idx_lab_package_tests_test (test_id),
  CONSTRAINT fk_lab_package_tests_package FOREIGN KEY (package_id) REFERENCES lab_packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_lab_package_tests_test FOREIGN KEY (test_id) REFERENCES test_definitions(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
