-- Production hot-path indexes for catalog, orders, CAPI, and Better Auth session cleanup

CREATE INDEX IF NOT EXISTS product_images_product_sort_idx
  ON product_images(product_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS orders_store_created_idx
  ON orders(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS capi_events_order_idx
  ON capi_events(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS session_expiresAt_idx
  ON "session"("expiresAt");
