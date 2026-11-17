import crypto from "crypto";
import { env } from "../../config/env.js";
import pool from "../../db/pool.js";
import { decryptJson } from "../../lib/crypto.js";
import { toMetaPhone } from "../../lib/phone.js";

function sha256Norm(value) {
  if (!value || typeof value !== "string") return undefined;
  const clean = value.trim().toLowerCase();
  if (!clean) return undefined;
  return crypto.createHash("sha256").update(clean).digest("hex");
}

function splitName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/);
  return {
    fn: parts[0] || "",
    ln: parts.slice(1).join(" ") || "",
  };
}

/**
 * Builds and sends a Meta Conversions API event for an order, logging the result in capi_events.
 * Silently no-ops if the store has no active Meta integration or capi_enabled is false.
 */
export async function sendOrderCapiEvent({ storeId, orderId, eventName, eventId, eventTime }) {
  const intRes = await pool.query(
    `SELECT si.credentials_enc, si.iv, si.config, s.capi_enabled
     FROM stores s
     JOIN store_integrations si ON si.store_id = s.id AND si.provider = 'meta' AND si.is_active = TRUE
     WHERE s.id = $1`,
    [storeId]
  );

  if (intRes.rows.length === 0 || !intRes.rows[0].capi_enabled) {
    return { skipped: true };
  }

  const row = intRes.rows[0];
  const creds = decryptJson(row.credentials_enc, row.iv);
  const pixelId = creds.pixelId || row.config?.pixelId;
  const accessToken = creds.accessToken;
  const testEventCode = creds.testEventCode || row.config?.testEventCode;

  if (!pixelId || !accessToken) {
    return { skipped: true };
  }

  const orderRes = await pool.query(
    `SELECT o.*, w.name_fr AS wilaya_name
     FROM orders o
     JOIN wilayas w ON w.id = o.wilaya_id
     WHERE o.id = $1 AND o.store_id = $2`,
    [orderId, storeId]
  );
  if (orderRes.rows.length === 0) return { skipped: true };
  const order = orderRes.rows[0];

  const itemsRes = await pool.query(
    "SELECT product_id, unit_price_dzd, qty FROM order_items WHERE order_id = $1",
    [orderId]
  );

  // Record pending event (idempotent on event_id)
  const insRes = await pool.query(
    `INSERT INTO capi_events (store_id, order_id, event_name, event_id, status)
     VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [storeId, orderId, eventName, eventId]
  );
  if (insRes.rowCount === 0) {
    return { duplicate: true };
  }

  return dispatchCapiPayload({
    eventId,
    eventName,
    eventTime: eventTime || Math.floor(Date.now() / 1000),
    order,
    items: itemsRes.rows,
    pixelId,
    accessToken,
    testEventCode,
  });
}

async function dispatchCapiPayload({
  eventId,
  eventName,
  eventTime,
  order,
  items,
  pixelId,
  accessToken,
  testEventCode,
}) {
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
  if (eventTime < sevenDaysAgo) {
    await pool.query(
      `UPDATE capi_events SET status = 'expired', last_error = 'Event older than 7 days' WHERE event_id = $1`,
      [eventId]
    );
    return { sent: false, expired: true };
  }

  const { fn, ln } = splitName(order.customer_name);
  const metaPhone = toMetaPhone(order.phone);

  const userData = {
    ph: metaPhone ? [sha256Norm(metaPhone)] : undefined,
    fn: fn ? [sha256Norm(fn)] : undefined,
    ln: ln ? [sha256Norm(ln)] : undefined,
    st: order.wilaya_name ? [sha256Norm(order.wilaya_name)] : undefined,
    country: [sha256Norm("dz")],
    external_id: [sha256Norm(order.phone)],
    client_ip_address: order.client_ip || undefined,
    client_user_agent: order.user_agent || undefined,
    fbp: order.fbp || undefined,
    fbc: order.fbc || undefined,
  };

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        event_source_url: order.event_source_url || undefined,
        user_data: userData,
        custom_data: {
          currency: "DZD",
          value: order.subtotal_dzd,
          num_items: items.reduce((sum, i) => sum + i.qty, 0),
          content_ids: items.map((i) => i.product_id).filter(Boolean),
          contents: items.map((i) => ({
            id: i.product_id,
            quantity: i.qty,
            item_price: i.unit_price_dzd,
          })),
        },
      },
    ],
  };

  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  try {
    const url = `https://graph.facebook.com/${encodeURIComponent(env.META_GRAPH_VERSION)}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || `Meta CAPI HTTP ${res.status}`);
    }

    await pool.query(
      `UPDATE capi_events SET status = 'sent', attempts = attempts + 1, last_error = NULL, sent_at = NOW() WHERE event_id = $1`,
      [eventId]
    );
    return { sent: true, body };
  } catch (err) {
    await pool.query(
      `UPDATE capi_events SET status = 'failed', attempts = attempts + 1, last_error = $2 WHERE event_id = $1`,
      [eventId, err.message]
    );
    return { sent: false, error: err.message };
  }
}

export async function retryCapiEventById(eventId) {
  const evRes = await pool.query(
    `SELECT ce.*, si.credentials_enc, si.iv, si.config, s.capi_enabled
     FROM capi_events ce
     JOIN stores s ON s.id = ce.store_id
     JOIN store_integrations si ON si.store_id = s.id AND si.provider = 'meta' AND si.is_active = TRUE
     WHERE ce.event_id = $1`,
    [eventId]
  );
  if (evRes.rows.length === 0 || !evRes.rows[0].capi_enabled) {
    return { skipped: true };
  }
  const ev = evRes.rows[0];
  const creds = decryptJson(ev.credentials_enc, ev.iv);
  const pixelId = creds.pixelId || ev.config?.pixelId;
  const accessToken = creds.accessToken;
  const testEventCode = creds.testEventCode || ev.config?.testEventCode;
  if (!pixelId || !accessToken) return { skipped: true };

  const orderRes = await pool.query(
    `SELECT o.*, w.name_fr AS wilaya_name
     FROM orders o
     JOIN wilayas w ON w.id = o.wilaya_id
     WHERE o.id = $1 AND o.store_id = $2`,
    [ev.order_id, ev.store_id]
  );
  if (orderRes.rows.length === 0) return { skipped: true };
  const itemsRes = await pool.query(
    "SELECT product_id, unit_price_dzd, qty FROM order_items WHERE order_id = $1",
    [ev.order_id]
  );

  return dispatchCapiPayload({
    eventId: ev.event_id,
    eventName: ev.event_name,
    eventTime: Math.floor(new Date(ev.created_at).getTime() / 1000),
    order: orderRes.rows[0],
    items: itemsRes.rows,
    pixelId,
    accessToken,
    testEventCode,
  });
}

export async function retryFailedCapiEvents() {
  // Mark events older than 7 days as expired
  await pool.query(
    `UPDATE capi_events
     SET status = 'expired', last_error = 'Exceeded 7-day Meta CAPI window'
     WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days'`
  );

  const { rows } = await pool.query(
    `SELECT event_id
     FROM capi_events
     WHERE status = 'failed' AND attempts < 5 AND created_at >= NOW() - INTERVAL '7 days'
     ORDER BY created_at ASC
     LIMIT 50`
  );

  let retried = 0;
  for (const r of rows) {
    await retryCapiEventById(r.event_id);
    retried++;
  }
  return { retried };
}
