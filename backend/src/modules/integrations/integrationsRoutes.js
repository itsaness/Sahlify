import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { requireStoreOwner } from "../../middlewares/requireStoreOwner.js";
import { rateLimit } from "../../middlewares/rateLimit.js";
import {
  listStoreIntegrations,
  upsertChargilyIntegration,
  upsertMetaIntegration,
  upsertCarrierIntegration,
  testCarrierIntegration,
  deleteIntegration,
} from "./integrationsController.js";

const router = express.Router({ mergeParams: true });
const testLimiter = rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => req.store?.id });

router.use(authMiddleware, requireStoreOwner);

router.get("/", listStoreIntegrations);
router.put("/chargily", upsertChargilyIntegration);
router.put("/meta", upsertMetaIntegration);
router.put("/carrier/:carrierCode", upsertCarrierIntegration);
router.post("/carrier/:carrierCode/test", testLimiter, testCarrierIntegration);
router.delete("/:integrationId", deleteIntegration);

export default router;
