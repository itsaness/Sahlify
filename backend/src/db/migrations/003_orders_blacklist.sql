-- Per-store phone blacklist for anti-fake-order protection
CREATE TABLE IF NOT EXISTS store_phone_blacklist (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, phone)
);
