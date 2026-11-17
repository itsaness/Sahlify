import crypto from "crypto";
import { env } from "../../config/env.js";
import { timingSafeEqualHex } from "../../lib/crypto.js";

function getPreviewKey() {
  return crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update("sahlify:preview-token:v1")
    .digest();
}

/**
 * Creates a short-lived HMAC-signed preview token for viewing a draft store/theme.
 */
export function signPreviewToken({ storeId, themeId = null, ttlSeconds = 1800 }) {
  const payload = {
    storeId,
    themeId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getPreviewKey())
    .update(encoded)
    .digest("hex");
  return `${encoded}.${sig}`;
}

/**
 * Verifies a preview token and returns its payload or null.
 */
export function verifyPreviewToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;

  const expected = crypto
    .createHmac("sha256", getPreviewKey())
    .update(encoded)
    .digest("hex");

  if (!timingSafeEqualHex(expected, sig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.storeId || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
