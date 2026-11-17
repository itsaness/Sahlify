import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { requireStoreOwner } from "../../middlewares/requireStoreOwner.js";
import {
  listThemes,
  saveDraftTheme,
  publishTheme,
  createPreviewToken,
} from "./themesController.js";

const router = express.Router({ mergeParams: true });

router.use(authMiddleware, requireStoreOwner);

router.get("/", listThemes);
router.post("/draft", saveDraftTheme);
router.post("/:themeId/publish", publishTheme);
router.post("/preview-token", createPreviewToken);

export default router;
