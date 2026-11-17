import pool from "../db/pool.js";
import { env } from "../config/env.js";
import { verifyPreviewToken } from "../modules/themes/previewToken.js";

const BASE_DOMAINS = env.STORE_BASE_DOMAINS.split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function isLoopbackAddress(addr) {
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function extractSlugFromHost(host) {
  for (const base of BASE_DOMAINS) {
    const suffix = `.${base}`;
    if (host.endsWith(suffix)) {
      const prefix = host.slice(0, -suffix.length);
      if (prefix && !prefix.includes(".")) {
        return prefix;
      }
    }
  }
  return null;
}

/**
 * Resolves the storefront tenant from Host (or X-Store-Host from trusted local proxy).
 * Only returns whitelisted public store fields.
 */
export const resolveStore = async (req, res, next) => {
  const allowStoreHostHeader =
    env.TRUST_STORE_HOST_HEADER || isLoopbackAddress(req.socket?.remoteAddress);

  const rawHeader = allowStoreHostHeader
    ? req.headers["x-store-host"] || req.headers.host
    : req.headers.host;

  const rawHost = String(rawHeader || "")
    .split(":")[0]
    .trim()
    .toLowerCase();

  if (!rawHost) {
    return res.status(400).json({ message: "Missing Host header" });
  }

  try {
    // 1. Verified custom domain match
    let { rows } = await pool.query(
      `SELECT id, slug, name, status, language, cod_enabled, online_payment_enabled
       FROM stores
       WHERE custom_domain = $1 AND custom_domain_verified_at IS NOT NULL
       LIMIT 1`,
      [rawHost]
    );

    // 2. Subdomain match against configured STORE_BASE_DOMAINS
    if (rows.length === 0) {
      const candidateSlug = extractSlugFromHost(rawHost);
      if (candidateSlug) {
        const resBySlug = await pool.query(
          `SELECT id, slug, name, status, language, cod_enabled, online_payment_enabled
           FROM stores
           WHERE slug = $1
           LIMIT 1`,
          [candidateSlug]
        );
        rows = resBySlug.rows;
      }
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: "Store not found" });
    }

    const store = rows[0];
    const rawPreview = req.query.preview ? String(req.query.preview) : null;
    const previewPayload = rawPreview ? verifyPreviewToken(rawPreview) : null;
    const isValidPreview = previewPayload && previewPayload.storeId === store.id;

    if (store.status !== "active" && !isValidPreview) {
      return res.status(403).json({
        message: store.status === "suspended" ? "Store temporarily unavailable" : "Store is not published",
        status: store.status,
      });
    }

    if (isValidPreview) {
      res.setHeader("Referrer-Policy", "no-referrer");
    }

    req.store = store;
    req.previewPayload = isValidPreview ? previewPayload : null;
    next();
  } catch (err) {
    console.error("resolveStore error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
