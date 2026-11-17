import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { requireStoreOwner } from "../../middlewares/requireStoreOwner.js";
import { rateLimit } from "../../middlewares/rateLimit.js";
import {
  listShipments,
  updateShipmentStatus,
  syncStoreShipments,
  cancelShipment,
  listCarrierStopDesks,
} from "./shippingController.js";

const router = express.Router({ mergeParams: true });
const syncLimiter = rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => req.store?.id });

router.use(authMiddleware, requireStoreOwner);

router.get("/", listShipments);
router.post("/sync", syncLimiter, syncStoreShipments);
router.patch("/:shipmentId/status", updateShipmentStatus);
router.post("/:shipmentId/cancel", cancelShipment);
router.get("/carriers/:carrierCode/stopdesks", listCarrierStopDesks);

export default router;
