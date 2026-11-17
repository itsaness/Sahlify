import crypto from "crypto";

export default {
  platform: "manual",

  async validateCredentials() {
    return { ok: true, carrier: "manual" };
  },

  async createShipment(order) {
    const trackingNumber = `MAN-${order.order_number || crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    return {
      trackingNumber,
      labelUrl: null,
      status: "created",
      rawStatus: "created",
      rawPayload: { mode: "manual" },
    };
  },

  async getStatuses() {
    return [];
  },

  async cancelShipment() {
    return { cancelled: true };
  },

  parseWebhook() {
    return null;
  },

  mapStatus(raw) {
    return raw || "created";
  },
};
