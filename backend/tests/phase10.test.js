import test from "node:test";
import assert from "node:assert/strict";

process.env.DEPLOYMENT_MODE = "self_hosted";
process.env.NODE_ENV = "test";


const { runMigrations } = await import("../src/db/migrate.js");
const { runSeeds } = await import("../src/db/seeds/seed.js");
const { default: pool } = await import("../src/db/pool.js");
const { createApp } = await import("../src/app.js");

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

test("Phase 10: Self-hosted mode disables platform billing/admin and activates stores immediately", async () => {
  await runMigrations();
  await runSeeds();

  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const suffix = Date.now();
  const email = `p10_${suffix}@test.dz`;
  const slug = `p10shop-${suffix}`;

  try {
    const healthRes = await fetch(`${base}/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.mode, "self_hosted");

    const signup = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ name: "SelfHosted Merchant", email, password: "Password123!" }),
    });
    const cookie = extractCookies(signup);

    // Store is active immediately in self_hosted mode
    const storeRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "My Own Store", slug, language: "ar" }),
    });
    assert.equal(storeRes.status, 201);
    const { store } = await storeRes.json();
    assert.equal(store.status, "active");

    // Storefront resolves immediately
    const sfRes = await fetch(`${base}/api/storefront/store`, {
      headers: { "X-Store-Host": `${slug}.localhost` },
    });
    assert.equal(sfRes.status, 200);

    // Cloud-only billing and admin routes return 404
    const plansRes = await fetch(`${base}/api/plans`);
    assert.equal(plansRes.status, 404);

    const billingRes = await fetch(`${base}/api/stores/${store.id}/billing`, {
      headers: { Cookie: cookie },
    });
    assert.equal(billingRes.status, 404);

    const adminRes = await fetch(`${base}/api/admin/overview`, {
      headers: { Cookie: cookie },
    });
    assert.equal(adminRes.status, 404);
  } finally {
    await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
    server.close();
    await pool.end();
  }
});
