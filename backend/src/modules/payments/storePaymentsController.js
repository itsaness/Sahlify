import pool from "../../db/pool.js";
import { decryptJson } from "../../lib/crypto.js";
import { verifyChargilySignature } from "./chargilyService.js";

export const handleStoreChargilyWebhook = async (req, res) => {
  const { storeId } = req.params;
  const signature = req.headers["signature"];

  try {
    const intRes = await pool.query(
      `SELECT credentials_enc, iv
       FROM store_integrations
       WHERE store_id = $1 AND provider = 'chargily' AND is_active = TRUE
       LIMIT 1`,
      [storeId]
    );
    if (intRes.rows.length === 0) {
      return res.status(404).json({ message: "Store Chargily integration not found" });
    }

    const creds = decryptJson(intRes.rows[0].credentials_enc, intRes.rows[0].iv);
    if (!verifyChargilySignature(req.body, signature, creds.apiKey)) {
      return res.status(401).json({ message: "Invalid signature" });
    }
  } catch (err) {
    console.error("Store Chargily webhook auth error:", err);
    return res.status(400).json({ message: "Invalid webhook configuration" });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ message: "Invalid JSON payload" });
  }

  const eventType = event?.type;
  const checkout = event?.data;
  const checkoutId = checkout?.id;
  const externalId = String(event?.id || `${eventType}:${checkoutId || "unknown"}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const dedup = await client.query(
      `INSERT INTO webhook_events (provider, external_id, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (provider, external_id) DO NOTHING
       RETURNING id`,
      [`chargily_store_${storeId}`, externalId, JSON.stringify(event)]
    );
    if (dedup.rowCount === 0) {
      await client.query("COMMIT");
      return res.status(200).json({ received: true, duplicate: true });
    }

    const paymentId = checkout?.metadata?.paymentId || null;

    if (eventType === "checkout.paid" && (paymentId || checkoutId)) {
      const payRes = await client.query(
        `SELECT p.id, p.order_id, p.amount_dzd, p.status
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE o.store_id = $1 AND (p.id = $2 OR p.chargily_checkout_id = $3)
         FOR UPDATE OF p`,
        [storeId, paymentId, checkoutId]
      );

      if (payRes.rows.length > 0 && payRes.rows[0].status !== "paid") {
        const pay = payRes.rows[0];
        if (
          (checkout?.amount !== undefined && Number(checkout.amount) !== pay.amount_dzd) ||
          (checkout?.currency && String(checkout.currency).toLowerCase() !== "dzd")
        ) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Payment amount or currency mismatch" });
        }
        await client.query(
          `UPDATE payments
           SET status = 'paid',
               chargily_checkout_id = COALESCE(chargily_checkout_id, $1),
               raw_payload = $2::jsonb,
               updated_at = NOW()
           WHERE id = $3`,
          [checkoutId, JSON.stringify(event), pay.id]
        );

        await client.query(
          `UPDATE orders
           SET payment_status = 'paid',
               status = CASE WHEN status = 'pending_confirmation' THEN 'confirmed' ELSE status END,
               updated_at = NOW()
           WHERE id = $1 AND store_id = $2`,
          [pay.order_id, storeId]
        );
      }
    } else if (
      (eventType === "checkout.failed" || eventType === "checkout.expired") &&
      (paymentId || checkoutId)
    ) {
      const nextStatus = eventType === "checkout.failed" ? "failed" : "expired";
      const payRes = await client.query(
        `UPDATE payments p
         SET status = $1, raw_payload = $2::jsonb, updated_at = NOW()
         FROM orders o
         WHERE p.order_id = o.id AND o.store_id = $3
           AND (p.id = $4 OR p.chargily_checkout_id = $5)
           AND p.status = 'pending'
         RETURNING p.order_id`,
        [nextStatus, JSON.stringify(event), storeId, paymentId, checkoutId]
      );
      if (payRes.rows.length > 0) {
        await client.query(
          "UPDATE orders SET payment_status = 'failed', updated_at = NOW() WHERE id = $1",
          [payRes.rows[0].order_id]
        );
      }
    }

    await client.query("COMMIT");
    return res.status(200).json({ received: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("handleStoreChargilyWebhook error:", err);
    return res.status(500).json({ message: "Webhook processing failed" });
  } finally {
    client.release();
  }
};
