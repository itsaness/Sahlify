import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { requireStoreOwner } from "../../middlewares/requireStoreOwner.js";
import { rateLimit } from "../../middlewares/rateLimit.js";
import {
  listMyStores,
  createStore,
  getStore,
  updateStore,
  verifyCustomDomain,
  deleteStore,
} from "./storesController.js";

const router = express.Router();
const verifyLimiter = rateLimit({ windowMs: 60_000, max: 10, keyFn: (req) => req.store?.id });

router.use(authMiddleware);

router.get("/", listMyStores);
router.post("/", createStore);
router.get("/:storeId", requireStoreOwner, getStore);
router.patch("/:storeId", requireStoreOwner, updateStore);
router.post("/:storeId/verify-domain", requireStoreOwner, verifyLimiter, verifyCustomDomain);
router.delete("/:storeId", requireStoreOwner, deleteStore);

export default router;
