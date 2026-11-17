import crypto from "crypto";
import dns from "dns/promises";
import { z } from "zod";
import pool from "../../db/pool.js";
import { features } from "../../config/features.js";
import { recordAuditLog } from "../../lib/audit.js";

const RESERVED_SLUGS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "dashboard",
  "mail",
  "cdn",
  "static",
  "assets",
  "auth",
  "billing",
  "webhooks",
  "sahlify",
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/;
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_RE, "Slug must be 3-50 lowercase letters, numbers, or hyphens")
    .refine((s) => !RESERVED_SLUGS.has(s), "This slug is reserved"),
  language: z.enum(["ar", "fr", "en"]).default("ar"),
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(DOMAIN_RE, "Invalid domain name")
    .optional()
    .nullable(),
});

const updateStoreSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_RE, "Slug must be 3-50 lowercase letters, numbers, or hyphens")
    .refine((s) => !RESERVED_SLUGS.has(s), "This slug is reserved")
    .optional(),
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(DOMAIN_RE, "Invalid domain name")
    .optional()
    .nullable(),
  language: z.enum(["ar", "fr", "en"]).optional(),
  codEnabled: z.boolean().optional(),
  onlinePaymentEnabled: z.boolean().optional(),
  capiEnabled: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "active"]).optional(),
});

export const listMyStores = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.slug, s.custom_domain, s.name, s.status, s.language,
              s.cod_enabled, s.online_payment_enabled, s.capi_enabled,
              s.created_at, s.updated_at,
              ss.status AS subscription_status, ss.current_period_end
       FROM stores s
       LEFT JOIN store_subscriptions ss ON ss.store_id = s.id
       WHERE s.owner_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ stores: rows });
  } catch (err) {
    console.error("listMyStores error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createStore = async (req, res) => {
  const parsed = createStoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.issues,
    });
  }

  const { name, slug, language, customDomain } = parsed.data;
  let initialStatus = features.billingEnabled ? "draft" : "active";
  let activeAccountSub = null;

  if (features.billingEnabled) {
    const accRes = await pool.query(
      `SELECT plan_id, status, current_period_end
       FROM account_subscriptions
       WHERE user_id = $1 AND status = 'active' AND current_period_end > NOW()`,
      [req.user.id]
    );
    if (accRes.rows.length > 0) {
      activeAccountSub = accRes.rows[0];
      initialStatus = "active";
    }
  }
  const domainToken = customDomain
    ? `sahlify-verify=${crypto.randomBytes(16).toString("hex")}`
    : null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO stores (owner_id, slug, custom_domain, custom_domain_token, name, status, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, owner_id, slug, custom_domain, custom_domain_verified_at, custom_domain_token,
                 name, status, language, cod_enabled, online_payment_enabled, capi_enabled,
                 settings, created_at, updated_at`,
      [req.user.id, slug, customDomain || null, domainToken, name, initialStatus, language]
    );
    if (activeAccountSub) {
      await pool.query(
        `INSERT INTO store_subscriptions (store_id, plan_id, status, current_period_end)
         VALUES ($1, $2, 'active', $3)
         ON CONFLICT (store_id) DO NOTHING`,
        [rows[0].id, activeAccountSub.plan_id, activeAccountSub.current_period_end]
      );
    }
    return res.status(201).json({ store: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      const field = err.constraint?.includes("custom_domain") ? "customDomain" : "slug";
      return res.status(409).json({ message: `This ${field} is already taken` });
    }
    console.error("createStore error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getStore = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.owner_id, s.slug, s.custom_domain, s.name, s.status, s.language,
              s.cod_enabled, s.online_payment_enabled, s.capi_enabled, s.settings,
              s.created_at, s.updated_at,
              ss.status AS subscription_status, ss.current_period_end
       FROM stores s
       LEFT JOIN store_subscriptions ss ON ss.store_id = s.id
       WHERE s.id = $1`,
      [req.store.id]
    );
    return res.status(200).json({ store: rows[0] });
  } catch (err) {
    console.error("getStore error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateStore = async (req, res) => {
  const parsed = updateStoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.issues,
    });
  }

  const data = parsed.data;
  if (data.status && features.billingEnabled) {
    // In cloud mode, status transitions between draft/active/suspended are controlled by billing
    const subRes = await pool.query(
      "SELECT status, current_period_end FROM store_subscriptions WHERE store_id = $1",
      [req.store.id]
    );
    const sub = subRes.rows[0];
    const hasActiveSub =
      sub && sub.status === "active" && new Date(sub.current_period_end) > new Date();
    if (data.status === "active" && !hasActiveSub) {
      return res.status(402).json({
        message: "An active subscription is required to publish this store",
      });
    }
  }

  const fields = [];
  const values = [];
  const add = (col, val) => {
    values.push(val);
    fields.push(`${col} = $${values.length}`);
  };

  if (data.name !== undefined) add("name", data.name);
  if (data.slug !== undefined) add("slug", data.slug);
  if (data.customDomain !== undefined) {
    add("custom_domain", data.customDomain);
    add("custom_domain_verified_at", null);
    add(
      "custom_domain_token",
      data.customDomain ? `sahlify-verify=${crypto.randomBytes(16).toString("hex")}` : null
    );
  }
  if (data.language !== undefined) add("language", data.language);
  if (data.codEnabled !== undefined) add("cod_enabled", data.codEnabled);
  if (data.onlinePaymentEnabled !== undefined) add("online_payment_enabled", data.onlinePaymentEnabled);
  if (data.capiEnabled !== undefined) add("capi_enabled", data.capiEnabled);
  if (data.settings !== undefined) add("settings", JSON.stringify(data.settings));
  if (data.status !== undefined) add("status", data.status);

  if (fields.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  values.push(req.store.id);
  try {
    const { rows } = await pool.query(
      `UPDATE stores
       SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, owner_id, slug, custom_domain, name, status, language,
                 cod_enabled, online_payment_enabled, capi_enabled, settings, created_at, updated_at`,
      values
    );
    return res.status(200).json({ store: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      const field = err.constraint?.includes("custom_domain") ? "customDomain" : "slug";
      return res.status(409).json({ message: `This ${field} is already taken` });
    }
    console.error("updateStore error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyCustomDomain = async (req, res) => {
  if (!req.store.custom_domain) {
    return res.status(400).json({ message: "No custom domain configured on this store" });
  }
  try {
    const { rows } = await pool.query(
      "SELECT custom_domain, custom_domain_token FROM stores WHERE id = $1",
      [req.store.id]
    );
    const { custom_domain: domain, custom_domain_token: expectedToken } = rows[0];
    if (!expectedToken) {
      return res.status(400).json({ message: "No verification token generated" });
    }
    const records = await dns.resolveTxt(`_sahlify.${domain}`);
    const flat = records.flat();
    if (!flat.includes(expectedToken)) {
      return res.status(400).json({
        verified: false,
        message: `TXT record _sahlify.${domain} does not contain expected token`,
      });
    }
    await pool.query(
      "UPDATE stores SET custom_domain_verified_at = NOW(), updated_at = NOW() WHERE id = $1",
      [req.store.id]
    );
    return res.status(200).json({ verified: true, domain });
  } catch (err) {
    return res.status(400).json({ verified: false, message: err.message });
  }
};

export const deleteStore = async (req, res) => {
  try {
    await recordAuditLog({
      actorUserId: req.user.id,
      storeId: req.store.id,
      action: "store.delete",
      metadata: { slug: req.store.slug },
      ipAddress: req.ip,
    });
    await pool.query("DELETE FROM stores WHERE id = $1", [req.store.id]);
    return res.status(204).send();
  } catch (err) {
    console.error("deleteStore error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
