import crypto from "crypto";
import { timingSafeEqualHex } from "../../lib/crypto.js";

/**
 * Verifies Chargily Pay HMAC-SHA256 webhook signature against the raw request body.
 */
export function verifyChargilySignature(rawBody, signature, apiKey) {
  if (!apiKey || !signature || !rawBody) return false;
  try {
    const computed = crypto
      .createHmac("sha256", apiKey)
      .update(rawBody)
      .digest("hex");
    return timingSafeEqualHex(computed, String(signature));
  } catch {
    return false;
  }
}

/**
 * Creates a Chargily Pay v2 checkout session for a store order.
 */
export async function createChargilyCheckout({
  amountDzd,
  metadata,
  successUrl,
  failureUrl,
  webhookEndpoint,
  apiKey,
  apiBase = "https://pay.chargily.net/api/v2",
}) {
  if (!apiKey) {
    throw new Error("Store Chargily API key is not configured");
  }

  const body = {
    amount: amountDzd,
    currency: "dzd",
    success_url: successUrl,
    failure_url: failureUrl,
    metadata,
  };
  if (webhookEndpoint) {
    body.webhook_endpoint = webhookEndpoint;
  }

  const res = await fetch(`${apiBase}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Chargily API error (${res.status})`);
  }
  return data;
}
