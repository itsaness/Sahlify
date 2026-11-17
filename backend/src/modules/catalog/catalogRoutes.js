import express from "express";
import { authMiddleware } from "../../middlewares/authMiddleware.js";
import { requireStoreOwner } from "../../middlewares/requireStoreOwner.js";
import {
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  addVariant,
  deleteVariant,
  addProductImage,
  deleteProductImage,
} from "./catalogController.js";

const router = express.Router({ mergeParams: true });

router.use(authMiddleware, requireStoreOwner);

router.get("/", listProducts);
router.post("/", createProduct);
router.get("/:productId", getProduct);
router.patch("/:productId", updateProduct);
router.delete("/:productId", deleteProduct);

router.post("/:productId/variants", addVariant);
router.delete("/:productId/variants/:variantId", deleteVariant);

router.post("/:productId/images", addProductImage);
router.delete("/:productId/images/:imageId", deleteProductImage);

export default router;
