-- Apply to an existing PostgreSQL clinic database before enabling MFA or Google sign-in.
BEGIN;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS mfa_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS pending_mfa_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS pending_mfa_expires_at TIMESTAMPTZ;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS oauth_flow TEXT;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS recent_auth_at TIMESTAMPTZ;
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS auth_notice TEXT;

CREATE TABLE IF NOT EXISTS user_mfa (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_ciphertext TEXT NOT NULL,
  pending_expires_at TIMESTAMPTZ,
  enabled_at TIMESTAMPTZ,
  last_accepted_step BIGINT
);
CREATE TABLE IF NOT EXISTS user_mfa_recovery (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash CHAR(64) NOT NULL,
  PRIMARY KEY (user_id, code_hash)
);
CREATE TABLE IF NOT EXISTS user_google_identities (
  issuer VARCHAR(80) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (issuer, subject),
  UNIQUE (user_id)
);
ALTER TABLE user_mfa ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mfa_recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_google_identities ENABLE ROW LEVEL SECURITY;
COMMIT;
