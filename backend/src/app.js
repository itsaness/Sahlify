import path from "path";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { env } from "./config/env.js";
import { features } from "./config/features.js";
import pool from "./db/pool.js";
import { auth } from "./auth.js";
import { csrfOriginGuard } from "./middlewares/csrfOriginGuard.js";
import { rateLimit } from "./middlewares/rateLimit.js";
import storesRoutes from "./modules/stores/storesRoutes.js";
import catalogRoutes from "./modules/catalog/catalogRoutes.js";
import themesRoutes from "./modules/themes/themesRoutes.js";
import ordersRoutes from "./modules/orders/ordersRoutes.js";
import integrationsRoutes from "./modules/integrations/integrationsRoutes.js";
import shippingRoutes from "./modules/shipping/shippingRoutes.js";
import capiRoutes from "./modules/capi/capiRoutes.js";
import aiRoutes from "./modules/ai/aiRoutes.js";
import storefrontRoutes from "./modules/catalog/storefrontRoutes.js";
import storePaymentWebhookRoute from "./modules/payments/storePaymentWebhookRoute.js";
import { listWilayas, upsertShippingRates } from "./modules/orders/ordersController.js";
import { listCarriers } from "./modules/integrations/integrationsController.js";
import { handleShippingWebhook } from "./modules/shipping/shippingController.js";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import { requireStoreOwner } from "./middlewares/requireStoreOwner.js";
import { registerCapiListeners } from "./modules/capi/capiListener.js";

const [adminMod, billingRoutesMod, billingWebhookMod, billingCtrlMod] = await Promise.all([
  features.platformAdminEnabled ? import("./modules/admin/adminRoutes.js").catch(() => null) : null,
  features.billingEnabled ? import("./modules/billing/billingRoutes.js").catch(() => null) : null,
  features.billingEnabled ? import("./modules/billing/billingWebhookRoute.js").catch(() => null) : null,
  features.billingEnabled ? import("./modules/billing/billingController.js").catch(() => null) : null,
]);

export function createApp() {
  registerCapiListeners();
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.use(
    cors({
      origin: [env.FRONTEND_URL],
      credentials: true,
    })
  );

  // Better Auth handles its own body parsing
  app.all("/api/auth/*splat", toNodeHandler(auth));

  const webhookLimiter = rateLimit({ windowMs: 60_000, max: 120 });
  const domainCheckLimiter = rateLimit({ windowMs: 60_000, max: 120 });
  const checkoutLimiter = rateLimit({
    windowMs: 60_000,
    max: 15,
    keyFn: (req) => req.user?.id || req.ip,
  });

  // Webhooks MUST be mounted before express.json() to preserve raw body for HMAC verification
  app.use("/api/webhooks/chargily", webhookLimiter, storePaymentWebhookRoute);
  if (features.billingEnabled && billingWebhookMod?.default) {
    app.use("/api/webhooks/chargily", webhookLimiter, billingWebhookMod.default);
  }

  // Allow larger payload only on local image upload route
  app.use("/api/stores/:storeId/products/:productId/images", express.json({ limit: "8mb" }));
  app.use(express.json({ limit: "100kb" }));

  if (env.STORAGE_DRIVER === "local") {
    app.use(
      "/uploads",
      (_req, res, next) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"
        );
        next();
      },
      express.static(path.resolve(env.UPLOADS_DIR))
    );
  }

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.status(200).json({ ok: true, mode: env.DEPLOYMENT_MODE });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  // Caddy on_demand_tls ask endpoint: only allow verified custom domains on active stores
  app.get("/internal/domain-check", domainCheckLimiter, async (req, res) => {
    const domain = String(req.query.domain || "").trim().toLowerCase();
    if (!domain) return res.sendStatus(400);
    try {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM stores
         WHERE custom_domain = $1 AND custom_domain_verified_at IS NOT NULL AND status = 'active'
         LIMIT 1`,
        [domain]
      );
      return res.sendStatus(rowCount > 0 ? 200 : 404);
    } catch {
      return res.sendStatus(500);
    }
  });

  // Public reference data & storefront API
  app.get("/api/wilayas", listWilayas);
  app.get("/api/carriers", listCarriers);
  app.post("/api/webhooks/shipping/:carrierCode", webhookLimiter, handleShippingWebhook);
  app.use("/api/storefront", storefrontRoutes);

  // Merchant dashboard routes (CSRF origin-guarded)
  app.use("/api/stores", csrfOriginGuard);
  app.use("/api/stores", storesRoutes);
  app.use("/api/stores/:storeId/products", catalogRoutes);
  app.use("/api/stores/:storeId/themes", themesRoutes);
  app.use("/api/stores/:storeId/orders", ordersRoutes);
  app.use("/api/stores/:storeId/integrations", integrationsRoutes);
  app.use("/api/stores/:storeId/shipments", shippingRoutes);
  app.use("/api/stores/:storeId/capi", capiRoutes);
  app.use("/api/stores/:storeId/ai", aiRoutes);
  app.put("/api/stores/:storeId/shipping-rates", authMiddleware, requireStoreOwner, upsertShippingRates);

  if (features.billingEnabled && billingCtrlMod && billingRoutesMod?.default) {
    app.get("/api/plans", billingCtrlMod.listPlans);
    app.get("/api/billing/me", authMiddleware, billingCtrlMod.getAccountBilling);
    app.post(
      "/api/billing/checkout",
      authMiddleware,
      csrfOriginGuard,
      checkoutLimiter,
      billingCtrlMod.createAccountCheckout
    );
    app.post(
      "/api/billing/dev-activate",
      authMiddleware,
      csrfOriginGuard,
      billingCtrlMod.devActivateAccountSubscription
    );
    app.use("/api/stores/:storeId/billing", billingRoutesMod.default);
  }

  if (features.platformAdminEnabled && adminMod?.default) {
    app.use("/api/admin", csrfOriginGuard, adminMod.default);
  }

  // Global error handler (no stack traces leaked)
  app.use((err, _req, res, _next) => {
    if (err?.type === "entity.too.large" || err?.status === 413) {
      return res.status(413).json({ message: "Payload too large" });
    }
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      return res.status(400).json({ message: "Invalid JSON body" });
    }
    if (err?.code === "22P02") {
      return res.status(400).json({ message: "Invalid identifier format" });
    }
    console.error("Unhandled error:", err);
    return res.status(err?.statusCode || 500).json({ message: "Internal server error" });
  });

  return app;
}
