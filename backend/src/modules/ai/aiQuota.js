import pool from "../../db/pool.js";
import { features } from "../../config/features.js";

/**
 * Checks subscription + monthly AI quota for a store (in cloud mode).
 * Throws an error with .statusCode (402 or 429) if blocked.
 */
export async function assertAiAllowed(storeId, kind) {
  if (features.aiQuotaEnforced) {
    const subRes = await pool.query(
      `SELECT ss.status, ss.current_period_end, p.ai_quota
       FROM store_subscriptions ss
       JOIN plans p ON p.id = ss.plan_id
       WHERE ss.store_id = $1`,
      [storeId]
    );

    const sub = subRes.rows[0];
    const isActive =
      sub && sub.status === "active" && sub.current_period_end && new Date(sub.current_period_end) > new Date();

    if (!isActive) {
      const err = new Error("An active store subscription is required to use AI");
      err.statusCode = 402;
      throw err;
    }

    const quota = sub.ai_quota || { generations: 20, edits: 200 };
    const limit = kind === "theme" ? Number(quota.generations ?? 20) : Number(quota.edits ?? 200);

    const usageRes = await pool.query(
      `SELECT COUNT(*)::int AS used
       FROM ai_usage
       WHERE store_id = $1
         AND ($2 = 'theme' AND kind = 'theme' OR $2 <> 'theme' AND kind IN ('edit', 'copy'))
         AND created_at >= date_trunc('month', NOW())`,
      [storeId, kind]
    );

    if (usageRes.rows[0].used >= limit) {
      const err = new Error("Monthly AI quota exceeded for this store");
      err.statusCode = 429;
      throw err;
    }
  }

  if (!features.aiEnabled) {
    const err = new Error("AI is not configured on this server");
    err.statusCode = 503;
    throw err;
  }

  return { ok: true };
}

export async function recordAiUsage({ storeId, kind, model, tokensIn, tokensOut }) {
  await pool.query(
    `INSERT INTO ai_usage (store_id, kind, model, tokens_in, tokens_out)
     VALUES ($1, $2, $3, $4, $5)`,
    [storeId, kind, model, tokensIn || 0, tokensOut || 0]
  );
}
