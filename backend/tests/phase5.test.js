process.env.CHARGILY_API_KEY = process.env.CHARGILY_API_KEY || "test-chargily-secret";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { runMigrations } from "../src/db/migrate.js";
import { runSeeds } from "../src/db/seeds/seed.js";
import pool from "../src/db/pool.js";
import { createApp } from "../src/app.js";

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

test("Phase 5: Meta CAPI Lead on checkout, Purchase on delivery, value=subtotal, and retry", async () => {
  await runMigrations();
  await runSeeds();

  const capturedMetaCalls = [];
  let failNextMetaCall = false;
  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith("https://graph.facebook.com/")) {
      const body = JSON.parse(opts.body);
      capturedMetaCalls.push({ url: String(url), body });
      if (failNextMetaCall) {
        failNextMetaCall = false;
        return new Response(JSON.stringify({ error: { message: "Temporary Meta error" } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ events_received: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return origFetch(url, opts);
  };

  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const suffix = Date.now();
  const email = `p5_${suffix}@test.dz`;
  const slug = `p5shop-${suffix}`;

  try {
    // 1. Setup merchant, active store, Meta integration, product, and shipping rate
    const signup = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ name: "Phase5 Merchant", email, password: "Password123!" }),
    });
    const cookie = extractCookies(signup);

    const storeRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "Meta Store", slug, language: "ar" }),
    });
    const { store } = await storeRes.json();
    await pool.query("UPDATE stores SET status = 'active' WHERE id = $1", [store.id]);

    const metaRes = await fetch(`${base}/api/stores/${store.id}/integrations/meta`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        pixelId: "1234567890",
        accessToken: "EAABsbCS1234567890",
        testEventCode: "TEST1234",
      }),
    });
    assert.equal(metaRes.status, 200);

    const prodRes = await fetch(`${base}/api/stores/${store.id}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Sneakers", slug: "sneakers", priceDzd: 4000, stock: 10 }),
    });
    const { product } = await prodRes.json();

    await fetch(`${base}/api/stores/${store.id}/shipping-rates`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        carrierCode: "manual",
        rates: [{ wilayaId: 16, homePriceDzd: 600, stopdeskPriceDzd: 400 }],
      }),
    });

    // 2. Place COD order -> triggers Lead (value=4000, NOT 4600), no Purchase yet
    const ordRes = await fetch(`${base}/api/storefront/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Store-Host": `${slug}.localhost` },
      body: JSON.stringify({
        customerName: "Amine Khelifi",
        phone: "0555112233",
        wilayaId: 16,
        deliveryType: "home",
        items: [{ productId: product.id, qty: 1 }],
        fbp: "fb.1.111.222",
      }),
    });
    assert.equal(ordRes.status, 201);
    const { order, leadEventId } = await ordRes.json();
    assert.equal(order.total_dzd, 4600);

    // Wait briefly for async Lead dispatch
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(capturedMetaCalls.length, 1);
    const leadEv = capturedMetaCalls[0].body.data[0];
    assert.equal(leadEv.event_name, "Lead");
    assert.equal(leadEv.event_id, leadEventId);
    assert.equal(leadEv.custom_data.value, 4000);
    assert.equal(leadEv.custom_data.currency, "DZD");
    assert.equal(capturedMetaCalls[0].body.test_event_code, "TEST1234");
    const expectedPhoneHash = crypto.createHash("sha256").update("213555112233").digest("hex");
    assert.equal(leadEv.user_data.ph[0], expectedPhoneHash);

    // 3. Ship & mark delivered (simulate one failure then manual retry)
    await fetch(`${base}/api/stores/${store.id}/orders/${order.id}/confirm`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    const shipRes = await fetch(`${base}/api/stores/${store.id}/orders/${order.id}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ carrierCode: "manual" }),
    });
    const { shipment } = await shipRes.json();

    failNextMetaCall = true;
    await fetch(`${base}/api/stores/${store.id}/shipments/${shipment.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ status: "delivered" }),
    });

    await new Promise((r) => setTimeout(r, 80));
    assert.equal(capturedMetaCalls.length, 2);
    assert.equal(capturedMetaCalls[1].body.data[0].event_name, "Purchase");
    assert.equal(capturedMetaCalls[1].body.data[0].custom_data.value, 4000);

    // Check CAPI event log shows Purchase as failed, then retry it
    const logRes1 = await fetch(`${base}/api/stores/${store.id}/capi/events`, {
      headers: { Cookie: cookie },
    });
    const log1 = await logRes1.json();
    assert.equal(log1.summary.sent, 1);
    assert.equal(log1.summary.failed, 1);
    const failedPurchase = log1.events.find((e) => e.event_name === "Purchase");
    assert.ok(failedPurchase);

    const retryRes = await fetch(`${base}/api/stores/${store.id}/capi/events/${failedPurchase.id}/retry`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(retryRes.status, 200);
    const retryBody = await retryRes.json();
    assert.equal(retryBody.sent, true);

    const logRes2 = await fetch(`${base}/api/stores/${store.id}/capi/events`, {
      headers: { Cookie: cookie },
    });
    const log2 = await logRes2.json();
    assert.equal(log2.summary.sent, 2);
    assert.equal(log2.summary.failed, 0);
  } finally {
    globalThis.fetch = origFetch;
    await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
    server.close();
    await pool.end();
  }
});
