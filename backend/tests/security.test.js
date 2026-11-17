import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.CHARGILY_API_KEY = process.env.CHARGILY_API_KEY || "test-chargily-secret";

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

test("Security regressions (S1-S19)", async () => {
  await runMigrations();
  await runSeeds();

  const origFetch = globalThis.fetch;
  // Carrier API says parcel is still in_transit (even if forged webhook claims Livré)
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith("https://api.yalidine.app/v1/parcels/")) {
      const u = new URL(String(url));
      const tracking = u.searchParams.get("tracking");
      return new Response(
        JSON.stringify({ data: [{ tracking, last_status: "En transit" }] }),
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
  const email = `sec_${suffix}@test.dz`;
  const slug = `secshop-${suffix}`;
  const whId = `sec_wh_${suffix}`;
  const payWhId = `sec_pay_${suffix}`;

  try {
    // S16: Signup with role: 'admin' is ignored -> user stays 'merchant'
    const signup = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({
        name: "Sec Merchant",
        email,
        password: "Password123!",
        role: "admin",
      }),
    });
    assert.equal(signup.status, 200);
    const cookie = extractCookies(signup);
    const userRow = await pool.query('SELECT role FROM "user" WHERE email = $1', [email]);
    assert.equal(userRow.rows[0].role, "merchant");

    // S11: Security headers & no X-Powered-By
    const healthRes = await fetch(`${base}/health`);
    assert.equal(healthRes.headers.get("x-powered-by"), null);
    assert.equal(healthRes.headers.get("x-content-type-options"), "nosniff");
    assert.equal(healthRes.headers.get("x-frame-options"), "DENY");

    // S7: CSRF origin guard blocks cross-site & untrusted Origin on POST /api/stores
    const csrf1 = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        "Sec-Fetch-Site": "cross-site",
      },
      body: JSON.stringify({ name: "CSRF Shop", slug }),
    });
    assert.equal(csrf1.status, 403);

    const csrf2 = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ name: "CSRF Shop", slug }),
    });
    assert.equal(csrf2.status, 403);

    // Create store legitimately with unverified customDomain
    const storeRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        name: "Sec Shop",
        slug,
        language: "ar",
        customDomain: `evil-${suffix}.example.com`,
      }),
    });
    assert.equal(storeRes.status, 201);
    const { store } = await storeRes.json();
    await pool.query("UPDATE stores SET status = 'active' WHERE id = $1", [store.id]);

    // S5: Attacker subdomain cannot resolve store
    const spoofRes = await fetch(`${base}/api/storefront/store`, {
      headers: { "X-Store-Host": `${slug}.attacker.com` },
    });
    assert.equal(spoofRes.status, 404);

    // S8: Unverified custom domain is not routed & domain-check returns 404
    const unverifiedDomainCheck = await fetch(
      `${base}/internal/domain-check?domain=evil-${suffix}.example.com`
    );
    assert.equal(unverifiedDomainCheck.status, 404);

    // S6: Public store payload does NOT leak settings or capi_enabled
    const sfRes = await fetch(`${base}/api/storefront/store`, {
      headers: { "X-Store-Host": `${slug}.localhost` },
    });
    assert.equal(sfRes.status, 200);
    const sfBody = await sfRes.json();
    assert.equal(sfBody.store.settings, undefined);
    assert.equal(sfBody.store.capi_enabled, undefined);

    // S2: Stored XSS in theme ctaHref / imageUrl rejected with 400
    const xssThemeRes = await fetch(`${base}/api/stores/${store.id}/themes/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        theme: {
          tokens: {
            colors: {
              primary: "#111111",
              background: "#FFFFFF",
              surface: "#F9FAFB",
              text: "#111111",
              muted: "#6B7280",
            },
            font: "Cairo",
            radius: "lg",
            direction: "rtl",
          },
          pages: {
            home: {
              sections: [
                {
                  type: "hero",
                  props: {
                    title: "Hello",
                    ctaHref: "javascript:alert(1)",
                    imageUrl: "",
                  },
                },
              ],
            },
            product: { layout: "landing_page", showRelated: true },
          },
        },
      }),
    });
    assert.equal(xssThemeRes.status, 400);

    // S13: Fake PNG magic bytes rejected
    const prodRes = await fetch(`${base}/api/stores/${store.id}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Item", slug: "item", priceDzd: 1000, stock: 5 }),
    });
    const { product } = await prodRes.json();

    const fakeImgRes = await fetch(`${base}/api/stores/${store.id}/products/${product.id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        dataUrl: `data:image/png;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`,
      }),
    });
    assert.equal(fakeImgRes.status, 400);

    // S12: Global JSON body > 100kb rejected with 413
    const bigBodyRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "A".repeat(150_000), slug: `big-${suffix}` }),
    });
    assert.equal(bigBodyRes.status, 413);

    // S1: Forged shipping webhook claiming Livré cannot mark delivered when carrier API says En transit
    await fetch(`${base}/api/stores/${store.id}/integrations/carrier/yalidine`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ credentials: { api_id: "id", api_token: "tok" } }),
    });
    const ordRes = await fetch(`${base}/api/storefront/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Store-Host": `${slug}.localhost` },
      body: JSON.stringify({
        customerName: "Ali",
        phone: "0550112233",
        wilayaId: 16,
        deliveryType: "home",
        items: [{ productId: product.id, qty: 1 }],
      }),
    });
    const { order } = await ordRes.json();
    const yalRes = await pool.query("SELECT id FROM carriers WHERE code = 'yalidine'");
    const tracking = `yal-sec-${suffix}`;
    await pool.query(
      `INSERT INTO shipments (order_id, carrier_id, tracking_number, status)
       VALUES ($1, $2, $3, 'in_transit')`,
      [order.id, yalRes.rows[0].id, tracking]
    );

    const forgedWh = await fetch(`${base}/api/webhooks/shipping/yalidine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: whId, tracking, last_status: "Livré" }),
    });
    assert.equal(forgedWh.status, 200);
    const shipAfter = await pool.query("SELECT status FROM shipments WHERE tracking_number = $1", [
      tracking,
    ]);
    assert.equal(shipAfter.rows[0].status, "in_transit");

    // S9: Store Chargily webhook with mismatched amount rejected with 400
    await fetch(`${base}/api/stores/${store.id}/integrations/chargily`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ apiKey: "test_sk_sec_12345", mode: "test", isActive: true }),
    });
    const orderRow = await pool.query(
      `INSERT INTO orders (store_id, payment_method, payment_status, customer_name, phone, wilaya_id, subtotal_dzd, shipping_fee_dzd, total_dzd)
       VALUES ($1, 'edahabia', 'pending', 'Test User', '0550000001', 16, 1000, 0, 1000) RETURNING id`,
      [store.id]
    );
    const payRes = await pool.query(
      `INSERT INTO payments (order_id, provider, chargily_checkout_id, amount_dzd, status)
       VALUES ($1, 'chargily', $2, 1000, 'pending') RETURNING id`,
      [orderRow.rows[0].id, `chk_sec_${suffix}`]
    );
    const badAmtPayload = JSON.stringify({
      id: payWhId,
      type: "checkout.paid",
      data: {
        id: `chk_sec_${suffix}`,
        amount: 10,
        currency: "dzd",
        metadata: { paymentId: payRes.rows[0].id },
      },
    });
    const badAmtRes = await fetch(`${base}/api/webhooks/chargily/stores/${store.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        signature: signWebhook(badAmtPayload, "test_sk_sec_12345"),
      },
      body: badAmtPayload,
    });
    assert.equal(badAmtRes.status, 400);

    // S20: CSRF origin guard blocks untrusted Referer when Origin is absent
    const csrfRefRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Referer: "https://evil.example/attack.html",
      },
      body: JSON.stringify({ name: "CSRF Ref", slug: `ref-${suffix}` }),
    });
    assert.equal(csrfRefRes.status, 403);

    // S21: Duplicate line-item stock bypass rejected with 400
    const lowStockProdRes = await fetch(`${base}/api/stores/${store.id}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Limited Item", slug: `limited-${suffix}`, priceDzd: 1000, stock: 2 }),
    });
    assert.equal(lowStockProdRes.status, 201);
    const { product: limitedProduct } = await lowStockProdRes.json();

    const dupLineRes = await fetch(`${base}/api/storefront/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Store-Host": `${slug}.localhost` },
      body: JSON.stringify({
        customerName: "Ali",
        phone: "0550223344",
        wilayaId: 16,
        deliveryType: "home",
        items: [
          { productId: limitedProduct.id, qty: 2 },
          { productId: limitedProduct.id, qty: 1 },
        ],
      }),
    });
    assert.equal(dupLineRes.status, 400);

    // S22: Invalid pixelId path traversal rejected with 400
    const badPixelRes = await fetch(`${base}/api/stores/${store.id}/integrations/meta`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        pixelId: "123/../../me",
        accessToken: "EAABsbCS1234567890",
      }),
    });
    assert.equal(badPixelRes.status, 400);

    // S23: /uploads path traversal in product image URL rejected with 400
    const traversalImgRes = await fetch(`${base}/api/stores/${store.id}/products/${product.id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ url: "/uploads/../etc/passwd" }),
    });
    assert.equal(traversalImgRes.status, 400);

    // S24: /uploads serves restrictive Content-Security-Policy header
    const uploadsRes = await fetch(`${base}/uploads/nonexistent.png`);
    assert.ok(uploadsRes.headers.get("content-security-policy")?.includes("sandbox"));
  } finally {
    globalThis.fetch = origFetch;
    await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
    await pool.query("DELETE FROM webhook_events WHERE external_id IN ($1, $2)", [whId, payWhId]);
    server.close();
    await pool.end();
  }
});
