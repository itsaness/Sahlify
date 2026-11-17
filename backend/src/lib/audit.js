import pool from "../db/pool.js";

export async function recordAuditLog({ actorUserId = null, storeId = null, action, metadata = {}, ipAddress = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_user_id, store_id, action, metadata, ip_address)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [actorUserId, storeId, action, JSON.stringify(metadata), ipAddress]
    );
  } catch (err) {
    console.error("recordAuditLog error:", err.message);
  }
}
