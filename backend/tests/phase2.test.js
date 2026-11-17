process.env.CHARGILY_API_KEY = process.env.CHARGILY_API_KEY || "test-chargily-secret";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { runMigrations } from "../src/db/migrate.js";
import { runSeeds } from "../src/db/seeds/seed.js";
import pool from "../src/db/pool.js";
import { createApp } from "../src/app.js";

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

// 1x1 transparent PNG
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test("Phase 2: Catalog CRUD, theme validation, draft preview, and storefront API", async () => {
  await runMigrations();
  await runSeeds();

  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const suffix = Date.now();
  const email = `p2_${suffix}@test.dz`;
  const slug = `p2shop-${suffix}`;
  let storeId = null;

  try {
    // 1. Sign up merchant & create draft store
    const signup = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ name: "Phase2 Merchant", email, password: "Password123!" }),
    });
    assert.equal(signup.status, 200);
    const cookie = extractCookies(signup);

    const storeRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "Oud Royale", slug, language: "ar" }),
    });
    assert.equal(storeRes.status, 201);
    const { store } = await storeRes.json();
    storeId = store.id;
    assert.equal(store.status, "draft");

    // 2. Storefront blocks draft store without preview token
    const blockedRes = await fetch(`${base}/api/storefront/store`, {
      headers: { "X-Store-Host": `${slug}.localhost` },
    });
    assert.equal(blockedRes.status, 403);

    // 3. Create product with variant and local PNG image
    const prodRes = await fetch(`${base}/api/stores/${storeId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        title: "Royal Oud Perfume",
        slug: "royal-oud",
        description: "Long lasting oud",
        priceDzd: 4500,
        compareAtDzd: 5500,
        stock: 20,
        variants: [{ title: "100ml", priceDzd: 4500, stock: 20, options: { size: "100ml" } }],
      }),
    });
    assert.equal(prodRes.status, 201);
    const { product } = await prodRes.json();
    assert.equal(product.variants.length, 1);

    const imgRes = await fetch(`${base}/api/stores/${storeId}/products/${product.id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ dataUrl: TINY_PNG_DATA_URL }),
    });
    assert.equal(imgRes.status, 201);
    const { image } = await imgRes.json();
    assert.ok(image.url.startsWith(`/uploads/${storeId}/`));

    // 4. Theme schema rejects invalid colors / fonts
    const badThemeRes = await fetch(`${base}/api/stores/${storeId}/themes/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        theme: {
          tokens: {
            colors: { primary: "red", background: "#FFFFFF", surface: "#FFFFFF", text: "#000000", muted: "#666666" },
            font: "ComicSans",
            radius: "lg",
            direction: "rtl",
          },
          pages: { home: { sections: [] }, product: { layout: "landing_page", showRelated: true } },
        },
      }),
    });
    assert.equal(badThemeRes.status, 400);

    // 5. Save starter template as draft theme and publish it
    const draftRes = await fetch(`${base}/api/stores/${storeId}/themes/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ templateKey: "modern_ar" }),
    });
    assert.equal(draftRes.status, 201);
    const { theme: draftTheme } = await draftRes.json();

    const pubThemeRes = await fetch(`${base}/api/stores/${storeId}/themes/${draftTheme.id}/publish`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(pubThemeRes.status, 200);

    // 6. Generate preview token and verify storefront endpoints work for draft store
    const tokRes = await fetch(`${base}/api/stores/${storeId}/themes/preview-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ themeId: draftTheme.id }),
    });
    assert.equal(tokRes.status, 200);
    const { previewToken } = await tokRes.json();

    const sfThemeRes = await fetch(`${base}/api/storefront/theme?preview=${previewToken}`, {
      headers: { "X-Store-Host": `${slug}.localhost` },
    });
    assert.equal(sfThemeRes.status, 200);
    const sfTheme = await sfThemeRes.json();
    assert.equal(sfTheme.preview, true);
    assert.equal(sfTheme.theme.tokens.font, "Cairo");

    const sfProdsRes = await fetch(`${base}/api/storefront/products?preview=${previewToken}`, {
      headers: { "X-Store-Host": `${slug}.localhost` },
    });
    assert.equal(sfProdsRes.status, 200);
    const sfProds = await sfProdsRes.json();
    assert.equal(sfProds.products.length, 1);
    assert.equal(sfProds.products[0].images.length, 1);

    const sfProdRes = await fetch(`${base}/api/storefront/products/royal-oud?preview=${previewToken}`, {
      headers: { "X-Store-Host": `${slug}.localhost` },
    });
    assert.equal(sfProdRes.status, 200);
    const sfProd = await sfProdRes.json();
    assert.equal(sfProd.product.price_dzd, 4500);
  } finally {
    await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
    if (storeId) {
      await fs.rm(path.resolve("uploads", storeId), { recursive: true, force: true });
    }
    server.close();
    await pool.end();
  }
});
