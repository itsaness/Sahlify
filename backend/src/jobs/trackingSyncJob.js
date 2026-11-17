import pool from "../db/pool.js";
import { syncShipmentsBatch } from "../modules/shipping/shippingController.js";

const SYNC_LOCK_ID = 98234102;
const INTERVAL_MS = 30 * 60 * 1000;

export async function runTrackingSyncOnce() {
  const client = await pool.connect();
  let acquired = false;
  try {
    const lockRes = await client.query("SELECT pg_try_advisory_lock($1) AS ok", [SYNC_LOCK_ID]);
    acquired = lockRes.rows[0]?.ok === true;
    if (!acquired) return null;

    return await syncShipmentsBatch(null);
  } finally {
    if (acquired) {
      await client.query("SELECT pg_advisory_unlock($1)", [SYNC_LOCK_ID]).catch(() => {});
    }
    client.release();
  }
}

export function startTrackingSyncJob() {
  const timer = setInterval(() => {
    runTrackingSyncOnce().catch((err) => console.error("Tracking sync job error:", err));
  }, INTERVAL_MS);
  timer.unref();
  return timer;
}
