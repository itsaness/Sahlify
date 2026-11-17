const STATUS_MAP = {
  prete_a_expedier: "created",
  en_ramassage: "picked_up",
  ramassee: "picked_up",
  en_transit: "in_transit",
  vers_hub: "in_transit",
  en_livraison: "out_for_delivery",
  livree: "delivered",
  livre: "delivered",
  echec_livraison: "failed_attempt",
  retour_en_cours: "returning",
  retournee: "returned",
  retourne: "returned",
  annulee: "cancelled",
};

function mapStatus(raw) {
  if (!raw) return "in_transit";
  const key = String(raw)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
  return STATUS_MAP[key] || "in_transit";
}

function headers(creds) {
  return {
    Authorization: `Bearer ${creds.api_token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export default {
  platform: "ecotrack",

  async validateCredentials(creds, carrier) {
    if (!carrier.base_url) {
      throw new Error(`Missing base_url for Ecotrack carrier ${carrier.code}`);
    }
    const res = await fetch(`${carrier.base_url}/api/v1/get/wilayas`, {
      headers: headers(creds),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Ecotrack (${carrier.name}) auth failed (${res.status})`);
    }
    return { ok: true, carrier: carrier.code };
  },

  async createShipment(order, creds, carrier) {
    if (!carrier.base_url) {
      throw new Error(`Missing base_url for Ecotrack carrier ${carrier.code}`);
    }
    const params = new URLSearchParams({
      reference: String(order.order_number || order.id),
      nom_client: order.customer_name,
      telephone: order.phone,
      adresse: order.address || order.wilaya_name_fr || "Alger",
      commune: order.commune_name_fr || order.wilaya_name_fr || "Alger Centre",
      code_wilaya: String(order.wilaya_id),
      montant: String(order.payment_status === "paid" ? 0 : order.total_dzd),
      type: "1", // standard delivery
      stop_desk: order.delivery_type === "stopdesk" ? "1" : "0",
      produit: order.product_summary || "Order",
    });

    const res = await fetch(`${carrier.base_url}/api/v1/create/order?${params.toString()}`, {
      method: "POST",
      headers: headers(creds),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.tracking) {
      throw new Error(data.message || `Ecotrack create order error (${res.status})`);
    }

    return {
      trackingNumber: data.tracking,
      labelUrl: `${carrier.base_url}/api/v1/get/order/label?tracking=${encodeURIComponent(data.tracking)}`,
      status: "created",
      rawStatus: "prete_a_expedier",
      rawPayload: data,
    };
  },

  async getStatuses(trackingNumbers, creds, carrier) {
    if (!trackingNumbers.length || !carrier.base_url) return [];
    const res = await fetch(
      `${carrier.base_url}/api/v1/get/orders?tracking=${encodeURIComponent(trackingNumbers.join(","))}`,
      { headers: headers(creds), signal: AbortSignal.timeout(15_000) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Ecotrack tracking error (${res.status})`);
    }
    const items = Array.isArray(data.data) ? data.data : [];
    return items.map((o) => ({
      trackingNumber: o.tracking,
      status: mapStatus(o.status),
      rawStatus: o.status,
      rawPayload: o,
    }));
  },

  async cancelShipment(trackingNumber, creds, carrier) {
    const res = await fetch(
      `${carrier.base_url}/api/v1/delete/order?tracking=${encodeURIComponent(trackingNumber)}`,
      { method: "DELETE", headers: headers(creds) }
    );
    if (!res.ok) {
      throw new Error(`Ecotrack cancel error (${res.status})`);
    }
    return { cancelled: true };
  },

  async getFees(_opts, creds, carrier) {
    const res = await fetch(`${carrier.base_url}/api/v1/get/fees`, {
      headers: headers(creds),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Ecotrack fees error (${res.status})`);
    }
    return { raw: data };
  },

  parseWebhook() {
    return null;
  },

  mapStatus,
};
