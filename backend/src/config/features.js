import { env } from "./env.js";

/**
 * Feature flags derived from DEPLOYMENT_MODE.
 * Application modules should check these flags rather than env.DEPLOYMENT_MODE directly.
 */
export const features = Object.freeze({
  billingEnabled: env.DEPLOYMENT_MODE === "cloud",
  aiQuotaEnforced: env.DEPLOYMENT_MODE === "cloud",
  platformAdminEnabled: env.DEPLOYMENT_MODE === "cloud",
  aiEnabled: Boolean(env.AI_API_KEY) || env.AI_PROVIDER === "ollama",
});
