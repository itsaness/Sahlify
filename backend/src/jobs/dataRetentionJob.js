import pool from "../db/pool.js";

const RETENTION_LOCK_ID = 98234105;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function runDataRetentionOnce() {
  const client = await pool.connect();
  let acquired = false;
  try {
    const lockRes = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [RETENTION_LOCK_ID]);
    acquired = lockRes.rows[0]?.ok === true;
    if (!acquired) return null;

    const ordersRes = await client.query(
      `UPDATE orders
       SET client_ip = NULL, user_agent = NULL, fbp = NULL, fbc = NULL
       WHERE created_at < NOW() - INTERVAL '30 days'
         AND (client_ip IS NOT NULL OR user_agent IS NOT NULL OR fbp IS NOT NULL OR fbc IS NOT NULL)`
    );

    const webhooksRes = await client.query(
      `DELETE FROM webhook_events
       WHERE processed_at < NOW() - INTERVAL '90 days'`
    );

    const sessionsRes = await client.query(
      `DELETE FROM "session"
       WHERE "expiresAt" < NOW() - INTERVAL '1 day'`
    );

    const verificationsRes = await client.query(
      `DELETE FROM "verification"
       WHERE "expiresAt" < NOW() - INTERVAL '1 day'`
    );

    return {
      scrubbedOrders: ordersRes.rowCount,
      purgedWebhooks: webhooksRes.rowCount,
      purgedSessions: sessionsRes.rowCount,
      purgedVerifications: verificationsRes.rowCount,
    };
  } finally {
    if (acquired) {
      await client.query("SELECT pg_advisory_unlock($1)", [RETENTION_LOCK_ID]).catch(() => {});
    }
    client.release();
  }
}

export function startDataRetentionJob() {
  const timer = setInterval(() => {
    runDataRetentionOnce().catch((err) => console.error("Data retention job error:", err));
  }, INTERVAL_MS);
  timer.unref();
  return timer;
}
