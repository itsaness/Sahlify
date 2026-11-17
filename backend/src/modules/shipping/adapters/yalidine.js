const STATUS_MAP = {
  "En préparation": "created",
  "Pas encore expédié": "created",
  "A vérifier": "created",
  "En ramassage": "picked_up",
  "Ramassé": "picked_up",
  "Transfert": "in_transit",
  "Expédié": "in_transit",
  "Centre": "in_transit",
  "Sorti en livraison": "out_for_delivery",
  "En livraison": "out_for_delivery",
  "Livré": "delivered",
  "Echec livraison": "failed_attempt",
  "Tentative échouée": "failed_attempt",
  "Retour vers vendeur": "returning",
  "Retourné au vendeur": "returned",
  "Annulé": "cancelled",
};

function mapStatus(raw) {
  if (!raw) return "in_transit";
  return STATUS_MAP[raw] || "in_transit";
}

function headers(creds) {
  return {
    "X-API-ID": creds.api_id,
    "X-API-TOKEN": creds.api_token,
    "Content-Type": "application/json",
  };
}

export default {
  platform: "yalidine",

  async validateCredentials(creds, carrier) {
    const base = carrier.base_url || "https://api.yalidine.app/v1";
    const res = await fetch(`${base}/wilayas`, { headers: headers(creds), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      throw new Error(`Yalidine auth failed (${res.status})`);
    }
    return { ok: true, carrier: carrier.code };
  },

  async createShipment(order, creds, carrier) {
    const base = carrier.base_url || "https://api.yalidine.app/v1";
    const nameParts = String(order.customer_name || "").trim().split(/\s+/);
    const firstname = nameParts[0] || "Client";
    const familyname = nameParts.slice(1).join(" ") || firstname;

    const payload = [
      {
        order_id: String(order.order_number || order.id),
        firstname,
        familyname,
        contact_phone: order.phone,
        address: order.address || order.wilaya_name_fr || "Alger",
        to_commune_name: order.commune_name_fr || order.wilaya_name_fr || "Alger Centre",
        to_wilaya_name: order.wilaya_name_fr,
        product_list: order.product_summary || "Order",
        price: order.payment_status === "paid" ? 0 : order.total_dzd,
        do_insurance: false,
        declared_value: order.subtotal_dzd,
        freeshipping: true,
        is_stopdesk: order.delivery_type === "stopdesk",
        stopdesk_id: order.stopdesk_id ? Number(order.stopdesk_id) : undefined,
        has_exchange: false,
      },
    ];

    const res = await fetch(`${base}/parcels/`, {
      method: "POST",
      headers: headers(creds),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Yalidine createParcel error (${res.status})`);
    }
    const created = data[String(order.order_number || order.id)] || Object.values(data)[0];
    if (!created?.tracking) {
      throw new Error(created?.message || "Yalidine did not return a tracking number");
    }

    return {
      trackingNumber: created.tracking,
      labelUrl: created.label || null,
      status: "created",
      rawStatus: "En préparation",
      rawPayload: created,
    };
  },

  async getStatuses(trackingNumbers, creds, carrier) {
    if (!trackingNumbers.length) return [];
    const base = carrier.base_url || "https://api.yalidine.app/v1";
    const res = await fetch(
      `${base}/parcels/?tracking=${encodeURIComponent(trackingNumbers.join(","))}`,
      { headers: headers(creds), signal: AbortSignal.timeout(15_000) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Yalidine tracking error (${res.status})`);
    }
    const items = Array.isArray(data.data) ? data.data : [];
    return items.map((p) => ({
      trackingNumber: p.tracking,
      status: mapStatus(p.last_status),
      rawStatus: p.last_status,
      rawPayload: p,
    }));
  },

  async cancelShipment(trackingNumber, creds, carrier) {
    const base = carrier.base_url || "https://api.yalidine.app/v1";
    const res = await fetch(`${base}/parcels/${encodeURIComponent(trackingNumber)}`, {
      method: "DELETE",
      headers: headers(creds),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`Yalidine cancel error (${res.status})`);
    }
    return { cancelled: true };
  },

  async listStopDesks(wilayaId, creds, carrier) {
    const base = carrier.base_url || "https://api.yalidine.app/v1";
    const qs = wilayaId ? `?wilaya_id=${encodeURIComponent(wilayaId)}` : "";
    const res = await fetch(`${base}/centers/${qs}`, { headers: headers(creds) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Yalidine stopdesks error (${res.status})`);
    }
    const items = Array.isArray(data.data) ? data.data : [];
    return items.map((c) => ({
      id: String(c.center_id),
      name: c.name,
      address: c.address,
      wilayaId: c.wilaya_id,
      communeName: c.commune_name,
    }));
  },

  async getFees({ fromWilayaId, toWilayaId }, creds, carrier) {
    const base = carrier.base_url || "https://api.yalidine.app/v1";
    const res = await fetch(
      `${base}/fees/?from_wilaya_id=${encodeURIComponent(fromWilayaId)}&to_wilaya_id=${encodeURIComponent(toWilayaId)}`,
      { headers: headers(creds) }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Yalidine fees error (${res.status})`);
    }
    return {
      homePriceDzd: data.home_fee ?? null,
      stopdeskPriceDzd: data.desk_fee ?? null,
      raw: data,
    };
  },

  parseWebhook(body) {
    const tracking = body?.tracking || body?.data?.tracking;
    const rawStatus = body?.last_status || body?.status || body?.data?.last_status;
    if (!tracking) return null;
    return {
      externalId: String(body?.event_id || `${tracking}:${rawStatus}:${body?.date || ""}`),
      trackingNumber: tracking,
      status: mapStatus(rawStatus),
      rawStatus,
      rawPayload: body,
    };
  },

  mapStatus,
};
