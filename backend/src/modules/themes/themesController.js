import pool from "../../db/pool.js";
import { STARTER_TEMPLATES, themeSchema } from "./templates.js";
import { isSafeHref, isSafeImageUrl } from "../../../../packages/theme-schema/index.js";
import { signPreviewToken } from "./previewToken.js";

function sanitizeTheme(theme) {
  const parsed = themeSchema.safeParse(theme);
  if (parsed.success) return parsed.data;
  // Fallback sanitization for any legacy stored theme
  const clone = structuredClone(theme || {});
  if (Array.isArray(clone?.pages?.home?.sections)) {
    for (const sec of clone.pages.home.sections) {
      if (sec?.type === "hero" && sec.props) {
        if (!isSafeHref(sec.props.ctaHref)) sec.props.ctaHref = "#products";
        if (!isSafeImageUrl(sec.props.imageUrl)) sec.props.imageUrl = "";
      }
    }
  }
  return clone;
}

export const listThemes = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, version, status, theme, created_by, prompt, created_at
       FROM store_themes
       WHERE store_id = $1
       ORDER BY version DESC`,
      [req.store.id]
    );
    return res.status(200).json({
      themes: rows,
      starterTemplates: Object.entries(STARTER_TEMPLATES).map(([key, tpl]) => ({
        key,
        name: tpl.name,
        theme: tpl.theme,
      })),
    });
  } catch (err) {
    console.error("listThemes error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const saveDraftTheme = async (req, res) => {
  const { templateKey, theme: rawTheme } = req.body ?? {};

  const candidate = templateKey ? STARTER_TEMPLATES[templateKey]?.theme : rawTheme;
  if (!candidate) {
    return res.status(400).json({ message: "Provide a valid theme or templateKey" });
  }

  const parsed = themeSchema.safeParse(candidate);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid theme schema",
      errors: parsed.error.issues,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const verRes = await client.query(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM store_themes WHERE store_id = $1",
      [req.store.id]
    );
    const nextVersion = verRes.rows[0].next_version;

    const { rows } = await client.query(
      `INSERT INTO store_themes (store_id, version, status, theme, created_by)
       VALUES ($1, $2, 'draft', $3::jsonb, 'user')
       RETURNING id, version, status, theme, created_by, created_at`,
      [req.store.id, nextVersion, JSON.stringify(parsed.data)]
    );

    await client.query("COMMIT");
    return res.status(201).json({ theme: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("saveDraftTheme error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const publishTheme = async (req, res) => {
  const { themeId } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const check = await client.query(
      "SELECT id FROM store_themes WHERE id = $1 AND store_id = $2 FOR UPDATE",
      [themeId, req.store.id]
    );
    if (check.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Theme version not found" });
    }

    await client.query(
      "UPDATE store_themes SET status = 'archived' WHERE store_id = $1 AND status = 'published'",
      [req.store.id]
    );

    const { rows } = await client.query(
      `UPDATE store_themes
       SET status = 'published'
       WHERE id = $1 AND store_id = $2
       RETURNING id, version, status, theme, created_by, created_at`,
      [themeId, req.store.id]
    );

    await client.query("COMMIT");
    return res.status(200).json({ theme: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("publishTheme error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const createPreviewToken = async (req, res) => {
  const { themeId } = req.body ?? {};
  const token = signPreviewToken({ storeId: req.store.id, themeId: themeId || null });
  return res.status(200).json({ previewToken: token });
};

export const getStorefrontTheme = async (req, res) => {
  try {
    const preview = req.previewPayload;
    if (preview) {
      res.setHeader("Referrer-Policy", "no-referrer");
    }

    if (preview?.themeId) {
      const { rows } = await pool.query(
        "SELECT id, version, status, theme FROM store_themes WHERE id = $1 AND store_id = $2",
        [preview.themeId, req.store.id]
      );
      if (rows.length > 0) {
        return res.status(200).json({ theme: sanitizeTheme(rows[0].theme), version: rows[0].version, preview: true });
      }
    }

    if (preview) {
      const { rows } = await pool.query(
        `SELECT id, version, status, theme FROM store_themes
         WHERE store_id = $1 AND status IN ('draft', 'published')
         ORDER BY CASE WHEN status = 'draft' THEN 0 ELSE 1 END, version DESC
         LIMIT 1`,
        [req.store.id]
      );
      if (rows.length > 0) {
        return res.status(200).json({ theme: sanitizeTheme(rows[0].theme), version: rows[0].version, preview: true });
      }
    }

    const { rows } = await pool.query(
      `SELECT id, version, theme FROM store_themes
       WHERE store_id = $1 AND status = 'published'
       ORDER BY version DESC
       LIMIT 1`,
      [req.store.id]
    );

    if (rows.length > 0) {
      return res.status(200).json({ theme: sanitizeTheme(rows[0].theme), version: rows[0].version, preview: false });
    }

    // Fallback to starter template matching store language
    const fallbackKey = req.store.language === "fr" ? "minimal_fr" : "modern_ar";
    return res.status(200).json({
      theme: STARTER_TEMPLATES[fallbackKey].theme,
      version: 0,
      preview: Boolean(preview),
    });
  } catch (err) {
    console.error("getStorefrontTheme error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
