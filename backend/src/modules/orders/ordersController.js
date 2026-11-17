import { z } from "zod";
import pool from "../../db/pool.js";
import { env } from "../../config/env.js";
import { decryptJson } from "../../lib/crypto.js";
import { normalizeDzPhone } from "../../lib/phone.js";
import { createChargilyCheckout } from "../payments/chargilyService.js";
import { sendOrderCapiEvent } from "../capi/capiService.js";

const createOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(9).max(20),
  wilayaId: z.number().int().min(1).max(69),
  communeId: z.number().int().positive().optional().nullable(),
  address: z.string().trim().max(300).optional().default(""),
  deliveryType: z.enum(["home", "stopdesk"]).default("home"),
  stopdeskId: z.string().trim().max(80).optional().nullable(),
  paymentMethod: z.enum(["cod", "edahabia", "cib"]).default("cod"),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional().nullable(),
        qty: z.number().int().min(1).max(50),
      })
    )
    .min(1)
    .max(20),
  fbp: z.string().max(200).optional().nullable(),
  fbc: z.string().max(200).optional().nullable(),
  eventSourceUrl: z.string().max(500).optional().nullable(),
});

export const listWilayas = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, code, name_ar, name_fr FROM wilayas ORDER BY id ASC"
    );
    return res.status(200).json({ wilayas: rows });
  } catch (err) {
    console.error("listWilayas error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getStorefrontShippingRates = async (req, res) => {
  const wilayaId = req.query.wilayaId ? Number(req.query.wilayaId) : null;
  try {
    const { rows } = wilayaId
      ? await pool.query(
          `SELECT sr.wilaya_id, sr.carrier_id, c.code AS carrier_code, c.name AS carrier_name,
                  sr.home_price_dzd, sr.stopdesk_price_dzd
           FROM shipping_rates sr
           JOIN carriers c ON c.id = sr.carrier_id
           WHERE sr.store_id = $1 AND sr.wilaya_id = $2`,
          [req.store.id, wilayaId]
        )
      : await pool.query(
          `SELECT sr.wilaya_id, sr.carrier_id, c.code AS carrier_code, c.name AS carrier_name,
                  sr.home_price_dzd, sr.stopdesk_price_dzd
           FROM shipping_rates sr
           JOIN carriers c ON c.id = sr.carrier_id
           WHERE sr.store_id = $1
           ORDER BY sr.wilaya_id ASC`,
          [req.store.id]
        );
    return res.status(200).json({ rates: rows });
  } catch (err) {
    console.error("getStorefrontShippingRates error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const upsertShippingRates = async (req, res) => {
  const schema = z.object({
    carrierCode: z.string().min(1).default("manual"),
    rates: z
      .array(
        z.object({
          wilayaId: z.number().int().min(1).max(69),
          homePriceDzd: z.number().int().min(0),
          stopdeskPriceDzd: z.number().int().min(0).default(0),
        })
      )
      .min(1)
      .max(69),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }

  const client = await pool.connect();
  try {
    const carrierRes = await client.query("SELECT id FROM carriers WHERE code = $1", [
      parsed.data.carrierCode,
    ]);
    if (carrierRes.rows.length === 0) {
      return res.status(400).json({ message: "Unknown carrierCode" });
    }
    const carrierId = carrierRes.rows[0].id;

    await client.query("BEGIN");
    for (const r of parsed.data.rates) {
      await client.query(
        `INSERT INTO shipping_rates (store_id, carrier_id, wilaya_id, home_price_dzd, stopdesk_price_dzd)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (store_id, carrier_id, wilaya_id) DO UPDATE SET
           home_price_dzd = EXCLUDED.home_price_dzd,
           stopdesk_price_dzd = EXCLUDED.stopdesk_price_dzd`,
        [req.store.id, carrierId, r.wilayaId, r.homePriceDzd, r.stopdeskPriceDzd]
      );
    }
    await client.query("COMMIT");
    return res.status(200).json({ updated: parsed.data.rates.length });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("upsertShippingRates error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const createStorefrontOrder = async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }
  const d = parsed.data;

  const isOnline = d.paymentMethod === "edahabia" || d.paymentMethod === "cib";
  if (!isOnline && !req.store.cod_enabled) {
    return res.status(400).json({ message: "Cash on delivery is disabled for this store" });
  }
  if (isOnline && !req.store.online_payment_enabled) {
    return res.status(400).json({ message: "Online payment is disabled for this store" });
  }

  const phone = normalizeDzPhone(d.phone);
  if (!phone) {
    return res.status(400).json({ message: "Invalid Algerian phone number (05/06/07xxxxxxxx)" });
  }

  const client = await pool.connect();
  try {
    // 1. Check phone blacklist
    const blRes = await client.query(
      "SELECT 1 FROM store_phone_blacklist WHERE store_id = $1 AND phone = $2",
      [req.store.id, phone]
    );
    if (blRes.rowCount > 0) {
      return res.status(403).json({ message: "Unable to place order with this phone number" });
    }

    // Aggregate quantities per (productId, variantId) and sort deterministically to prevent deadlocks
    const itemMap = new Map();
    for (const item of d.items) {
      const key = `${item.productId}:${item.variantId || ""}`;
      const existing = itemMap.get(key);
      if (existing) {
        existing.qty += item.qty;
      } else {
        itemMap.set(key, {
          productId: item.productId,
          variantId: item.variantId || null,
          qty: item.qty,
        });
      }
    }
    const aggregatedItems = Array.from(itemMap.values()).sort((a, b) =>
      `${a.productId}:${a.variantId || ""}`.localeCompare(`${b.productId}:${b.variantId || ""}`)
    );

    await client.query("BEGIN");

    // 2. Lock & price items server-side, then reserve stock
    let subtotalDzd = 0;
    const pricedItems = [];

    for (const item of aggregatedItems) {
      const prodRes = await client.query(
        "SELECT id, title, price_dzd, stock, is_active FROM products WHERE id = $1 AND store_id = $2 FOR UPDATE",
        [item.productId, req.store.id]
      );
      if (prodRes.rows.length === 0 || !prodRes.rows[0].is_active) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: `Product ${item.productId} is unavailable` });
      }
      const prod = prodRes.rows[0];
      let unitPrice = prod.price_dzd;
      let titleSnapshot = prod.title;
      let availableStock = prod.stock;

      if (item.variantId) {
        const varRes = await client.query(
          "SELECT id, title, price_dzd, stock FROM product_variants WHERE id = $1 AND product_id = $2 FOR UPDATE",
          [item.variantId, prod.id]
        );
        if (varRes.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: `Variant ${item.variantId} not found` });
        }
        const v = varRes.rows[0];
        if (v.price_dzd !== null && v.price_dzd !== undefined) {
          unitPrice = v.price_dzd;
        }
        availableStock = v.stock;
        titleSnapshot = `${prod.title} — ${v.title}`;
      }

      if (availableStock < item.qty) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: `Insufficient stock for ${titleSnapshot}` });
      }

      if (item.variantId) {
        await client.query(
          "UPDATE product_variants SET stock = stock - $1 WHERE id = $2",
          [item.qty, item.variantId]
        );
      } else {
        await client.query(
          "UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2",
          [item.qty, prod.id]
        );
      }

      subtotalDzd += unitPrice * item.qty;
      pricedItems.push({
        productId: prod.id,
        variantId: item.variantId,
        titleSnapshot,
        unitPriceDzd: unitPrice,
        qty: item.qty,
      });
    }

    // 3. Look up shipping fee for wilaya (prefer default carrier integration, else any rate for this store)
    const rateRes = await client.query(
      `SELECT sr.home_price_dzd, sr.stopdesk_price_dzd
       FROM shipping_rates sr
       LEFT JOIN store_integrations si
         ON si.store_id = sr.store_id AND si.provider = 'carrier' AND si.carrier_id = sr.carrier_id
       WHERE sr.store_id = $1 AND sr.wilaya_id = $2
       ORDER BY COALESCE(si.is_default, FALSE) DESC, sr.carrier_id ASC
       LIMIT 1`,
      [req.store.id, d.wilayaId]
    );
    const rate = rateRes.rows[0];
    const shippingFeeDzd = rate
      ? d.deliveryType === "stopdesk"
        ? rate.stopdesk_price_dzd
        : rate.home_price_dzd
      : 0;
    const totalDzd = subtotalDzd + shippingFeeDzd;
    if (totalDzd > 10_000_000) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Order total exceeds maximum allowed limit" });
    }

    const clientIp = req.ip || null;
    const userAgent = req.headers["user-agent"] || null;

    let chargilyCreds = null;
    if (isOnline) {
      const intRes = await client.query(
        `SELECT credentials_enc, iv, config
         FROM store_integrations
         WHERE store_id = $1 AND provider = 'chargily' AND is_active = TRUE
         LIMIT 1`,
        [req.store.id]
      );
      if (intRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Online payment is not configured for this store" });
      }
      const decrypted = decryptJson(intRes.rows[0].credentials_enc, intRes.rows[0].iv);
      chargilyCreds = {
        apiKey: decrypted.apiKey,
        apiBase:
          intRes.rows[0].config?.mode === "test"
            ? "https://pay.chargily.net/test/api/v2"
            : "https://pay.chargily.net/api/v2",
      };
    }

    const orderRes = await client.query(
      `INSERT INTO orders (
         store_id, status, payment_method, payment_status,
         customer_name, phone, wilaya_id, commune_id, address,
         delivery_type, stopdesk_id, subtotal_dzd, shipping_fee_dzd, total_dzd,
         fbp, fbc, client_ip, user_agent, event_source_url
       ) VALUES ($1, 'pending_confirmation', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id, order_number, status, payment_method, payment_status,
                 customer_name, phone, wilaya_id, delivery_type, subtotal_dzd, shipping_fee_dzd, total_dzd, created_at`,
      [
        req.store.id,
        d.paymentMethod,
        isOnline ? "pending" : "unpaid",
        d.customerName,
        phone,
        d.wilayaId,
        d.communeId ?? null,
        d.address,
        d.deliveryType,
        d.stopdeskId ?? null,
        subtotalDzd,
        shippingFeeDzd,
        totalDzd,
        d.fbp ?? null,
        d.fbc ?? null,
        clientIp,
        userAgent,
        d.eventSourceUrl ?? null,
      ]
    );
    const order = orderRes.rows[0];

    for (const pi of pricedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, title_snapshot, unit_price_dzd, qty)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, pi.productId, pi.variantId, pi.titleSnapshot, pi.unitPriceDzd, pi.qty]
      );
    }

    let checkoutUrl = null;
    if (isOnline && chargilyCreds) {
      const payRes = await client.query(
        `INSERT INTO payments (order_id, provider, amount_dzd, status)
         VALUES ($1, 'chargily', $2, 'pending')
         RETURNING id`,
        [order.id, totalDzd]
      );
      const paymentId = payRes.rows[0].id;
      const baseDomain = env.STORE_BASE_DOMAINS.split(",")[0]?.trim() || "sahlify.dz";
      const scheme = env.NODE_ENV === "production" ? "https" : "http";
      const storeOrigin = `${scheme}://${req.store.slug}.${baseDomain}`;

      const checkout = await createChargilyCheckout({
        amountDzd: totalDzd,
        metadata: { orderId: order.id, paymentId, storeId: req.store.id },
        successUrl: `${storeOrigin}/?order=${order.order_number}&payment=success`,
        failureUrl: `${storeOrigin}/?order=${order.order_number}&payment=failed`,
        webhookEndpoint: `${env.BETTER_AUTH_URL}/api/webhooks/chargily/stores/${req.store.id}`,
        apiKey: chargilyCreds.apiKey,
        apiBase: chargilyCreds.apiBase,
      });

      await client.query(
        "UPDATE payments SET chargily_checkout_id = $1, updated_at = NOW() WHERE id = $2",
        [checkout.id, paymentId]
      );
      checkoutUrl = checkout.checkout_url;
    }

    await client.query("COMMIT");

    const leadEventId = `order_${order.id}_lead`;
    // Fire Lead CAPI event asynchronously without blocking customer checkout
    sendOrderCapiEvent({
      storeId: req.store.id,
      orderId: order.id,
      eventName: "Lead",
      eventId: leadEventId,
    }).catch((err) => console.error("CAPI Lead dispatch failed:", err));

    return res.status(201).json({ order, checkoutUrl, leadEventId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("createStorefrontOrder error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const listOrders = async (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const { rows } = await pool.query(
      `SELECT o.*, w.name_fr AS wilaya_name_fr, w.name_ar AS wilaya_name_ar,
              s.tracking_number, s.status AS shipment_status
       FROM orders o
       JOIN wilayas w ON w.id = o.wilaya_id
       LEFT JOIN shipments s ON s.order_id = o.id
       WHERE o.store_id = $1 AND ($2::text IS NULL OR o.status = $2)
       ORDER BY o.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.store.id, status, limit, offset]
    );
    return res.status(200).json({ orders: rows });
  } catch (err) {
    console.error("listOrders error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrder = async (req, res) => {
  try {
    const orderRes = await pool.query(
      `SELECT o.*, w.name_fr AS wilaya_name_fr, w.name_ar AS wilaya_name_ar
       FROM orders o
       JOIN wilayas w ON w.id = o.wilaya_id
       WHERE o.id = $1 AND o.store_id = $2`,
      [req.params.orderId, req.store.id]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    const [itemsRes, shipRes, capiRes] = await Promise.all([
      pool.query("SELECT * FROM order_items WHERE order_id = $1", [req.params.orderId]),
      pool.query("SELECT * FROM shipments WHERE order_id = $1", [req.params.orderId]),
      pool.query("SELECT * FROM capi_events WHERE order_id = $1 ORDER BY created_at DESC", [
        req.params.orderId,
      ]),
    ]);
    return res.status(200).json({
      order: orderRes.rows[0],
      items: itemsRes.rows,
      shipment: shipRes.rows[0] || null,
      capiEvents: capiRes.rows,
    });
  } catch (err) {
    if (err?.code === "22P02") return res.status(400).json({ message: "Invalid identifier format" });
    console.error("getOrder error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const confirmOrder = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE orders
       SET status = 'confirmed', updated_at = NOW()
       WHERE id = $1 AND store_id = $2 AND status = 'pending_confirmation'
       RETURNING *`,
      [req.params.orderId, req.store.id]
    );
    if (rows.length === 0) {
      return res.status(400).json({ message: "Order not found or cannot be confirmed" });
    }
    return res.status(200).json({ order: rows[0] });
  } catch (err) {
    if (err?.code === "22P02") return res.status(400).json({ message: "Invalid identifier format" });
    console.error("confirmOrder error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const cancelOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE orders
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND store_id = $2 AND status IN ('pending_confirmation', 'confirmed')
       RETURNING *`,
      [req.params.orderId, req.store.id]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Order not found or cannot be cancelled" });
    }

    const itemsRes = await client.query(
      "SELECT product_id, variant_id, qty FROM order_items WHERE order_id = $1",
      [req.params.orderId]
    );
    for (const item of itemsRes.rows) {
      if (item.variant_id) {
        await client.query(
          "UPDATE product_variants SET stock = stock + $1 WHERE id = $2",
          [item.qty, item.variant_id]
        );
      } else if (item.product_id) {
        await client.query(
          "UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2",
          [item.qty, item.product_id]
        );
      }
    }

    await client.query("COMMIT");
    return res.status(200).json({ order: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err?.code === "22P02") {
      return res.status(400).json({ message: "Invalid identifier format" });
    }
    console.error("cancelOrder error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const listBlacklist = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT phone, reason, created_at FROM store_phone_blacklist WHERE store_id = $1 ORDER BY created_at DESC",
      [req.store.id]
    );
    return res.status(200).json({ blacklist: rows });
  } catch (err) {
    console.error("listBlacklist error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const addBlacklist = async (req, res) => {
  const phone = normalizeDzPhone(req.body?.phone);
  if (!phone) {
    return res.status(400).json({ message: "Invalid Algerian phone number" });
  }
  const reason = String(req.body?.reason || "").slice(0, 200);
  try {
    const { rows } = await pool.query(
      `INSERT INTO store_phone_blacklist (store_id, phone, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (store_id, phone) DO UPDATE SET reason = EXCLUDED.reason
       RETURNING phone, reason, created_at`,
      [req.store.id, phone, reason]
    );
    return res.status(201).json({ entry: rows[0] });
  } catch (err) {
    console.error("addBlacklist error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const removeBlacklist = async (req, res) => {
  const phone = normalizeDzPhone(req.params.phone);
  if (!phone) return res.status(400).json({ message: "Invalid phone number" });
  try {
    await pool.query("DELETE FROM store_phone_blacklist WHERE store_id = $1 AND phone = $2", [
      req.store.id,
      phone,
    ]);
    return res.status(204).send();
  } catch (err) {
    console.error("removeBlacklist error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
