import express from "express";
import { handleStoreChargilyWebhook } from "./storePaymentsController.js";

const router = express.Router();

router.post("/stores/:storeId", express.raw({ type: "application/json" }), handleStoreChargilyWebhook);

export default router;
