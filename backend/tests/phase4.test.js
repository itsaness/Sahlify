process.env.CHARGILY_API_KEY = process.env.CHARGILY_API_KEY || "test-chargily-secret";

import test from "node:test";
import assert from "node:assert/strict";
import { runMigrations } from "../src/db/migrate.js";
import { runSeeds } from "../src/db/seeds/seed.js";
import pool from "../src/db/pool.js";
import { createApp } from "../src/app.js";
import { shippingEvents } from "../src/modules/shipping/shippingEvents.js";

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

test("Phase 4: Carriers registry, encrypted integrations vault, manual shipping, and Yalidine webhook", async () => {
  await runMigrations();
  await runSeeds();

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith("https://api.yalidine.app/v1/parcels/")) {
      const u = new URL(String(url));
      const tracking = u.searchParams.get("tracking");
      return new Response(
        JSON.stringify({ data: [{ tracking, last_status: "Livré" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return origFetch(url, opts);
  };

  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const suffix = Date.now();
  const email = `p4_${suffix}@test.dz`;
  const slug = `p4shop-${suffix}`;
  const whEventId = `yal_evt_${suffix}`;

  try {
    // 1. Carriers list
    const carRes = await fetch(`${base}/api/carriers`);
    assert.equal(carRes.status, 200);
    const { carriers } = await carRes.json();
    assert.ok(carriers.some((c) => c.code === "yalidine"));
    assert.ok(carriers.some((c) => c.code === "dhd" && c.platform === "ecotrack"));
    assert.ok(carriers.some((c) => c.code === "manual"));

    // 2. Setup merchant, active store, product, and confirmed order
    const signup = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ name: "Phase4 Merchant", email, password: "Password123!" }),
    });
    const cookie = extractCookies(signup);

    const storeRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "Express Shop", slug, language: "ar" }),
    });
    const { store } = await storeRes.json();
    await pool.query("UPDATE stores SET status = 'active' WHERE id = $1", [store.id]);

    // 3. Store encrypted Yalidine credentials & verify masking
    const intRes = await fetch(`${base}/api/stores/${store.id}/integrations/carrier/yalidine`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        credentials: { api_id: "yal_id_123456", api_token: "yal_tok_secret_9876" },
        isDefault: true,
      }),
    });
    assert.equal(intRes.status, 200);

    const listIntRes = await fetch(`${base}/api/stores/${store.id}/integrations`, {
      headers: { Cookie: cookie },
    });
    const { integrations } = await listIntRes.json();
    assert.equal(integrations.length, 1);
    assert.equal(integrations[0].credentials_masked.api_token, "••••9876");

    // 4. Create product & COD order, confirm, ship via manual
    const prodRes = await fetch(`${base}/api/stores/${store.id}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Watch", slug: "watch", priceDzd: 6000, stock: 5 }),
    });
    const { product } = await prodRes.json();

    const ordRes = await fetch(`${base}/api/storefront/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Store-Host": `${slug}.localhost` },
      body: JSON.stringify({
        customerName: "Yacine",
        phone: "0661223344",
        wilayaId: 16,
        deliveryType: "home",
        items: [{ productId: product.id, qty: 1 }],
      }),
    });
    const { order } = await ordRes.json();

    await fetch(`${base}/api/stores/${store.id}/orders/${order.id}/confirm`, {
      method: "POST",
      headers: { Cookie: cookie },
    });

    const shipRes = await fetch(`${base}/api/stores/${store.id}/orders/${order.id}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ carrierCode: "manual" }),
    });
    assert.equal(shipRes.status, 201);
    const { shipment } = await shipRes.json();
    assert.ok(shipment.tracking_number.startsWith("MAN-"));

    // 5. Listen for shipment.delivered event & mark manual shipment delivered
    let deliveredEmitted = false;
    const listener = (ev) => {
      if (ev.orderId === order.id) deliveredEmitted = true;
    };
    shippingEvents.on("shipment.delivered", listener);

    const updRes = await fetch(`${base}/api/stores/${store.id}/shipments/${shipment.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ status: "delivered" }),
    });
    assert.equal(updRes.status, 200);
    const updBody = await updRes.json();
    assert.equal(updBody.shipment.status, "delivered");
    assert.ok(updBody.shipment.delivered_at);
    assert.equal(deliveredEmitted, true);
    shippingEvents.off("shipment.delivered", listener);

    // 6. Verify Yalidine webhook parsing + deduplication
    const yalCarrier = carriers.find((c) => c.code === "yalidine");
    const yalTracking = `yal-${suffix}`;
    await pool.query(
      `UPDATE shipments SET carrier_id = $1, tracking_number = $2, status = 'in_transit', delivered_at = NULL WHERE id = $3`,
      [yalCarrier.id, yalTracking, shipment.id]
    );

    const whRes = await fetch(`${base}/api/webhooks/shipping/yalidine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: whEventId, tracking: yalTracking, last_status: "Livré" }),
    });
    assert.equal(whRes.status, 200);

    const shipCheck = await pool.query("SELECT status FROM shipments WHERE id = $1", [shipment.id]);
    assert.equal(shipCheck.rows[0].status, "delivered");

    const dupWhRes = await fetch(`${base}/api/webhooks/shipping/yalidine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: whEventId, tracking: yalTracking, last_status: "Livré" }),
    });
    const dupBody = await dupWhRes.json();
    assert.equal(dupBody.duplicate, true);
  } finally {
    globalThis.fetch = origFetch;
    await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
    await pool.query("DELETE FROM webhook_events WHERE external_id = $1", [whEventId]);
    server.close();
    await pool.end();
  }
});
