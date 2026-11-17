const STATUS_MAP = {
  upload: "created",
  picked: "picked_up",
  transit: "in_transit",
  delivering: "out_for_delivery",
  delivered: "delivered",
  returned: "returned",
  cancelled: "cancelled",
};

function mapStatus(raw) {
  if (!raw) return "in_transit";
  return STATUS_MAP[String(raw).trim().toLowerCase()] || "in_transit";
}

export default {
  platform: "noest",

  async validateCredentials(creds, carrier) {
    const base = carrier.base_url || "https://app.noest-dz.com/api/public";
    const res = await fetch(`${base}/valid/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_token: creds.api_token, user_guid: creds.user_guid }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Noest auth failed (${res.status})`);
    }
    return { ok: true, carrier: carrier.code };
  },

  async createShipment(order, creds, carrier) {
    const base = carrier.base_url || "https://app.noest-dz.com/api/public";
    const payload = {
      api_token: creds.api_token,
      user_guid: creds.user_guid,
      reference: String(order.order_number || order.id),
      client: order.customer_name,
      phone: order.phone,
      adresse: order.address || order.wilaya_name_fr || "Alger",
      wilaya_id: order.wilaya_id,
      commune: order.commune_name_fr || order.wilaya_name_fr || "Alger",
      montant: order.payment_status === "paid" ? 0 : order.total_dzd,
      produit: order.product_summary || "Order",
      type_id: 1,
      stop_desk: order.delivery_type === "stopdesk" ? 1 : 0,
    };

    const res = await fetch(`${base}/create/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.tracking) {
      throw new Error(data.message || `Noest createShipment error (${res.status})`);
    }

    return {
      trackingNumber: data.tracking,
      labelUrl: null,
      status: "created",
      rawStatus: "upload",
      rawPayload: data,
    };
  },

  async getStatuses(trackingNumbers, creds, carrier) {
    if (!trackingNumbers.length) return [];
    const base = carrier.base_url || "https://app.noest-dz.com/api/public";
    const res = await fetch(`${base}/get/orders/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_token: creds.api_token,
        user_guid: creds.user_guid,
        trackings: trackingNumbers,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Noest tracking error (${res.status})`);
    }
    const items = Array.isArray(data.data) ? data.data : Object.values(data);
    return items
      .filter((o) => o?.tracking)
      .map((o) => ({
        trackingNumber: o.tracking,
        status: mapStatus(o.activity || o.status),
        rawStatus: o.activity || o.status,
        rawPayload: o,
      }));
  },

  async cancelShipment(trackingNumber, creds, carrier) {
    const base = carrier.base_url || "https://app.noest-dz.com/api/public";
    const res = await fetch(`${base}/delete/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_token: creds.api_token,
        user_guid: creds.user_guid,
        tracking: trackingNumber,
      }),
    });
    if (!res.ok) {
      throw new Error(`Noest cancel error (${res.status})`);
    }
    return { cancelled: true };
  },

  parseWebhook() {
    return null;
  },

  mapStatus,
};
