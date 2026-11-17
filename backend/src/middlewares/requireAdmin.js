import pool from "../db/pool.js";

export const requireAdmin = async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT role FROM "user" WHERE id = $1', [req.user.id]);
    if (rows.length === 0 || rows[0].role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
