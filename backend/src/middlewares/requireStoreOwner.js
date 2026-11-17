import pool from "../db/pool.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const requireStoreOwner = async (req, res, next) => {
  const { storeId } = req.params;
  if (!storeId || !UUID_RE.test(storeId)) {
    return res.status(400).json({ message: "Invalid storeId" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT id, owner_id, slug, custom_domain, name, status, language FROM stores WHERE id = $1",
      [storeId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Store not found" });
    }
    if (rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.store = rows[0];
    next();
  } catch (err) {
    console.error("requireStoreOwner error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
