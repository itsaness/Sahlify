import test from "node:test";
import assert from "node:assert/strict";

process.env.AI_PROVIDER = "openrouter";
process.env.AI_API_KEY = "test-openrouter-key";
process.env.AI_ZDR = "true";
process.env.AI_MODEL_LARGE = "anthropic/claude-sonnet-4";
process.env.AI_MODEL_SMALL = "anthropic/claude-3.5-haiku";

const { runMigrations } = await import("../src/db/migrate.js");
const { runSeeds } = await import("../src/db/seeds/seed.js");
const { default: pool } = await import("../src/db/pool.js");
const { createApp } = await import("../src/app.js");

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

const VALID_THEME = {
  tokens: {
    colors: {
      primary: "#C9A227",
      background: "#0B0B0B",
      surface: "#171717",
      text: "#FFFFFF",
      muted: "#A3A3A3",
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
            title: "عطور فاخرة",
            subtitle: "أفضل العطور الشرقية",
            ctaText: "تسوق الآن",
            ctaHref: "#products",
            imageUrl: "",
          },
        },
        { type: "product_grid", props: { title: "منتجاتنا", columns: 3, limit: 12 } },
      ],
    },
    product: { layout: "landing_page", showRelated: true },
  },
};

test("Phase 7: AI subscription gate, Claude tiering + retry on invalid schema, and token usage", async () => {
  await runMigrations();
  await runSeeds();

  const llmCalls = [];
  let returnInvalidOnce = true;
  const origFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (String(url) === "https://openrouter.ai/api/v1/chat/completions") {
      const body = JSON.parse(opts.body);
      llmCalls.push(body);

      if (returnInvalidOnce) {
        returnInvalidOnce = false;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"tokens":{"colors":{"primary":"not-hex"}}}' } }],
            usage: { prompt_tokens: 100, completion_tokens: 20 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      const nextTheme = structuredClone(VALID_THEME);
      if (body.model.includes("haiku")) {
        nextTheme.tokens.colors.primary = "#10B981";
      }

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(nextTheme) } }],
          usage: { prompt_tokens: 250, completion_tokens: 180 },
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

  const suffix = Date.now();
  const email = `p7_${suffix}@test.dz`;
  const slug = `p7shop-${suffix}`;

  try {
    const signup = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ name: "Phase7 Merchant", email, password: "Password123!" }),
    });
    const cookie = extractCookies(signup);

    const storeRes = await fetch(`${base}/api/stores`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ name: "Oud AI", slug, language: "ar" }),
    });
    const { store } = await storeRes.json();

    // 1. Unpaid store -> 402
    const unpaidRes = await fetch(`${base}/api/stores/${store.id}/ai/generate-theme`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ prompt: "luxury perfume store gold and black" }),
    });
    assert.equal(unpaidRes.status, 402);

    // 2. Activate subscription -> generate-theme uses Sonnet, retries invalid JSON, saves draft
    const planRes = await pool.query("SELECT id FROM plans WHERE code = 'standard'");
    await pool.query(
      `INSERT INTO store_subscriptions (store_id, plan_id, status, current_period_end)
       VALUES ($1, $2, 'active', NOW() + INTERVAL '1 month')`,
      [store.id, planRes.rows[0].id]
    );

    const genRes = await fetch(`${base}/api/stores/${store.id}/ai/generate-theme`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ prompt: "luxury perfume store gold and black" }),
    });
    assert.equal(genRes.status, 201);
    const genBody = await genRes.json();
    assert.equal(genBody.theme.created_by, "ai");
    assert.equal(genBody.theme.status, "draft");
    assert.equal(genBody.theme.theme.tokens.colors.primary, "#C9A227");
    assert.equal(llmCalls.length, 2);
    assert.ok(llmCalls[0].model.includes("sonnet"));
    assert.equal(llmCalls[0].provider?.zdr, true);

    // 3. Edit-theme uses Haiku and creates version 2
    const editRes = await fetch(`${base}/api/stores/${store.id}/ai/edit-theme`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ prompt: "make primary color emerald green" }),
    });
    assert.equal(editRes.status, 201);
    const editBody = await editRes.json();
    assert.equal(editBody.theme.version, 2);
    assert.equal(editBody.theme.theme.tokens.colors.primary, "#10B981");
    assert.ok(llmCalls[2].model.includes("haiku"));
    assert.equal(llmCalls[2].provider?.zdr, true);

    // 4. Usage endpoint reports tokens
    const usageRes = await fetch(`${base}/api/stores/${store.id}/ai/usage`, {
      headers: { Cookie: cookie },
    });
    assert.equal(usageRes.status, 200);
    const usageBody = await usageRes.json();
    assert.equal(usageBody.aiEnabled, true);
    const themeUsage = usageBody.usageThisMonth.find((u) => u.kind === "theme");
    assert.equal(themeUsage.tokens_in, 350);
    assert.equal(themeUsage.tokens_out, 200);
  } finally {
    globalThis.fetch = origFetch;
    await pool.query('DELETE FROM "user" WHERE email = $1', [email]);
    server.close();
    await pool.end();
  }
});
