import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.CHARGILY_API_KEY = process.env.CHARGILY_API_KEY || "platform-chargily-secret";

const { runMigrations } = await import("../src/db/migrate.js");
const { runSeeds } = await import("../src/db/seeds/seed.js");
const { default: pool } = await import("../src/db/pool.js");
const { createApp } = await import("../src/app.js");

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

function signWebhook(rawBody, secret) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

test("Phase 8: Per-store Chargily online checkout and signed store webhook", async () => {
  await runMigrations();
  await runSeeds();

  const storeChargilyKey = "store_test_sk_1234567890";
  const suffix = Date.now();
  const fakeCheckoutId = `chk_store_${suffix}`;
  const fakeEventId = `evt_store_${suffix}`;
  const chargilyCalls = [];
  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith("https://pay.chargily.net/")) {
      chargilyCalls.push({
        url: String(url),
        auth: opts.headers?.Authorization,
        body: JSON.parse(opts.body),
      });
      return new Response(
        JSON.stringify({
          id: fakeCheckoutId,
          checkout_url: `https://pay.chargily.net/checkout/${fakeCheckoutId}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return origFetch(url, opts);
  };

  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const email = `p8_${suffix}@test.dz`;
  const slug = `p8shop-${suffix}`;

  try {
    const signup = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ name: "Phase8 Merchant", email, password: "Password123!" }),
    });
    const cookie = extractCookies(signup);

    const storeRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "Chargily Store", slug, language: "ar" }),
    });
    const { store } = await storeRes.json();
    await pool.query("UPDATE stores SET status = 'active', online_payment_enabled = TRUE WHERE id = $1", [
      store.id,
    ]);

    // 1. Configure store Chargily key
    const cfgRes = await fetch(`${base}/api/stores/${store.id}/integrations/chargily`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ apiKey: storeChargilyKey, mode: "test" }),
    });
    assert.equal(cfgRes.status, 200);

    const prodRes = await fetch(`${base}/api/stores/${store.id}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Jacket", slug: "jacket", priceDzd: 7500, stock: 5 }),
    });
    const { product } = await prodRes.json();

    // 2. Customer places EDAHABIA order -> gets checkoutUrl using store's key
    const ordRes = await fetch(`${base}/api/storefront/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Store-Host": `${slug}.localhost` },
      body: JSON.stringify({
        customerName: "Nabil",
        phone: "0770112233",
        wilayaId: 16,
        deliveryType: "home",
        paymentMethod: "edahabia",
        items: [{ productId: product.id, qty: 1 }],
      }),
    });
    assert.equal(ordRes.status, 201);
    const { order, checkoutUrl } = await ordRes.json();
    assert.equal(order.payment_status, "pending");
    assert.equal(order.status, "pending_confirmation");
    assert.equal(checkoutUrl, `https://pay.chargily.net/checkout/${fakeCheckoutId}`);
    assert.equal(chargilyCalls.length, 1);
    assert.equal(chargilyCalls[0].auth, `Bearer ${storeChargilyKey}`);
    assert.ok(chargilyCalls[0].body.webhook_endpoint.endsWith(`/api/webhooks/chargily/stores/${store.id}`));

    // 3. Per-store webhook verifies store's signature and confirms order
    const payload = JSON.stringify({
      id: fakeEventId,
      type: "checkout.paid",
      data: {
        id: fakeCheckoutId,
        metadata: chargilyCalls[0].body.metadata,
      },
    });

    const badRes = await fetch(`${base}/api/webhooks/chargily/stores/${store.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", signature: "wrong" },
      body: payload,
    });
    assert.equal(badRes.status, 401);

    const sig = signWebhook(payload, storeChargilyKey);
    const goodRes = await fetch(`${base}/api/webhooks/chargily/stores/${store.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", signature: sig },
      body: payload,
    });
    assert.equal(goodRes.status, 200);

    const ordCheck = await fetch(`${base}/api/stores/${store.id}/orders/${order.id}`, {
      headers: { Cookie: cookie },
    });
    const ordDetail = await ordCheck.json();
    assert.equal(ordDetail.order.payment_status, "paid");
    assert.equal(ordDetail.order.status, "confirmed");

    // Duplicate webhook is a no-op
    const dupRes = await fetch(`${base}/api/webhooks/chargily/stores/${store.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", signature: sig },
      body: payload,
    });
    const dupBody = await dupRes.json();
    assert.equal(dupBody.duplicate, true);
  } finally {
    globalThis.fetch = origFetch;
    await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
    await pool.query("DELETE FROM webhook_events WHERE external_id = $1", [fakeEventId]);
    server.close();
    await pool.end();
  }
});
