import { z } from "zod";
import pool from "../../db/pool.js";
import { features } from "../../config/features.js";
import { ALLOWED_FONTS, themeSchema, STARTER_TEMPLATES } from "../themes/templates.js";
import { callLlm } from "./aiProvider.js";
import { assertAiAllowed, recordAiUsage } from "./aiQuota.js";

const THEME_SYSTEM_PROMPT = `You are a storefront theme designer for Algerian e-commerce stores.
Return ONLY valid JSON (no markdown fences, no commentary) matching this exact structure:
{
  "tokens": {
    "colors": {
      "primary": "#RRGGBB",
      "background": "#RRGGBB",
      "surface": "#RRGGBB",
      "text": "#RRGGBB",
      "muted": "#RRGGBB"
    },
    "font": one of ${JSON.stringify(ALLOWED_FONTS)},
    "radius": "none" | "sm" | "md" | "lg" | "full",
    "direction": "rtl" | "ltr",
    "headerStyle": "minimal" | "centered" | "glass",
    "cardStyle": "elevated" | "bordered" | "minimal"
  },
  "pages": {
    "home": {
      "sections": [
        // 1 to 12 items from these exact types:
        // { "type": "banner", "props": { "text": "...", "badge": "...", "variant": "solid"|"gradient"|"marquee" } }
        // { "type": "hero", "props": { "badge": "...", "title": "...", "subtitle": "...", "ctaText": "...", "ctaHref": "#products", "imageUrl": "", "variant": "centered"|"split"|"immersive" } }
        // { "type": "trust_badges", "props": { "items": [{ "icon": "cod"|"fast_delivery"|"58_wilayas"|"quality"|"support"|"secure_payment"|"exchange", "label": "..." }] } }
        // { "type": "product_grid", "props": { "title": "...", "subtitle": "...", "columns": 2|3|4, "limit": 1..24, "showSearch": true|false } }
        // { "type": "promo_split", "props": { "badge": "...", "title": "...", "description": "...", "bullets": ["..."], "ctaText": "...", "ctaHref": "#products", "imageUrl": "", "imagePosition": "left"|"right" } }
        // { "type": "countdown", "props": { "badge": "...", "title": "...", "subtitle": "...", "hours": 24, "ctaText": "...", "ctaHref": "#products" } }
        // { "type": "faq", "props": { "title": "...", "items": [{ "q": "...", "a": "..." }] } }
        // { "type": "reviews", "props": { "title": "...", "items": [{ "author": "...", "city": "...", "rating": 1..5, "comment": "..." }] } }
      ]
    },
    "product": {
      "layout": "landing_page" | "standard",
      "showRelated": true | false
    }
  }
}
Color rules (CRITICAL — follow strictly):
- "primary": Must be the single most prominent brand/accent color requested (e.g. if the prompt mentions pink, rose, dusty rose, blush, or peony, "primary" MUST be a true pink/rose hex such as "#D4748B" or "#C97B84" — NEVER brown, tan, rust, or terracotta). Ignore secondary decor/material words like "wood", "wooden", "terracotta tiles", or "corduroy" when choosing "primary".
- "background": Clean, very light tint (e.g. "#FFF9FA" or "#FDF8F5" or "#FAFAFA") unless a dark theme is explicitly requested.
- "surface": Crisp white ("#FFFFFF") or a very subtle light card tint distinct from "background".
- "text": High-contrast dark charcoal ("#1F2937" or "#111827") on light backgrounds, or crisp white ("#F9FAFB") on dark backgrounds.
- "muted": Readable secondary gray or soft accent (e.g. "#6B7280" or "#6B8E78") with good contrast.
Never include HTML tags or scripts in any string.`;

function extractJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

async function generateValidatedTheme({ storeId, kind, tier, messages }) {
  let totalIn = 0;
  let totalOut = 0;
  let lastModel = "";
  const conversation = [...messages];

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await callLlm({
      systemPrompt: THEME_SYSTEM_PROMPT,
      messages: conversation,
      tier,
    });
    totalIn += res.tokensIn;
    totalOut += res.tokensOut;
    lastModel = res.model;

    try {
      const json = extractJson(res.text);
      const parsed = themeSchema.safeParse(json);
      if (parsed.success) {
        await recordAiUsage({
          storeId,
          kind,
          model: lastModel,
          tokensIn: totalIn,
          tokensOut: totalOut,
        });
        return parsed.data;
      }
      conversation.push(
        { role: "assistant", content: res.text },
        {
          role: "user",
          content: `Your JSON failed schema validation. Fix these errors and return ONLY valid JSON:\n${JSON.stringify(parsed.error.issues)}`,
        }
      );
    } catch (err) {
      conversation.push(
        { role: "assistant", content: res.text },
        {
          role: "user",
          content: `Invalid JSON (${err.message}). Return ONLY raw valid JSON with no markdown.`,
        }
      );
    }
  }

  await recordAiUsage({
    storeId,
    kind,
    model: lastModel,
    tokensIn: totalIn,
    tokensOut: totalOut,
  });
  throw new Error("AI failed to produce a valid theme after 3 attempts");
}

export const getAiUsage = async (req, res) => {
  try {
    const [usageRes, subRes] = await Promise.all([
      pool.query(
        `SELECT kind, COUNT(*)::int AS calls,
                COALESCE(SUM(tokens_in), 0)::int AS tokens_in,
                COALESCE(SUM(tokens_out), 0)::int AS tokens_out
         FROM ai_usage
         WHERE store_id = $1 AND created_at >= date_trunc('month', NOW())
         GROUP BY kind`,
        [req.store.id]
      ),
      features.billingEnabled
        ? pool.query(
            `SELECT p.ai_quota
             FROM store_subscriptions ss
             JOIN plans p ON p.id = ss.plan_id
             WHERE ss.store_id = $1 AND ss.status = 'active' AND ss.current_period_end > NOW()`,
            [req.store.id]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    return res.status(200).json({
      aiEnabled: features.aiEnabled,
      quotaEnforced: features.aiQuotaEnforced,
      quota: subRes.rows[0]?.ai_quota || null,
      usageThisMonth: usageRes.rows,
    });
  } catch (err) {
    console.error("getAiUsage error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const generateStoreTheme = async (req, res) => {
  const schema = z.object({
    prompt: z.string().trim().min(3).max(1000),
    language: z.enum(["ar", "fr", "en"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }

  try {
    await assertAiAllowed(req.store.id, "theme");

    const lang = parsed.data.language || req.store.language || "ar";
    const theme = await generateValidatedTheme({
      storeId: req.store.id,
      kind: "theme",
      tier: "large",
      messages: [
        {
          role: "user",
          content: `Create a complete store theme for "${req.store.name}" in language "${lang}" (direction: ${lang === "ar" ? "rtl" : "ltr"}). Prioritize the main brand color palette (not decor/material words) for tokens.colors.primary. Merchant request: ${parsed.data.prompt}`,
        },
      ],
    });

    const verRes = await pool.query(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM store_themes WHERE store_id = $1",
      [req.store.id]
    );
    const { rows } = await pool.query(
      `INSERT INTO store_themes (store_id, version, status, theme, created_by, prompt)
       VALUES ($1, $2, 'draft', $3::jsonb, 'ai', $4)
       RETURNING id, version, status, theme, created_by, prompt, created_at`,
      [req.store.id, verRes.rows[0].next_version, JSON.stringify(theme), parsed.data.prompt]
    );

    return res.status(201).json({ theme: rows[0] });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    console.error("generateStoreTheme error:", err);
    return res.status(502).json({ message: err.message || "AI generation failed" });
  }
};

export const editStoreTheme = async (req, res) => {
  const schema = z.object({
    prompt: z.string().trim().min(3).max(1000),
    themeId: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }

  try {
    await assertAiAllowed(req.store.id, "edit");

    const baseRes = parsed.data.themeId
      ? await pool.query("SELECT theme FROM store_themes WHERE id = $1 AND store_id = $2", [
          parsed.data.themeId,
          req.store.id,
        ])
      : await pool.query(
          `SELECT theme FROM store_themes
           WHERE store_id = $1 AND status IN ('draft', 'published')
           ORDER BY version DESC LIMIT 1`,
          [req.store.id]
        );

    const baseTheme =
      baseRes.rows[0]?.theme ||
      STARTER_TEMPLATES[req.store.language === "fr" ? "minimal_fr" : "modern_ar"].theme;

    const updatedTheme = await generateValidatedTheme({
      storeId: req.store.id,
      kind: "edit",
      tier: "small",
      messages: [
        {
          role: "user",
          content: `Current theme JSON:\n${JSON.stringify(baseTheme)}\n\nApply this edit and return the complete updated theme JSON:\n${parsed.data.prompt}`,
        },
      ],
    });

    const verRes = await pool.query(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM store_themes WHERE store_id = $1",
      [req.store.id]
    );
    const { rows } = await pool.query(
      `INSERT INTO store_themes (store_id, version, status, theme, created_by, prompt)
       VALUES ($1, $2, 'draft', $3::jsonb, 'ai', $4)
       RETURNING id, version, status, theme, created_by, prompt, created_at`,
      [req.store.id, verRes.rows[0].next_version, JSON.stringify(updatedTheme), parsed.data.prompt]
    );

    return res.status(201).json({ theme: rows[0] });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    console.error("editStoreTheme error:", err);
    return res.status(502).json({ message: err.message || "AI edit failed" });
  }
};

export const generateProductCopy = async (req, res) => {
  const schema = z.object({
    title: z.string().trim().min(2).max(160),
    notes: z.string().trim().max(500).optional().default(""),
    language: z.enum(["ar", "fr", "en"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Validation failed", errors: parsed.error.issues });
  }

  try {
    await assertAiAllowed(req.store.id, "copy");
    const lang = parsed.data.language || req.store.language || "ar";

    const llmRes = await callLlm({
      systemPrompt:
        'You write concise, persuasive Algerian e-commerce product descriptions. Return ONLY JSON: {"title": string, "description": string, "seoTitle": string}.',
      messages: [
        {
          role: "user",
          content: `Language: ${lang}. Product: ${parsed.data.title}. Notes: ${parsed.data.notes}`,
        },
      ],
      tier: "small",
    });

    await recordAiUsage({
      storeId: req.store.id,
      kind: "copy",
      model: llmRes.model,
      tokensIn: llmRes.tokensIn,
      tokensOut: llmRes.tokensOut,
    });

    const copy = extractJson(llmRes.text);
    return res.status(200).json({ copy });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    console.error("generateProductCopy error:", err);
    return res.status(502).json({ message: err.message || "AI copy failed" });
  }
};
