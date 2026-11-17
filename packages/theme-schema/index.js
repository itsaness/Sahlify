const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isSafeHref(val) {
  if (typeof val !== "string") return false;
  const s = val.trim();
  if (!s) return false;
  return s.startsWith("#") || (s.startsWith("/") && !s.startsWith("//")) || s.startsWith("https://");
}

export function isSafeOptionalHref(val) {
  if (typeof val !== "string") return false;
  const s = val.trim();
  if (s === "") return true;
  return isSafeHref(s);
}

export function isSafeImageUrl(val) {
  if (typeof val !== "string") return false;
  const s = val.trim();
  if (s === "") return true;
  return (
    (s.startsWith("/uploads/") && !s.includes("..") && !s.includes("\\")) ||
    s.startsWith("https://")
  );
}

export function isSafeHttpsUrl(val) {
  if (typeof val !== "string") return false;
  const s = val.trim();
  if (s === "") return true;
  return s.startsWith("https://");
}

export const ALLOWED_FONTS = [
  "Cairo",
  "Tajawal",
  "Almarai",
  "Readex Pro",
  "Changa",
  "Inter",
  "Plus Jakarta Sans",
  "Outfit",
  "DM Sans",
  "Playfair Display",
];

export function createThemeSchema(z) {
  const hexColor = z.string().regex(HEX_COLOR_RE, "Color must be a 6-digit hex code (#RRGGBB)");
  const safeHref = z
    .string()
    .trim()
    .max(200)
    .refine(isSafeHref, "Link must start with #, /, or https://");
  const safeOptionalHref = z
    .string()
    .trim()
    .max(200)
    .refine(isSafeOptionalHref, "Link must be empty or start with #, /, or https://");
  const safeImageUrl = z
    .string()
    .trim()
    .max(500)
    .refine(isSafeImageUrl, "Image URL must be empty, /uploads/..., or https://...");
  const safeSocialUrl = z
    .string()
    .trim()
    .max(300)
    .refine(isSafeHttpsUrl, "Social URL must be empty or start with https://");

  const heroSectionSchema = z.object({
    type: z.literal("hero"),
    props: z.object({
      title: z.string().trim().min(1).max(140),
      subtitle: z.string().trim().max(300).optional().default(""),
      badge: z.string().trim().max(60).optional().default(""),
      ctaText: z.string().trim().max(40).optional().default("تسوق الآن"),
      ctaHref: safeHref.optional().default("#products"),
      secondaryCtaText: z.string().trim().max(40).optional().default(""),
      secondaryCtaHref: safeOptionalHref.optional().default("#products"),
      imageUrl: safeImageUrl.optional().default(""),
      variant: z.enum(["centered", "split", "immersive"]).optional().default("centered"),
    }),
  });

  const productGridSectionSchema = z.object({
    type: z.literal("product_grid"),
    props: z.object({
      title: z.string().trim().max(100).optional().default("منتجاتنا"),
      subtitle: z.string().trim().max(200).optional().default(""),
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
      limit: z.number().int().min(1).max(24).default(12),
      showSearch: z.boolean().optional().default(true),
      badgeText: z.string().trim().max(30).optional().default(""),
    }),
  });

  const trustBadgesSectionSchema = z.object({
    type: z.literal("trust_badges"),
    props: z.object({
      subtitle: z.string().trim().max(160).optional().default(""),
      items: z
        .array(
          z.object({
            icon: z.enum([
              "cod",
              "fast_delivery",
              "58_wilayas",
              "quality",
              "support",
              "secure_payment",
              "exchange",
            ]),
            label: z.string().trim().min(1).max(80),
          })
        )
        .min(1)
        .max(6),
    }),
  });

  const faqSectionSchema = z.object({
    type: z.literal("faq"),
    props: z.object({
      title: z.string().trim().max(100).optional().default("الأسئلة الشائعة"),
      items: z
        .array(
          z.object({
            q: z.string().trim().min(1).max(200),
            a: z.string().trim().min(1).max(600),
          })
        )
        .min(1)
        .max(12),
    }),
  });

  const bannerSectionSchema = z.object({
    type: z.literal("banner"),
    props: z.object({
      text: z.string().trim().min(1).max(160),
      badge: z.string().trim().max(40).optional().default(""),
      variant: z.enum(["solid", "gradient", "marquee"]).optional().default("solid"),
    }),
  });

  const reviewsSectionSchema = z.object({
    type: z.literal("reviews"),
    props: z.object({
      title: z.string().trim().max(100).optional().default("آراء العملاء"),
      items: z
        .array(
          z.object({
            author: z.string().trim().min(1).max(60),
            city: z.string().trim().max(60).optional().default(""),
            rating: z.number().int().min(1).max(5).default(5),
            comment: z.string().trim().min(1).max(400),
          })
        )
        .min(1)
        .max(8),
    }),
  });

  const promoSplitSectionSchema = z.object({
    type: z.literal("promo_split"),
    props: z.object({
      badge: z.string().trim().max(40).optional().default(""),
      title: z.string().trim().min(1).max(140),
      description: z.string().trim().max(500).optional().default(""),
      bullets: z.array(z.string().trim().min(1).max(120)).max(5).optional().default([]),
      ctaText: z.string().trim().max(40).optional().default("اطلب الآن"),
      ctaHref: safeHref.optional().default("#products"),
      imageUrl: safeImageUrl.optional().default(""),
      imagePosition: z.enum(["left", "right"]).optional().default("right"),
    }),
  });

  const countdownSectionSchema = z.object({
    type: z.literal("countdown"),
    props: z.object({
      badge: z.string().trim().max(40).optional().default(""),
      title: z.string().trim().min(1).max(140),
      subtitle: z.string().trim().max(220).optional().default(""),
      hours: z.number().int().min(1).max(720).optional().default(24),
      ctaText: z.string().trim().max(40).optional().default("استفد من العرض"),
      ctaHref: safeHref.optional().default("#products"),
    }),
  });

  const sectionSchema = z.discriminatedUnion("type", [
    heroSectionSchema,
    productGridSectionSchema,
    trustBadgesSectionSchema,
    faqSectionSchema,
    bannerSectionSchema,
    reviewsSectionSchema,
    promoSplitSectionSchema,
    countdownSectionSchema,
  ]);

  return z.object({
    tokens: z.object({
      colors: z.object({
        primary: hexColor,
        background: hexColor,
        surface: hexColor,
        text: hexColor,
        muted: hexColor,
      }),
      font: z.enum(ALLOWED_FONTS),
      radius: z.enum(["none", "sm", "md", "lg", "full"]),
      direction: z.enum(["rtl", "ltr"]),
      headerStyle: z.enum(["minimal", "centered", "glass"]).optional().default("minimal"),
      cardStyle: z.enum(["elevated", "bordered", "minimal"]).optional().default("bordered"),
      brand: z
        .object({
          logoUrl: safeImageUrl.optional().default(""),
          whatsapp: z.string().trim().max(30).optional().default(""),
          phone: z.string().trim().max(30).optional().default(""),
          instagram: safeSocialUrl.optional().default(""),
          tiktok: safeSocialUrl.optional().default(""),
          facebook: safeSocialUrl.optional().default(""),
        })
        .optional()
        .default({}),
    }),
    pages: z.object({
      home: z.object({
        sections: z.array(sectionSchema).min(1).max(12),
      }),
      product: z.object({
        layout: z.enum(["standard", "landing_page"]).default("landing_page"),
        showRelated: z.boolean().default(true),
      }),
    }),
  });
}
