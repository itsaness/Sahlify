process.env.CHARGILY_API_KEY = process.env.CHARGILY_API_KEY || "test-chargily-secret";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { runMigrations } from "../src/db/migrate.js";
import { runSeeds } from "../src/db/seeds/seed.js";
import pool from "../src/db/pool.js";
import { createApp } from "../src/app.js";

function signWebhook(rawBody, secret) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

test("Phase 1: Stores CRUD, ownership & storefront host resolution", async () => {
  await runMigrations();
  await runSeeds();

  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const suffix = Date.now();
  const email1 = `m1_${suffix}@test.dz`;
  const email2 = `m2_${suffix}@test.dz`;
  const slug = `shop-${suffix}`;
  const checkoutId = `chk_test_${suffix}`;
  const eventId = `evt_test_${suffix}`;

  try {
    // 1. Sign up merchant 1 and merchant 2
    const signup1 = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ name: "Merchant One", email: email1, password: "Password123!" }),
    });
    assert.equal(signup1.status, 200);
    const cookie1 = extractCookies(signup1);
    assert.ok(cookie1.length > 0);

    const signup2 = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ name: "Merchant Two", email: email2, password: "Password123!" }),
    });
    assert.equal(signup2.status, 200);
    const cookie2 = extractCookies(signup2);

    // 2. Create store (starts as draft in cloud mode)
    const createRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie1 },
      body: JSON.stringify({ name: "Test Shop", slug, language: "ar" }),
    });
    assert.equal(createRes.status, 201);
    const { store } = await createRes.json();
    assert.equal(store.status, "draft");
    assert.equal(store.slug, slug);

    // 3. Another merchant gets 403
    const otherRes = await fetch(`${base}/api/stores/${store.id}`, {
      headers: { Cookie: cookie2 },
    });
    assert.equal(otherRes.status, 403);

    // 4. Draft store is blocked on storefront until subscribed
    const sfRes = await fetch(`${base}/api/storefront/store`, {
      headers: { "X-Store-Host": `${slug}.localhost:3000` },
    });
    assert.equal(sfRes.status, 403);
  } finally {
    await pool.query('DELETE FROM "user" WHERE email IN ($1, $2)', [email1, email2]);
    server.close();
    await pool.end();
  }
});
