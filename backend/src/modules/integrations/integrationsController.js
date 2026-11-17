import { z } from "zod";
import pool from "../../db/pool.js";
import { encryptJson, decryptJson } from "../../lib/crypto.js";
import { recordAuditLog } from "../../lib/audit.js";
import { getCarrierAdapter } from "../shipping/adapters/index.js";

function maskSecret(val) {
  if (!val || typeof val !== "string") return "••••";
  if (val.length <= 6) return "••••";
  return `••••${val.slice(-4)}`;
}

export const listCarriers = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, code, name, platform, credential_fields, supports_webhook, supports_stopdesk, logo_url
       FROM carriers
       WHERE is_active = TRUE
       ORDER BY id ASC`
    );
    return res.status(200).json({ carriers: rows });
  } catch (err) {
    console.error("listCarriers error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const listStoreIntegrations = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT si.id, si.provider, si.carrier_id, c.code AS carrier_code, c.name AS carrier_name,
              si.credentials_enc, si.iv, si.config, si.is_active, si.is_default, si.updated_at
       FROM store_integrations si
       LEFT JOIN carriers c ON c.id = si.carrier_id
       WHERE si.store_id = $1
       ORDER BY si.provider, si.created_at`,
      [req.store.id]
    );

    const integrations = rows.map((r) => {
      let masked = {};
      try {
        const creds = decryptJson(r.credentials_enc, r.iv);
        for (const [k, v] of Object.entries(creds)) {
          masked[k] = typeof v === "string" ? maskSecret(v) : "••••";
        }
      } catch {
        masked = { error: "unable_to_decrypt" };
      }
      return {
        id: r.id,
        provider: r.provider,
        carrier_id: r.carrier_id,
        carrier_code: r.carrier_code,
        carrier_name: r.carrier_name,
        credentials_masked: masked,
        config: r.config,
        is_active: r.is_active,
        is_default: r.is_default,
        updated_at: r.updated_at,
      };
    });

    return res.status(200).json({ integrations });
  } catch (err) {
    console.error("listStoreIntegrations error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const upsertChargilyIntegration = async (req, res) => {
  const schema = z.object({
    apiKey: z.string().trim().min(6),
    mode: z.enum(["test", "live"]).default("live"),
    isActive: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }

  const { ciphertext, iv } = encryptJson({ apiKey: parsed.data.apiKey });
  try {
    const { rows } = await pool.query(
      `INSERT INTO store_integrations (store_id, provider, credentials_enc, iv, config, is_active)
       VALUES ($1, 'chargily', $2, $3, $4::jsonb, $5)
       ON CONFLICT (store_id, provider) WHERE provider <> 'carrier'
       DO UPDATE SET credentials_enc = EXCLUDED.credentials_enc,
                     iv = EXCLUDED.iv,
                     config = EXCLUDED.config,
                     is_active = EXCLUDED.is_active,
                     updated_at = NOW()
       RETURNING id, provider, config, is_active, updated_at`,
      [req.store.id, ciphertext, iv, JSON.stringify({ mode: parsed.data.mode }), parsed.data.isActive]
    );
    await recordAuditLog({
      actorUserId: req.user.id,
      storeId: req.store.id,
      action: "integration.upsert",
      metadata: { provider: "chargily" },
      ipAddress: req.ip,
    });
    return res.status(200).json({ integration: rows[0] });
  } catch (err) {
    console.error("upsertChargilyIntegration error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const upsertMetaIntegration = async (req, res) => {
  const schema = z.object({
    pixelId: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_-]{4,64}$/, "Invalid Meta Pixel ID"),
    accessToken: z.string().trim().min(10),
    testEventCode: z.string().trim().optional().default(""),
    isActive: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }

  const { ciphertext, iv } = encryptJson({
    pixelId: parsed.data.pixelId,
    accessToken: parsed.data.accessToken,
    testEventCode: parsed.data.testEventCode,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO store_integrations (store_id, provider, credentials_enc, iv, config, is_active)
       VALUES ($1, 'meta', $2, $3, $4::jsonb, $5)
       ON CONFLICT (store_id, provider) WHERE provider <> 'carrier'
       DO UPDATE SET credentials_enc = EXCLUDED.credentials_enc,
                     iv = EXCLUDED.iv,
                     config = EXCLUDED.config,
                     is_active = EXCLUDED.is_active,
                     updated_at = NOW()
       RETURNING id, provider, config, is_active, updated_at`,
      [
        req.store.id,
        ciphertext,
        iv,
        JSON.stringify({
          pixelId: parsed.data.pixelId,
          hasTestCode: Boolean(parsed.data.testEventCode),
        }),
        parsed.data.isActive,
      ]
    );

    await client.query("UPDATE stores SET capi_enabled = $1, updated_at = NOW() WHERE id = $2", [
      parsed.data.isActive,
      req.store.id,
    ]);
    await client.query("COMMIT");
    await recordAuditLog({
      actorUserId: req.user.id,
      storeId: req.store.id,
      action: "integration.upsert",
      metadata: { provider: "meta" },
      ipAddress: req.ip,
    });
    return res.status(200).json({ integration: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("upsertMetaIntegration error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const upsertCarrierIntegration = async (req, res) => {
  const { carrierCode } = req.params;
  const schema = z.object({
    credentials: z.record(z.string(), z.string()).default({}),
    config: z.record(z.string(), z.unknown()).default({}),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }

  const client = await pool.connect();
  try {
    const carrierRes = await client.query(
      "SELECT id, code, name, platform, credential_fields FROM carriers WHERE code = $1 AND is_active = TRUE",
      [carrierCode]
    );
    if (carrierRes.rows.length === 0) {
      return res.status(404).json({ message: "Carrier not found" });
    }
    const carrier = carrierRes.rows[0];
    const requiredFields = Array.isArray(carrier.credential_fields) ? carrier.credential_fields : [];
    for (const f of requiredFields) {
      if (!parsed.data.credentials[f]) {
        return res.status(400).json({ message: `Missing required credential field: ${f}` });
      }
    }

    const { ciphertext, iv } = encryptJson(parsed.data.credentials);

    await client.query("BEGIN");
    if (parsed.data.isDefault) {
      await client.query(
        "UPDATE store_integrations SET is_default = FALSE WHERE store_id = $1 AND provider = 'carrier'",
        [req.store.id]
      );
    }

    const { rows } = await client.query(
      `INSERT INTO store_integrations (store_id, provider, carrier_id, credentials_enc, iv, config, is_active, is_default)
       VALUES ($1, 'carrier', $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (store_id, carrier_id) WHERE provider = 'carrier'
       DO UPDATE SET credentials_enc = EXCLUDED.credentials_enc,
                     iv = EXCLUDED.iv,
                     config = EXCLUDED.config,
                     is_active = EXCLUDED.is_active,
                     is_default = EXCLUDED.is_default,
                     updated_at = NOW()
       RETURNING id, provider, carrier_id, config, is_active, is_default, updated_at`,
      [
        req.store.id,
        carrier.id,
        ciphertext,
        iv,
        JSON.stringify(parsed.data.config),
        parsed.data.isActive,
        parsed.data.isDefault,
      ]
    );
    await client.query("COMMIT");
    await recordAuditLog({
      actorUserId: req.user.id,
      storeId: req.store.id,
      action: "integration.upsert",
      metadata: { provider: "carrier", carrierCode: carrier.code },
      ipAddress: req.ip,
    });
    return res.status(200).json({ integration: { ...rows[0], carrier_code: carrier.code } });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("upsertCarrierIntegration error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const testCarrierIntegration = async (req, res) => {
  const { carrierCode } = req.params;
  try {
    const carrierRes = await pool.query(
      `SELECT c.id, c.code, c.name, c.platform, c.base_url, si.credentials_enc, si.iv
       FROM carriers c
       JOIN store_integrations si ON si.carrier_id = c.id AND si.provider = 'carrier' AND si.store_id = $1
       WHERE c.code = $2`,
      [req.store.id, carrierCode]
    );
    if (carrierRes.rows.length === 0) {
      return res.status(404).json({ message: "Carrier integration not configured" });
    }
    const row = carrierRes.rows[0];
    const creds = decryptJson(row.credentials_enc, row.iv);
    const adapter = getCarrierAdapter(row.platform);
    const result = await adapter.validateCredentials(creds, row);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
};

export const deleteIntegration = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM store_integrations WHERE id = $1 AND store_id = $2",
      [req.params.integrationId, req.store.id]
    );
    if (rowCount === 0) return res.status(404).json({ message: "Integration not found" });
    await recordAuditLog({
      actorUserId: req.user.id,
      storeId: req.store.id,
      action: "integration.delete",
      metadata: { integrationId: req.params.integrationId },
      ipAddress: req.ip,
    });
    return res.status(204).send();
  } catch (err) {
    console.error("deleteIntegration error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
