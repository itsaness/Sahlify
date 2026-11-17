import pool from "../db/pool.js";
import { retryFailedCapiEvents } from "../modules/capi/capiService.js";

const CAPI_LOCK_ID = 98234103;
const INTERVAL_MS = 5 * 60 * 1000;

export async function runCapiRetryOnce() {
  const client = await pool.connect();
  let acquired = false;
  try {
    const lockRes = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [CAPI_LOCK_ID]);
    acquired = lockRes.rows[0]?.ok === true;
    if (!acquired) return null;

    return await retryFailedCapiEvents();
  } finally {
    if (acquired) {
      await client.query("SELECT pg_advisory_unlock($1)", [CAPI_LOCK_ID]).catch(() => {});
    }
    client.release();
  }
}

export function startCapiRetryJob() {
  const timer = setInterval(() => {
    runCapiRetryOnce().catch((err) => console.error("CAPI retry job error:", err));
  }, INTERVAL_MS);
  timer.unref();
  return timer;
}
