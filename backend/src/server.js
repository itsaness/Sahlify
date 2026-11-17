import { env } from "./config/env.js";
import { features } from "./config/features.js";
import pool from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { runSeeds } from "./db/seeds/seed.js";
import { createApp } from "./app.js";
import { startTrackingSyncJob } from "./jobs/trackingSyncJob.js";
import { startCapiRetryJob } from "./jobs/capiRetryJob.js";
import { startDataRetentionJob } from "./jobs/dataRetentionJob.js";

async function start() {
  await runMigrations();
  await runSeeds();

  let billingTimer = null;
  if (features.billingEnabled) {
    const billingJobMod = await import("./jobs/billingLifecycleJob.js").catch(() => null);
    billingTimer = billingJobMod?.startBillingLifecycleJob?.() || null;
  }

  const timers = [
    startTrackingSyncJob(),
    startCapiRetryJob(),
    billingTimer,
    startDataRetentionJob(),
  ].filter(Boolean);

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`Sahlify backend listening on port ${env.PORT} (${env.DEPLOYMENT_MODE} mode)`);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down gracefully...`);

    for (const t of timers) {
      clearInterval(t);
    }

    const forceTimer = setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
    forceTimer.unref();

    server.close(async () => {
      try {
        await pool.end();
        console.log("Database pool closed.");
      } catch (err) {
        console.error("Error closing database pool:", err.message);
      } finally {
        clearTimeout(forceTimer);
        process.exit(0);
      }
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
