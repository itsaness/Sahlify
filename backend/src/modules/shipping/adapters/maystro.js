const STATUS_MAP = {
  CREATED: "created",
  PICKED_UP: "picked_up",
  IN_TRANSIT: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  RETURNED: "returned",
  CANCELLED: "cancelled",
};

function mapStatus(raw) {
  if (!raw) return "in_transit";
  return STATUS_MAP[String(raw).toUpperCase()] || "in_transit";
}

function headers(creds) {
  return {
    Authorization: `Token ${creds.api_token}`,
    "Content-Type": "application/json",
  };
}

export default {
  platform: "maystro",

  async validateCredentials(creds, carrier) {
    const base = carrier.base_url || "https://backend.maystro-delivery.com/api";
    const res = await fetch(`${base}/base/wilayas/`, { headers: headers(creds), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      throw new Error(`Maystro auth failed (${res.status})`);
    }
    return { ok: true, carrier: carrier.code };
  },

  async createShipment(order, creds, carrier) {
    const base = carrier.base_url || "https://backend.maystro-delivery.com/api";
    // Maystro is strict on duplicate parcels -> always send deterministic external_id
    const payload = {
      external_id: String(order.id),
      customer_name: order.customer_name,
      customer_phone: order.phone,
      destination_text: order.address || order.wilaya_name_fr || "Alger",
      wilaya: order.wilaya_id,
      commune: order.commune_id || 1,
      total_price: order.payment_status === "paid" ? 0 : order.total_dzd,
      delivery_type: order.delivery_type === "stopdesk" ? 1 : 0,
      note_to_driver: order.product_summary || "Order",
    };

    const res = await fetch(`${base}/stores/orders/`, {
      method: "POST",
      headers: headers(creds),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
      throw new Error(data.message || `Maystro createShipment error (${res.status})`);
    }

    return {
      trackingNumber: String(data.tracking || data.id),
      labelUrl: data.label_url || null,
      status: "created",
      rawStatus: "CREATED",
      rawPayload: data,
    };
  },

  async getStatuses(trackingNumbers, creds, carrier) {
    if (!trackingNumbers.length) return [];
    const base = carrier.base_url || "https://backend.maystro-delivery.com/api";
    const results = [];
    for (const tracking of trackingNumbers) {
      const res = await fetch(`${base}/stores/orders/?tracking=${encodeURIComponent(tracking)}`, {
        headers: headers(creds),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const data = await res.json().catch(() => ({}));
      const item = Array.isArray(data.results) ? data.results[0] : data;
      if (item) {
        results.push({
          trackingNumber: tracking,
          status: mapStatus(item.status),
          rawStatus: String(item.status || ""),
          rawPayload: item,
        });
      }
    }
    return results;
  },

  async cancelShipment(trackingNumber, creds, carrier) {
    const base = carrier.base_url || "https://backend.maystro-delivery.com/api";
    const res = await fetch(`${base}/stores/orders/${encodeURIComponent(trackingNumber)}/cancel/`, {
      method: "POST",
      headers: headers(creds),
    });
    if (!res.ok) {
      throw new Error(`Maystro cancel error (${res.status})`);
    }
    return { cancelled: true };
  },

  parseWebhook(body) {
    const tracking = body?.tracking || body?.order?.tracking;
    const rawStatus = body?.status || body?.order?.status;
    if (!tracking) return null;
    return {
      externalId: String(body?.event_id || `${tracking}:${rawStatus}`),
      trackingNumber: String(tracking),
      status: mapStatus(rawStatus),
      rawStatus: String(rawStatus || ""),
      rawPayload: body,
    };
  },

  mapStatus,
};
