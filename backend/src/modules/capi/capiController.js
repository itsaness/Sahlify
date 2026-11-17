import pool from "../../db/pool.js";
import { retryCapiEventById } from "./capiService.js";

export const listCapiEvents = async (req, res) => {
  try {
    const [eventsRes, statsRes] = await Promise.all([
      pool.query(
        `SELECT ce.id, ce.order_id, o.order_number, ce.event_name, ce.event_id,
                ce.status, ce.attempts, ce.last_error, ce.sent_at, ce.created_at
         FROM capi_events ce
         JOIN orders o ON o.id = ce.order_id
         WHERE ce.store_id = $1
         ORDER BY ce.created_at DESC
         LIMIT 100`,
        [req.store.id]
      ),
      pool.query(
        `SELECT status, COUNT(*)::int AS count
         FROM capi_events
         WHERE store_id = $1
         GROUP BY status`,
        [req.store.id]
      ),
    ]);

    const summary = { sent: 0, failed: 0, pending: 0, expired: 0 };
    for (const r of statsRes.rows) {
      summary[r.status] = r.count;
    }

    return res.status(200).json({ events: eventsRes.rows, summary });
  } catch (err) {
    console.error("listCapiEvents error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const retryCapiEvent = async (req, res) => {
  try {
    const check = await pool.query(
      "SELECT event_id FROM capi_events WHERE id = $1 AND store_id = $2",
      [req.params.eventId, req.store.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "CAPI event not found" });
    }
    const result = await retryCapiEventById(check.rows[0].event_id);
    return res.status(200).json(result);
  } catch (err) {
    console.error("retryCapiEvent error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
