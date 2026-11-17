-- Security hardening: key versioning, custom domain verification, and audit log

ALTER TABLE store_integrations
  ADD COLUMN IF NOT EXISTS key_version SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_token TEXT;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_store_idx ON audit_log(store_id, created_at DESC);
