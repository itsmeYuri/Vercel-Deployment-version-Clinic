-- MariaDB local development migration. Apply after importing the existing MySQL schema.
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INT NULL,
  csrf_token CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  mfa_verified TINYINT(1) NOT NULL DEFAULT 0,
  pending_mfa_user_id INT NULL,
  pending_mfa_expires_at DATETIME NULL,
  oauth_flow TEXT NULL,
  recent_auth_at DATETIME NULL,
  auth_notice TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_auth_sessions_expiry (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pending_mfa_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS mfa_verified TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS pending_mfa_user_id INT NULL;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS pending_mfa_expires_at DATETIME NULL;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS oauth_flow TEXT NULL;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS recent_auth_at DATETIME NULL;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS auth_notice TEXT NULL;

CREATE TABLE IF NOT EXISTS user_mfa (
  user_id INT PRIMARY KEY,
  secret_ciphertext TEXT NOT NULL,
  pending_expires_at DATETIME NULL,
  enabled_at DATETIME NULL,
  last_accepted_step BIGINT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_mfa_recovery (
  user_id INT NOT NULL,
  code_hash CHAR(64) NOT NULL,
  PRIMARY KEY (user_id, code_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_google_identities (
  issuer VARCHAR(80) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  user_id INT NOT NULL UNIQUE,
  linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (issuer, subject),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
