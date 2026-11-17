import { fileURLToPath } from "url";
import pool from "../pool.js";
import { WILAYAS } from "./wilayas.js";
import { CARRIERS } from "./carriers.js";

export async function runSeeds() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Default cloud plan (price stored in DB so it can be adjusted without redeploy)
    await client.query(
      `INSERT INTO plans (code, name, price_dzd, interval_months, ai_quota)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (code) DO NOTHING`,
      [
        "standard",
        "Standard Store",
        1000,
        1,
        JSON.stringify({ generations: 20, edits: 200 }),
      ]
    );

    // 2. 69 Algerian wilayas
    for (const w of WILAYAS) {
      await client.query(
        `INSERT INTO wilayas (id, code, name_ar, name_fr)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name_ar = EXCLUDED.name_ar, name_fr = EXCLUDED.name_fr`,
        [w.id, w.code, w.name_ar, w.name_fr]
      );
    }

    // 3. Carriers registry
    for (const c of CARRIERS) {
      await client.query(
        `INSERT INTO carriers (code, name, platform, base_url, credential_fields, supports_webhook, supports_stopdesk)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           platform = EXCLUDED.platform,
           base_url = EXCLUDED.base_url,
           credential_fields = EXCLUDED.credential_fields,
           supports_webhook = EXCLUDED.supports_webhook,
           supports_stopdesk = EXCLUDED.supports_stopdesk`,
        [
          c.code,
          c.name,
          c.platform,
          c.base_url,
          JSON.stringify(c.credential_fields),
          c.supports_webhook,
          c.supports_stopdesk,
        ]
      );
    }

    await client.query("COMMIT");
    console.log("Seeds applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeeds()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
