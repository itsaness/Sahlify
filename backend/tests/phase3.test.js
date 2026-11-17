process.env.CHARGILY_API_KEY = process.env.CHARGILY_API_KEY || "test-chargily-secret";

import test from "node:test";
import assert from "node:assert/strict";
import { runMigrations } from "../src/db/migrate.js";
import { runSeeds } from "../src/db/seeds/seed.js";
import pool from "../src/db/pool.js";
import { createApp } from "../src/app.js";

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

test("Phase 3: Wilayas, shipping rates, COD checkout, blacklist, and order confirmation", async () => {
  await runMigrations();
  await runSeeds();

  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const suffix = Date.now();
  const email = `p3_${suffix}@test.dz`;
  const slug = `p3shop-${suffix}`;

  try {
    // 1. Wilayas endpoint returns 69 wilayas
    const wilRes = await fetch(`${base}/api/wilayas`);
    assert.equal(wilRes.status, 200);
    const { wilayas } = await wilRes.json();
    assert.equal(wilayas.length, 69);

    // 2. Sign up merchant, create store, activate it for test, create product & shipping rate
    const signup = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ name: "Phase3 Merchant", email, password: "Password123!" }),
    });
    const cookie = extractCookies(signup);

    const storeRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "Sahlify DZ", slug, language: "ar" }),
    });
    const { store } = await storeRes.json();
    await pool.query("UPDATE stores SET status = 'active' WHERE id = $1", [store.id]);

    const prodRes = await fetch(`${base}/api/stores/${store.id}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        title: "Leather Bag",
        slug: "leather-bag",
        priceDzd: 3500,
        stock: 10,
      }),
    });
    const { product } = await prodRes.json();

    const rateRes = await fetch(`${base}/api/stores/${store.id}/shipping-rates`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        carrierCode: "manual",
        rates: [{ wilayaId: 16, homePriceDzd: 500, stopdeskPriceDzd: 300 }],
      }),
    });
    assert.equal(rateRes.status, 200);

    // 3. Invalid phone rejected
    const badPhoneRes = await fetch(`${base}/api/storefront/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Store-Host": `${slug}.localhost` },
      body: JSON.stringify({
        customerName: "Ali",
        phone: "12345",
        wilayaId: 16,
        deliveryType: "home",
        items: [{ productId: product.id, qty: 1 }],
      }),
    });
    assert.equal(badPhoneRes.status, 400);

    // 4. Valid COD order calculates subtotal + shipping server-side
    const orderRes = await fetch(`${base}/api/storefront/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Store-Host": `${slug}.localhost` },
      body: JSON.stringify({
        customerName: "Karim Benali",
        phone: "+213 551 23 45 67",
        wilayaId: 16,
        deliveryType: "home",
        address: "Hydra, Alger",
        items: [{ productId: product.id, qty: 2 }],
        fbp: "fb.1.12345.67890",
      }),
    });
    assert.equal(orderRes.status, 201);
    const { order, leadEventId } = await orderRes.json();
    assert.equal(order.phone, "0551234567");
    assert.equal(order.subtotal_dzd, 7000);
    assert.equal(order.shipping_fee_dzd, 500);
    assert.equal(order.total_dzd, 7500);
    assert.equal(order.status, "pending_confirmation");
    assert.equal(leadEventId, `order_${order.id}_lead`);

    // 5. Merchant confirms order
    const confRes = await fetch(`${base}/api/stores/${store.id}/orders/${order.id}/confirm`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(confRes.status, 200);
    const confBody = await confRes.json();
    assert.equal(confBody.order.status, "confirmed");

    // 6. Blacklist blocks future orders from that phone
    const blRes = await fetch(`${base}/api/stores/${store.id}/orders/blacklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ phone: "0551234567", reason: "Refused parcel" }),
    });
    assert.equal(blRes.status, 201);

    const blockedOrderRes = await fetch(`${base}/api/storefront/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Store-Host": `${slug}.localhost` },
      body: JSON.stringify({
        customerName: "Karim",
        phone: "0551234567",
        wilayaId: 16,
        deliveryType: "home",
        items: [{ productId: product.id, qty: 1 }],
      }),
    });
    assert.equal(blockedOrderRes.status, 403);
  } finally {
    await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
    server.close();
    await pool.end();
  }
});
