import express from "express";
import { resolveStore } from "../../middlewares/resolveStore.js";
import { rateLimit } from "../../middlewares/rateLimit.js";
import { normalizeDzPhone } from "../../lib/phone.js";
import { getStorefrontTheme } from "../themes/themesController.js";
import {
  listStorefrontProducts,
  getStorefrontProduct,
} from "./catalogController.js";
import {
  createStorefrontOrder,
  getStorefrontShippingRates,
} from "../orders/ordersController.js";

const router = express.Router();

const orderIpLimiter = rateLimit({ windowMs: 60_000, max: 15 });
const orderPhoneLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 5,
  keyFn: (req) => {
    const p = normalizeDzPhone(req.body?.phone);
    return p ? `${req.store?.id}:${p}` : null;
  },
});

router.use(resolveStore);

router.get("/store", (req, res) => {
  res.status(200).json({ store: req.store, preview: Boolean(req.previewPayload) });
});

router.get("/theme", getStorefrontTheme);
router.get("/products", listStorefrontProducts);
router.get("/products/:slug", getStorefrontProduct);
router.get("/shipping-rates", getStorefrontShippingRates);
router.post("/orders", orderIpLimiter, orderPhoneLimiter, createStorefrontOrder);

export default router;
