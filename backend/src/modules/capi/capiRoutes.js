import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { requireStoreOwner } from "../../middlewares/requireStoreOwner.js";
import { rateLimit } from "../../middlewares/rateLimit.js";
import { listCapiEvents, retryCapiEvent } from "./capiController.js";

const router = express.Router({ mergeParams: true });
const retryLimiter = rateLimit({ windowMs: 60_000, max: 20, keyFn: (req) => req.store?.id });

router.use(authMiddleware, requireStoreOwner);

router.get("/events", listCapiEvents);
router.post("/events/:eventId/retry", retryLimiter, retryCapiEvent);

export default router;
