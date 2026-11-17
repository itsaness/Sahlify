import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { requireStoreOwner } from "../../middlewares/requireStoreOwner.js";
import { rateLimit } from "../../middlewares/rateLimit.js";
import {
  getAiUsage,
  generateStoreTheme,
  editStoreTheme,
  generateProductCopy,
} from "./aiController.js";

const router = express.Router({ mergeParams: true });
const aiLimiter = rateLimit({ windowMs: 60_000, max: 15, keyFn: (req) => req.store?.id });

router.use(authMiddleware, requireStoreOwner);

router.get("/usage", getAiUsage);
router.post("/generate-theme", aiLimiter, generateStoreTheme);
router.post("/edit-theme", aiLimiter, editStoreTheme);
router.post("/product-copy", aiLimiter, generateProductCopy);

export default router;
