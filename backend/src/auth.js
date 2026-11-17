import { betterAuth } from "better-auth";
import { env } from "./config/env.js";
import pool from "./db/pool.js";

const socialProviders = {};
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: pool,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  rateLimit: {
    enabled: env.NODE_ENV !== "test",
    window: 60,
    max: 30,
  },
  trustedOrigins: [env.FRONTEND_URL, env.BETTER_AUTH_URL],
  socialProviders,
});
