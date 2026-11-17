import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { z } from "zod";
import pool from "../../db/pool.js";
import { env } from "../../config/env.js";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

const createProductSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE).optional(),
  description: z.string().max(5000).optional().default(""),
  priceDzd: z.number().int().min(0),
  compareAtDzd: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0).default(0),
  weightGrams: z.number().int().min(0).optional().nullable(),
  sku: z.string().trim().max(80).optional().nullable(),
  isActive: z.boolean().default(true),
  variants: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(100),
        priceDzd: z.number().int().min(0).optional().nullable(),
        stock: z.number().int().min(0).default(0),
        sku: z.string().trim().max(80).optional().nullable(),
        options: z.record(z.string(), z.string()).default({}),
      })
    )
    .optional()
    .default([]),
});

const updateProductSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE).optional(),
  description: z.string().max(5000).optional(),
  priceDzd: z.number().int().min(0).optional(),
  compareAtDzd: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0).optional(),
  weightGrams: z.number().int().min(0).optional().nullable(),
  sku: z.string().trim().max(80).optional().nullable(),
  isActive: z.boolean().optional(),
});

const variantSchema = z.object({
  title: z.string().trim().min(1).max(100),
  priceDzd: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0).default(0),
  sku: z.string().trim().max(80).optional().nullable(),
  options: z.record(z.string(), z.string()).default({}),
});

function slugify(text) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `product-${crypto.randomBytes(3).toString("hex")}`;
}

export const listProducts = async (req, res) => {
  try {
    const { rows: products } = await pool.query(
      `SELECT p.*,
              COALESCE(
                (SELECT json_agg(pi ORDER BY pi.sort_order, pi.created_at)
                 FROM product_images pi WHERE pi.product_id = p.id), '[]'::json
              ) AS images,
              COALESCE(
                (SELECT json_agg(pv ORDER BY pv.id)
                 FROM product_variants pv WHERE pv.product_id = p.id), '[]'::json
              ) AS variants
       FROM products p
       WHERE p.store_id = $1
       ORDER BY p.created_at DESC`,
      [req.store.id]
    );
    return res.status(200).json({ products });
  } catch (err) {
    console.error("listProducts error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createProduct = async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }
  const d = parsed.data;
  const slug = d.slug || slugify(d.title);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prodRes = await client.query(
      `INSERT INTO products (store_id, title, slug, description, price_dzd, compare_at_dzd, stock, weight_grams, sku, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.store.id,
        d.title,
        slug,
        d.description,
        d.priceDzd,
        d.compareAtDzd ?? null,
        d.stock,
        d.weightGrams ?? null,
        d.sku ?? null,
        d.isActive,
      ]
    );
    const product = prodRes.rows[0];

    const variants = [];
    for (const v of d.variants) {
      const vRes = await client.query(
        `INSERT INTO product_variants (product_id, title, price_dzd, stock, sku, options)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING *`,
        [product.id, v.title, v.priceDzd ?? null, v.stock, v.sku ?? null, JSON.stringify(v.options)]
      );
      variants.push(vRes.rows[0]);
    }

    await client.query("COMMIT");
    return res.status(201).json({ product: { ...product, variants, images: [] } });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") {
      return res.status(409).json({ message: "Product slug already exists in this store" });
    }
    console.error("createProduct error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const getProduct = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
              COALESCE(
                (SELECT json_agg(pi ORDER BY pi.sort_order, pi.created_at)
                 FROM product_images pi WHERE pi.product_id = p.id), '[]'::json
              ) AS images,
              COALESCE(
                (SELECT json_agg(pv ORDER BY pv.id)
                 FROM product_variants pv WHERE pv.product_id = p.id), '[]'::json
              ) AS variants
       FROM products p
       WHERE p.id = $1 AND p.store_id = $2`,
      [req.params.productId, req.store.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json({ product: rows[0] });
  } catch (err) {
    if (err?.code === "22P02") return res.status(400).json({ message: "Invalid identifier format" });
    console.error("getProduct error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProduct = async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }
  const d = parsed.data;
  const fields = [];
  const values = [];
  const add = (col, val) => {
    values.push(val);
    fields.push(`${col} = $${values.length}`);
  };

  if (d.title !== undefined) add("title", d.title);
  if (d.slug !== undefined) add("slug", d.slug);
  if (d.description !== undefined) add("description", d.description);
  if (d.priceDzd !== undefined) add("price_dzd", d.priceDzd);
  if (d.compareAtDzd !== undefined) add("compare_at_dzd", d.compareAtDzd);
  if (d.stock !== undefined) add("stock", d.stock);
  if (d.weightGrams !== undefined) add("weight_grams", d.weightGrams);
  if (d.sku !== undefined) add("sku", d.sku);
  if (d.isActive !== undefined) add("is_active", d.isActive);

  if (fields.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  values.push(req.params.productId, req.store.id);
  try {
    const { rows } = await pool.query(
      `UPDATE products SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND store_id = $${values.length}
       RETURNING *`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json({ product: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Product slug already exists in this store" });
    }
    console.error("updateProduct error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM products WHERE id = $1 AND store_id = $2",
      [req.params.productId, req.store.id]
    );
    if (rowCount === 0) return res.status(404).json({ message: "Product not found" });
    return res.status(204).send();
  } catch (err) {
    if (err?.code === "22P02") return res.status(400).json({ message: "Invalid identifier format" });
    console.error("deleteProduct error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const addVariant = async (req, res) => {
  const parsed = variantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }
  const d = parsed.data;
  try {
    const prod = await pool.query("SELECT id FROM products WHERE id = $1 AND store_id = $2", [
      req.params.productId,
      req.store.id,
    ]);
    if (prod.rows.length === 0) return res.status(404).json({ message: "Product not found" });

    const { rows } = await pool.query(
      `INSERT INTO product_variants (product_id, title, price_dzd, stock, sku, options)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *`,
      [req.params.productId, d.title, d.priceDzd ?? null, d.stock, d.sku ?? null, JSON.stringify(d.options)]
    );
    return res.status(201).json({ variant: rows[0] });
  } catch (err) {
    console.error("addVariant error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteVariant = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM product_variants pv
       USING products p
       WHERE pv.id = $1 AND pv.product_id = p.id AND p.id = $2 AND p.store_id = $3`,
      [req.params.variantId, req.params.productId, req.store.id]
    );
    if (rowCount === 0) return res.status(404).json({ message: "Variant not found" });
    return res.status(204).send();
  } catch (err) {
    console.error("deleteVariant error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function matchesImageMagicBytes(buf, mime) {
  if (buf.length < 12) return false;
  if (mime === "image/png") {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (mime === "image/jpeg") {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mime === "image/webp") {
    return buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

export const addProductImage = async (req, res) => {
  const { url, dataUrl, sortOrder = 0 } = req.body ?? {};
  try {
    const prod = await pool.query("SELECT id FROM products WHERE id = $1 AND store_id = $2", [
      req.params.productId,
      req.store.id,
    ]);
    if (prod.rows.length === 0) return res.status(404).json({ message: "Product not found" });

    let finalUrl = url;
    if (finalUrl !== undefined) {
      if (
        typeof finalUrl !== "string" ||
        (!finalUrl.startsWith("https://") && !finalUrl.startsWith("/uploads/")) ||
        finalUrl.includes("..") ||
        finalUrl.includes("\\")
      ) {
        return res.status(400).json({ message: "Image url must start with https:// or /uploads/" });
      }
    }
    if (!finalUrl && dataUrl) {
      if (env.STORAGE_DRIVER !== "local") {
        return res.status(501).json({ message: "Direct S3 presigned upload not configured yet" });
      }
      const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
      if (!match) {
        return res.status(400).json({ message: "Invalid image dataUrl (jpeg/png/webp base64 only)" });
      }
      const mime = match[1];
      const ext = MIME_TO_EXT[mime];
      const buf = Buffer.from(match[2], "base64");
      if (buf.length > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Image exceeds 5MB limit" });
      }
      if (!matchesImageMagicBytes(buf, mime)) {
        return res.status(400).json({ message: "Image content does not match declared MIME type" });
      }
      const dir = path.resolve(env.UPLOADS_DIR, req.store.id);
      await fs.mkdir(dir, { recursive: true });
      const filename = `${crypto.randomUUID()}.${ext}`;
      await fs.writeFile(path.join(dir, filename), buf);
      finalUrl = `/uploads/${req.store.id}/${filename}`;
    }

    if (!finalUrl || typeof finalUrl !== "string") {
      return res.status(400).json({ message: "Provide url or dataUrl" });
    }

    const { rows } = await pool.query(
      `INSERT INTO product_images (store_id, product_id, url, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.store.id, req.params.productId, finalUrl, Number(sortOrder) || 0]
    );
    return res.status(201).json({ image: rows[0] });
  } catch (err) {
    console.error("addProductImage error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteProductImage = async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM product_images WHERE id = $1 AND product_id = $2 AND store_id = $3",
      [req.params.imageId, req.params.productId, req.store.id]
    );
    if (rowCount === 0) return res.status(404).json({ message: "Image not found" });
    return res.status(204).send();
  } catch (err) {
    console.error("deleteProductImage error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Public storefront endpoints
export const listStorefrontProducts = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);
  try {
    const { rows: products } = await pool.query(
      `SELECT p.id, p.title, p.slug, p.description, p.price_dzd, p.compare_at_dzd, p.stock,
              COALESCE(
                (SELECT json_agg(pi ORDER BY pi.sort_order, pi.created_at)
                 FROM product_images pi WHERE pi.product_id = p.id), '[]'::json
              ) AS images,
              COALESCE(
                (SELECT json_agg(pv ORDER BY pv.id)
                 FROM product_variants pv WHERE pv.product_id = p.id), '[]'::json
              ) AS variants
       FROM products p
       WHERE p.store_id = $1 AND p.is_active = TRUE
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [req.store.id, limit]
    );
    return res.status(200).json({ products });
  } catch (err) {
    console.error("listStorefrontProducts error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getStorefrontProduct = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.slug, p.description, p.price_dzd, p.compare_at_dzd, p.stock,
              COALESCE(
                (SELECT json_agg(pi ORDER BY pi.sort_order, pi.created_at)
                 FROM product_images pi WHERE pi.product_id = p.id), '[]'::json
              ) AS images,
              COALESCE(
                (SELECT json_agg(pv ORDER BY pv.id)
                 FROM product_variants pv WHERE pv.product_id = p.id), '[]'::json
              ) AS variants
       FROM products p
       WHERE p.store_id = $1 AND p.slug = $2 AND p.is_active = TRUE`,
      [req.store.id, req.params.slug]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.status(200).json({ product: rows[0] });
  } catch (err) {
    console.error("getStorefrontProduct error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
