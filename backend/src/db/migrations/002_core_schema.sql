-- Sahlify core multi-tenant schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Platform plans (cloud billing)
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_dzd INTEGER NOT NULL CHECK (price_dzd >= 0),
  interval_months INTEGER NOT NULL DEFAULT 1 CHECK (interval_months > 0),
  ai_quota JSONB NOT NULL DEFAULT '{"generations": 20, "edits": 200}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Stores (each store is a tenant; 1 subscription = 1 store on cloud)
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'suspended')),
  language TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'fr', 'en')),
  cod_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  online_payment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  capi_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stores_owner_id_idx ON stores(owner_id);

-- 3. Per-store subscriptions (cloud mode)
CREATE TABLE IF NOT EXISTS store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'past_due', 'suspended')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_subscription_id UUID NOT NULL REFERENCES store_subscriptions(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  chargily_checkout_id TEXT UNIQUE,
  amount_dzd INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscription_payments_sub_idx ON subscription_payments(store_subscription_id);

-- 4. Store themes (validated JSON only; supports draft / published / rollback)
CREATE TABLE IF NOT EXISTS store_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  theme JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'user' CHECK (created_by IN ('user', 'ai')),
  prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, version)
);

CREATE INDEX IF NOT EXISTS store_themes_store_status_idx ON store_themes(store_id, status);

-- 5. AI usage tracking (quotas + real token cost tracking)
CREATE TABLE IF NOT EXISTS ai_usage (
  id BIGSERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('theme', 'edit', 'copy')),
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_store_month_idx ON ai_usage(store_id, created_at);

-- 6. Algerian wilayas & communes
CREATE TABLE IF NOT EXISTS wilayas (
  id SMALLINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS communes (
  id INTEGER PRIMARY KEY,
  wilaya_id SMALLINT NOT NULL REFERENCES wilayas(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_fr TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS communes_wilaya_idx ON communes(wilaya_id);

-- 7. Carriers registry (platform-family adapters + data-driven carrier rows)
CREATE TABLE IF NOT EXISTS carriers (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('yalidine', 'ecotrack', 'procolis', 'maystro', 'noest', 'manual')),
  base_url TEXT,
  credential_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  supports_webhook BOOLEAN NOT NULL DEFAULT FALSE,
  supports_stopdesk BOOLEAN NOT NULL DEFAULT TRUE,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carrier_locations (
  carrier_id INTEGER NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  wilaya_id SMALLINT NOT NULL REFERENCES wilayas(id) ON DELETE CASCADE,
  commune_id INTEGER REFERENCES communes(id) ON DELETE CASCADE,
  external_code TEXT NOT NULL,
  PRIMARY KEY (carrier_id, wilaya_id, external_code)
);

-- 8. Store integrations (encrypted credentials for Chargily, Meta, and carriers)
CREATE TABLE IF NOT EXISTS store_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('chargily', 'meta', 'carrier')),
  carrier_id INTEGER REFERENCES carriers(id) ON DELETE RESTRICT,
  credentials_enc BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS store_integrations_noncarrier_uniq
  ON store_integrations(store_id, provider)
  WHERE provider <> 'carrier';

CREATE UNIQUE INDEX IF NOT EXISTS store_integrations_carrier_uniq
  ON store_integrations(store_id, carrier_id)
  WHERE provider = 'carrier';

-- 9. Store shipping rates (fallback when carrier API has no fee lookup)
CREATE TABLE IF NOT EXISTS shipping_rates (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  carrier_id INTEGER NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
  wilaya_id SMALLINT NOT NULL REFERENCES wilayas(id) ON DELETE CASCADE,
  home_price_dzd INTEGER NOT NULL DEFAULT 0,
  stopdesk_price_dzd INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, carrier_id, wilaya_id)
);

-- 10. Catalog
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_dzd INTEGER NOT NULL CHECK (price_dzd >= 0),
  compare_at_dzd INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  weight_grams INTEGER,
  sku TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, slug)
);

CREATE INDEX IF NOT EXISTS products_store_idx ON products(store_id);

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price_dzd INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  sku TEXT,
  options JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS product_variants_product_idx ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Orders & order items
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_number BIGSERIAL,
  status TEXT NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('pending_confirmation', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cod', 'edahabia', 'cib')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed')),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  wilaya_id SMALLINT NOT NULL REFERENCES wilayas(id),
  commune_id INTEGER REFERENCES communes(id),
  address TEXT NOT NULL DEFAULT '',
  delivery_type TEXT NOT NULL DEFAULT 'home' CHECK (delivery_type IN ('home', 'stopdesk')),
  stopdesk_id TEXT,
  subtotal_dzd INTEGER NOT NULL CHECK (subtotal_dzd >= 0),
  shipping_fee_dzd INTEGER NOT NULL DEFAULT 0 CHECK (shipping_fee_dzd >= 0),
  total_dzd INTEGER NOT NULL CHECK (total_dzd >= 0),
  -- Meta CAPI attribution signals captured at checkout
  fbp TEXT,
  fbc TEXT,
  client_ip TEXT,
  user_agent TEXT,
  event_source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_store_status_idx ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS orders_store_phone_idx ON orders(store_id, phone);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  title_snapshot TEXT NOT NULL,
  unit_price_dzd INTEGER NOT NULL CHECK (unit_price_dzd >= 0),
  qty INTEGER NOT NULL CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

-- 12. Customer payments (store Chargily)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'chargily',
  chargily_checkout_id TEXT UNIQUE,
  amount_dzd INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id);

-- 13. Shipments
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  carrier_id INTEGER NOT NULL REFERENCES carriers(id),
  tracking_number TEXT,
  label_url TEXT,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_attempt', 'returning', 'returned', 'cancelled')),
  raw_status TEXT,
  delivered_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shipments_carrier_tracking_idx ON shipments(carrier_id, tracking_number);
CREATE INDEX IF NOT EXISTS shipments_active_idx ON shipments(status)
  WHERE status NOT IN ('delivered', 'returned', 'cancelled');

-- 14. Meta CAPI event log
CREATE TABLE IF NOT EXISTS capi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'expired')),
  attempts SMALLINT NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS capi_events_store_idx ON capi_events(store_id, status);

-- 15. Generic incoming webhook deduplication
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, external_id)
);
