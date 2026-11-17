import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { requireStoreOwner } from "../../middlewares/requireStoreOwner.js";
import {
  listOrders,
  getOrder,
  confirmOrder,
  cancelOrder,
  listBlacklist,
  addBlacklist,
  removeBlacklist,
} from "./ordersController.js";
import { shipOrder } from "../shipping/shippingController.js";

const router = express.Router({ mergeParams: true });

router.use(authMiddleware, requireStoreOwner);

router.get("/blacklist", listBlacklist);
router.post("/blacklist", addBlacklist);
router.delete("/blacklist/:phone", removeBlacklist);

router.get("/", listOrders);
router.get("/:orderId", getOrder);
router.post("/:orderId/confirm", confirmOrder);
router.post("/:orderId/cancel", cancelOrder);
router.post("/:orderId/ship", shipOrder);

export default router;
