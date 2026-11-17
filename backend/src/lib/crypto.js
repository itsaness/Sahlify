import crypto from "crypto";
import { env } from "../config/env.js";

/**
 * Derive a 32-byte AES-256 key from ENCRYPTION_KEY (supports 64-char hex, base64, or passphrase via SHA-256).
 */
function getKey() {
  const raw = env.ENCRYPTION_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32 && b64.toString("base64") === raw) {
    return b64;
  }
  return crypto.createHash("sha256").update(raw).digest();
}

const KEY = getKey();

/**
 * Encrypts a JSON-serializable object with AES-256-GCM.
 * Returns { ciphertext: Buffer, iv: Buffer } (auth tag appended to ciphertext).
 */
export function encryptJson(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, tag]),
    iv,
  };
}

/**
 * Decrypts { ciphertext: Buffer, iv: Buffer } produced by encryptJson.
 */
export function decryptJson(ciphertext, iv) {
  const tag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

/**
 * Constant-time string comparison for HMAC signatures.
 */
export function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
