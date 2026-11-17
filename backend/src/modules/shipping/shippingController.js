import { z } from "zod";
import pool from "../../db/pool.js";
import { decryptJson } from "../../lib/crypto.js";
import { getCarrierAdapter } from "./adapters/index.js";
import { shippingEvents } from "./shippingEvents.js";

const VALID_SHIPMENT_STATUSES = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed_attempt",
  "returning",
  "returned",
  "cancelled",
];

async function applyShipmentStatus({ shipmentId, status, rawStatus, rawPayload }) {
  const client = await pool.connect();
  let deliveredInfo = null;
  try {
    await client.query("BEGIN");
    const prevRes = await client.query(
      `SELECT s.id, s.order_id, s.status, o.store_id
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE s.id = $1
       FOR UPDATE OF s`,
      [shipmentId]
    );
    if (prevRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const prev = prevRes.rows[0];
    const becameDelivered = prev.status !== "delivered" && status === "delivered";

    const updRes = await client.query(
      `UPDATE shipments
       SET status = $1,
           raw_status = COALESCE($2, raw_status),
           raw_payload = COALESCE($3::jsonb, raw_payload),
           delivered_at = CASE WHEN $1 = 'delivered' AND delivered_at IS NULL THEN NOW() ELSE delivered_at END,
           last_synced_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, rawStatus ?? null, rawPayload ? JSON.stringify(rawPayload) : null, shipmentId]
    );

    if (status === "delivered") {
      await client.query(
        "UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE id = $1",
        [prev.order_id]
      );
    } else if (status === "returned") {
      await client.query(
        "UPDATE orders SET status = 'returned', updated_at = NOW() WHERE id = $1",
        [prev.order_id]
      );
    } else if (status === "cancelled") {
      await client.query(
        "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
        [prev.order_id]
      );
    }

    await client.query("COMMIT");

    if (becameDelivered) {
      deliveredInfo = {
        storeId: prev.store_id,
        orderId: prev.order_id,
        shipment: updRes.rows[0],
      };
    }
    return updRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    if (deliveredInfo) {
      shippingEvents.emit("shipment.delivered", deliveredInfo);
    }
  }
}

export const shipOrder = async (req, res) => {
  const { orderId } = req.params;
  const requestedCarrierCode = req.body?.carrierCode;

  const client = await pool.connect();
  try {
    const orderRes = await client.query(
      `SELECT o.*, w.name_fr AS wilaya_name_fr,
              (SELECT string_agg(oi.title_snapshot || ' x' || oi.qty, ', ')
               FROM order_items oi WHERE oi.order_id = o.id) AS product_summary
       FROM orders o
       JOIN wilayas w ON w.id = o.wilaya_id
       WHERE o.id = $1 AND o.store_id = $2`,
      [orderId, req.store.id]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    const order = orderRes.rows[0];
    if (!["confirmed", "pending_confirmation"].includes(order.status)) {
      return res.status(400).json({ message: `Order in status '${order.status}' cannot be shipped` });
    }

    const existingShip = await client.query("SELECT id FROM shipments WHERE order_id = $1", [orderId]);
    if (existingShip.rows.length > 0) {
      return res.status(409).json({ message: "Shipment already exists for this order" });
    }

    let carrier;
    let creds = {};

    if (requestedCarrierCode === "manual") {
      const cRes = await client.query("SELECT * FROM carriers WHERE code = 'manual'");
      carrier = cRes.rows[0];
    } else {
      const intRes = requestedCarrierCode
        ? await client.query(
            `SELECT c.*, si.credentials_enc, si.iv
             FROM carriers c
             JOIN store_integrations si ON si.carrier_id = c.id AND si.provider = 'carrier' AND si.store_id = $1 AND si.is_active = TRUE
             WHERE c.code = $2`,
            [req.store.id, requestedCarrierCode]
          )
        : await client.query(
            `SELECT c.*, si.credentials_enc, si.iv
             FROM carriers c
             JOIN store_integrations si ON si.carrier_id = c.id AND si.provider = 'carrier' AND si.store_id = $1 AND si.is_active = TRUE
             ORDER BY si.is_default DESC, si.created_at ASC
             LIMIT 1`,
            [req.store.id]
          );

      if (intRes.rows.length === 0) {
        return res.status(400).json({
          message: "No active carrier integration configured (or pass carrierCode: 'manual')",
        });
      }
      carrier = intRes.rows[0];
      creds = decryptJson(carrier.credentials_enc, carrier.iv);
    }

    const adapter = getCarrierAdapter(carrier.platform);
    const created = await adapter.createShipment(order, creds, carrier);

    await client.query("BEGIN");
    const shipRes = await client.query(
      `INSERT INTO shipments (order_id, carrier_id, tracking_number, label_url, status, raw_status, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING *`,
      [
        order.id,
        carrier.id,
        created.trackingNumber,
        created.labelUrl,
        created.status || "created",
        created.rawStatus || null,
        JSON.stringify(created.rawPayload || {}),
      ]
    );

    await client.query(
      "UPDATE orders SET status = 'shipped', updated_at = NOW() WHERE id = $1",
      [order.id]
    );
    await client.query("COMMIT");

    return res.status(201).json({ shipment: shipRes.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("shipOrder error:", err);
    return res.status(502).json({ message: err.message || "Carrier error" });
  } finally {
    client.release();
  }
};

export const listShipments = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, c.code AS carrier_code, c.name AS carrier_name, o.order_number, o.customer_name, o.phone
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       JOIN carriers c ON c.id = s.carrier_id
       WHERE o.store_id = $1
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [req.store.id]
    );
    return res.status(200).json({ shipments: rows });
  } catch (err) {
    console.error("listShipments error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateShipmentStatus = async (req, res) => {
  const schema = z.object({
    status: z.enum(VALID_SHIPMENT_STATUSES),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid status", errors: parsed.error.issues });
  }

  try {
    const check = await pool.query(
      `SELECT s.id FROM shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE s.id = $1 AND o.store_id = $2`,
      [req.params.shipmentId, req.store.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Shipment not found" });
    }

    const updated = await applyShipmentStatus({
      shipmentId: req.params.shipmentId,
      status: parsed.data.status,
      rawStatus: parsed.data.status,
    });
    return res.status(200).json({ shipment: updated });
  } catch (err) {
    console.error("updateShipmentStatus error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export async function syncShipmentsBatch(storeId = null) {
  const { rows: active } = await pool.query(
    `SELECT s.id AS shipment_id, s.tracking_number, o.store_id,
            c.id AS carrier_id, c.code, c.platform, c.base_url,
            si.credentials_enc, si.iv
     FROM shipments s
     JOIN orders o ON o.id = s.order_id
     JOIN carriers c ON c.id = s.carrier_id
     JOIN store_integrations si ON si.store_id = o.store_id AND si.carrier_id = c.id AND si.provider = 'carrier'
     WHERE ($1::uuid IS NULL OR o.store_id = $1)
       AND s.tracking_number IS NOT NULL
       AND c.platform <> 'manual'
       AND s.status NOT IN ('delivered', 'returned', 'cancelled')`,
    [storeId]
  );

  const byStoreCarrier = new Map();
  for (const row of active) {
    const key = `${row.store_id}:${row.carrier_id}`;
    if (!byStoreCarrier.has(key)) {
      byStoreCarrier.set(key, { carrier: row, items: [] });
    }
    byStoreCarrier.get(key).items.push(row);
  }

  let updatedCount = 0;
  for (const { carrier, items } of byStoreCarrier.values()) {
    try {
      const adapter = getCarrierAdapter(carrier.platform);
      const creds = decryptJson(carrier.credentials_enc, carrier.iv);
      const trackings = items.map((i) => i.tracking_number);
      const statuses = await adapter.getStatuses(trackings, creds, carrier);
      const byTracking = new Map(statuses.map((s) => [s.trackingNumber, s]));

      for (const item of items) {
        const st = byTracking.get(item.tracking_number);
        if (st) {
          await applyShipmentStatus({
            shipmentId: item.shipment_id,
            status: st.status,
            rawStatus: st.rawStatus,
            rawPayload: st.rawPayload,
          });
          updatedCount++;
        }
      }
    } catch (err) {
      console.error(`Tracking sync failed for carrier ${carrier.code}:`, err.message);
    }
  }

  return { checked: active.length, updated: updatedCount };
}

export const syncStoreShipments = async (req, res) => {
  try {
    const result = await syncShipmentsBatch(req.store.id);
    return res.status(200).json(result);
  } catch (err) {
    console.error("syncStoreShipments error:", err);
    return res.status(502).json({ message: err.message || "Sync failed" });
  }
};

export const cancelShipment = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, c.code AS carrier_code, c.platform, c.base_url, o.store_id
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       JOIN carriers c ON c.id = s.carrier_id
       WHERE s.id = $1 AND o.store_id = $2`,
      [req.params.shipmentId, req.store.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Shipment not found" });
    }
    const shipment = rows[0];
    if (["delivered", "returned", "cancelled"].includes(shipment.status)) {
      return res.status(400).json({ message: `Shipment in status '${shipment.status}' cannot be cancelled` });
    }

    if (shipment.platform !== "manual" && shipment.tracking_number) {
      const intRes = await pool.query(
        `SELECT credentials_enc, iv FROM store_integrations
         WHERE store_id = $1 AND provider = 'carrier' AND carrier_id = $2`,
        [req.store.id, shipment.carrier_id]
      );
      if (intRes.rows.length > 0) {
        const creds = decryptJson(intRes.rows[0].credentials_enc, intRes.rows[0].iv);
        const adapter = getCarrierAdapter(shipment.platform);
        await adapter.cancelShipment(shipment.tracking_number, creds, shipment);
      }
    }

    const updated = await applyShipmentStatus({
      shipmentId: shipment.id,
      status: "cancelled",
      rawStatus: "cancelled",
    });
    return res.status(200).json({ shipment: updated });
  } catch (err) {
    console.error("cancelShipment error:", err);
    return res.status(502).json({ message: err.message || "Failed to cancel shipment" });
  }
};

export const listCarrierStopDesks = async (req, res) => {
  const { carrierCode } = req.params;
  const wilayaId = req.query.wilayaId ? Number(req.query.wilayaId) : null;
  try {
    const { rows } = await pool.query(
      `SELECT c.*, si.credentials_enc, si.iv
       FROM carriers c
       JOIN store_integrations si ON si.carrier_id = c.id AND si.provider = 'carrier' AND si.store_id = $1
       WHERE c.code = $2`,
      [req.store.id, carrierCode]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Carrier integration not configured" });
    }
    const row = rows[0];
    const adapter = getCarrierAdapter(row.platform);
    if (!adapter.listStopDesks) {
      return res.status(200).json({ stopdesks: [] });
    }
    const creds = decryptJson(row.credentials_enc, row.iv);
    const stopdesks = await adapter.listStopDesks(wilayaId, creds, row);
    return res.status(200).json({ stopdesks });
  } catch (err) {
    console.error("listCarrierStopDesks error:", err);
    return res.status(502).json({ message: err.message || "Failed to fetch stopdesks" });
  }
};

export const handleShippingWebhook = async (req, res) => {
  const { carrierCode } = req.params;
  try {
    const carrierRes = await pool.query("SELECT * FROM carriers WHERE code = $1", [carrierCode]);
    if (carrierRes.rows.length === 0) {
      return res.status(404).json({ message: "Unknown carrier" });
    }
    const carrier = carrierRes.rows[0];
    const adapter = getCarrierAdapter(carrier.platform);
    const parsed = adapter.parseWebhook(req.body, carrier);
    if (!parsed) {
      return res.status(400).json({ message: "Unsupported or invalid webhook payload" });
    }

    const dedup = await pool.query(
      `INSERT INTO webhook_events (provider, external_id, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (provider, external_id) DO NOTHING
       RETURNING id`,
      [`carrier_${carrierCode}`, parsed.externalId, JSON.stringify(req.body)]
    );
    if (dedup.rowCount === 0) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const shipRes = await pool.query(
      `SELECT s.id, s.tracking_number, o.store_id, si.credentials_enc, si.iv
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       LEFT JOIN store_integrations si
         ON si.store_id = o.store_id AND si.carrier_id = s.carrier_id AND si.provider = 'carrier' AND si.is_active = TRUE
       WHERE s.carrier_id = $1 AND s.tracking_number = $2
       LIMIT 1`,
      [carrier.id, parsed.trackingNumber]
    );
    if (shipRes.rows.length > 0) {
      const ship = shipRes.rows[0];
      if (!ship.credentials_enc) {
        return res.status(200).json({ received: true, verified: false });
      }
      // Treat webhook as a hint: confirm the real status directly from the carrier API
      const creds = decryptJson(ship.credentials_enc, ship.iv);
      const statuses = await adapter.getStatuses([ship.tracking_number], creds, carrier);
      const confirmed = statuses.find((s) => s.trackingNumber === ship.tracking_number);
      if (!confirmed) {
        return res.status(200).json({ received: true, verified: false });
      }
      await applyShipmentStatus({
        shipmentId: ship.id,
        status: confirmed.status,
        rawStatus: confirmed.rawStatus,
        rawPayload: confirmed.rawPayload,
      });
    }

    return res.status(200).json({ received: true, verified: true });
  } catch (err) {
    console.error("handleShippingWebhook error:", err);
    return res.status(500).json({ message: "Webhook error" });
  }
};
