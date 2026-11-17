import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DEPLOYMENT_MODE: z.enum(["cloud", "self_hosted"]).default("cloud"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DB_USER: z.string().min(1),
  DB_HOST: z.string().min(1).default("localhost"),
  DB_NAME: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
  DB_SSL: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  BETTER_AUTH_SECRET: z.string().optional().default(""),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  CHARGILY_API_KEY: z.string().optional().default(""),
  CHARGILY_API_BASE: z
    .string()
    .url()
    .default("https://pay.chargily.net/test/api/v2"),

  ENCRYPTION_KEY: z.string().optional().default(""),
  META_GRAPH_VERSION: z.string().default("v21.0"),

  AI_PROVIDER: z
    .enum(["openrouter", "anthropic", "openai", "gemini", "ollama"])
    .default("openrouter"),
  AI_API_KEY: z.string().optional().default(""),
  AI_MODEL_LARGE: z.string().optional().default(""),
  AI_MODEL_SMALL: z.string().optional().default(""),
  AI_ZDR: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOADS_DIR: z.string().default("uploads"),

  TRUST_PROXY: z.string().default("loopback"),
  STORE_BASE_DOMAINS: z.string().default("localhost,sahlify.dz"),
  TRUST_STORE_HOST_HEADER: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

if (env.NODE_ENV === "test") {
  if (!env.BETTER_AUTH_SECRET) {
    env.BETTER_AUTH_SECRET = "test-only-better-auth-secret-32chars";
  }
  if (!env.ENCRYPTION_KEY) {
    env.ENCRYPTION_KEY = "test-only-encryption-key-32chars";
  }
} else {
  const WEAK_PLACEHOLDERS = new Set([
    "change-me-to-a-long-random-string",
    "0000000000000000000000000000000000000000000000000000000000000000",
  ]);
  if (env.BETTER_AUTH_SECRET.length < 16) {
    console.error("BETTER_AUTH_SECRET must be set (>= 16 chars). Generate with: openssl rand -hex 32");
    process.exit(1);
  }
  if (env.ENCRYPTION_KEY.length < 16) {
    console.error("ENCRYPTION_KEY must be set (>= 16 chars). Generate with: openssl rand -hex 32");
    process.exit(1);
  }
  if (
    env.NODE_ENV === "production" &&
    (WEAK_PLACEHOLDERS.has(env.BETTER_AUTH_SECRET) || WEAK_PLACEHOLDERS.has(env.ENCRYPTION_KEY))
  ) {
    console.error("Placeholder secrets are not allowed in production. Generate strong random values.");
    process.exit(1);
  }
}
