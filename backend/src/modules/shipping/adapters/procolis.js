const STATUS_MAP = {
  "En préparation": "created",
  "Ramassé": "picked_up",
  "En transit": "in_transit",
  "En cours de livraison": "out_for_delivery",
  "Livré": "delivered",
  "Echec": "failed_attempt",
  "Retour": "returned",
  "Annulé": "cancelled",
};

function mapStatus(raw) {
  if (!raw) return "in_transit";
  return STATUS_MAP[raw] || "in_transit";
}

function headers(creds) {
  return {
    token: creds.token,
    key: creds.key,
    "Content-Type": "application/json",
  };
}

export default {
  platform: "procolis",

  async validateCredentials(creds, carrier) {
    const base = carrier.base_url || "https://procolis.com/api_v1";
    const res = await fetch(`${base}/token`, { headers: headers(creds), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      throw new Error(`Procolis (${carrier.name}) auth failed (${res.status})`);
    }
    return { ok: true, carrier: carrier.code };
  },

  async createShipment(order, creds, carrier) {
    const base = carrier.base_url || "https://procolis.com/api_v1";
    const payload = {
      Colis: [
        {
          TypeLivraison: order.delivery_type === "stopdesk" ? "1" : "0",
          TypeColis: "0",
          Confrimee: "1",
          Client: order.customer_name,
          MobileA: order.phone,
          Adresse: order.address || order.wilaya_name_fr || "Alger",
          IDWilaya: String(order.wilaya_id),
          Commune: order.commune_name_fr || order.wilaya_name_fr || "Alger",
          Total: String(order.payment_status === "paid" ? 0 : order.total_dzd),
          Note: "",
          TProduit: order.product_summary || "Order",
          id_Externe: String(order.order_number || order.id),
          Source: "Sahlify",
        },
      ],
    };

    const res = await fetch(`${base}/add_colis`, {
      method: "POST",
      headers: headers(creds),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    const first = Array.isArray(data.Colis) ? data.Colis[0] : data;
    if (!res.ok || !first?.Tracking) {
      throw new Error(data.message || `Procolis createShipment error (${res.status})`);
    }

    return {
      trackingNumber: first.Tracking,
      labelUrl: null,
      status: "created",
      rawStatus: "En préparation",
      rawPayload: data,
    };
  },

  async getStatuses(trackingNumbers, creds, carrier) {
    if (!trackingNumbers.length) return [];
    const base = carrier.base_url || "https://procolis.com/api_v1";
    const res = await fetch(`${base}/lire`, {
      method: "POST",
      headers: headers(creds),
      body: JSON.stringify({ Colis: trackingNumbers.map((t) => ({ Tracking: t })) }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Procolis tracking error (${res.status})`);
    }
    const items = Array.isArray(data.Colis) ? data.Colis : [];
    return items.map((c) => ({
      trackingNumber: c.Tracking,
      status: mapStatus(c.Situation),
      rawStatus: c.Situation,
      rawPayload: c,
    }));
  },

  async cancelShipment(trackingNumber, creds, carrier) {
    const base = carrier.base_url || "https://procolis.com/api_v1";
    const res = await fetch(`${base}/annuler`, {
      method: "POST",
      headers: headers(creds),
      body: JSON.stringify({ Colis: [{ Tracking: trackingNumber }] }),
    });
    if (!res.ok) {
      throw new Error(`Procolis cancel error (${res.status})`);
    }
    return { cancelled: true };
  },

  parseWebhook() {
    return null;
  },

  mapStatus,
};
