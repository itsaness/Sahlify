import { z } from "zod";
import { createThemeSchema, ALLOWED_FONTS } from "../../../../packages/theme-schema/index.js";

export { ALLOWED_FONTS };
export const themeSchema = createThemeSchema(z);

export const STARTER_TEMPLATES = {
  modern_ar: {
    name: "عصري متكامل (عربي)",
    theme: {
      tokens: {
        colors: {
          primary: "#0F766E",
          background: "#FAFAFA",
          surface: "#FFFFFF",
          text: "#111827",
          muted: "#6B7280",
        },
        font: "Cairo",
        radius: "lg",
        direction: "rtl",
        headerStyle: "glass",
        cardStyle: "elevated",
        brand: { logoUrl: "", whatsapp: "", phone: "", instagram: "", tiktok: "", facebook: "" },
      },
      pages: {
        home: {
          sections: [
            {
              type: "banner",
              props: {
                text: "الدفع عند الاستلام والتوصيل لـ 69 ولاية — شحن سريع لباب المنزل",
                badge: "توصيل سريع",
                variant: "gradient",
              },
            },
            {
              type: "hero",
              props: {
                badge: "تشكيلة جديدة",
                title: "منتجات مختارة بعناية وجودة مضمونة",
                subtitle: "اطلب الآن بكل سهولة وادفع عند استلام طلبيتك في جميع ولايات الجزائر.",
                ctaText: "تصفح المنتجات",
                ctaHref: "#products",
                secondaryCtaText: "الأسئلة الشائعة",
                secondaryCtaHref: "#faq",
                imageUrl: "",
                variant: "centered",
              },
            },
            {
              type: "trust_badges",
              props: {
                items: [
                  { icon: "cod", label: "الدفع عند الاستلام" },
                  { icon: "58_wilayas", label: "توصيل 69 ولاية" },
                  { icon: "fast_delivery", label: "شحن خلال 24-72 ساعة" },
                  { icon: "exchange", label: "استبدال سهل ومضمون" },
                ],
              },
            },
            {
              type: "product_grid",
              props: {
                title: "أحدث المنتجات",
                subtitle: "اكتشف أفضل العروض والمنتجات الأكثر طلباً",
                columns: 3,
                limit: 12,
                showSearch: true,
                badgeText: "",
              },
            },
            {
              type: "reviews",
              props: {
                title: "ماذا يقول زبائننا",
                items: [
                  { author: "ياسين ب.", city: "الجزائر العاصمة", rating: 5, comment: "جودة ممتازة والتوصيل وصلني في 24 ساعة فقط!" },
                  { author: "سارة م.", city: "وهران", rating: 5, comment: "تغليف احترافي والمنتج مطابق تماماً للصور." },
                  { author: "كريم ت.", city: "قسنطينة", rating: 5, comment: "خدمة زبائن رائعة والدفع عند الاستلام مريح جداً." },
                ],
              },
            },
            {
              type: "faq",
              props: {
                title: "الأسئلة الشائعة",
                items: [
                  {
                    q: "كيف يتم الدفع؟",
                    a: "يمكنك الدفع نقداً عند استلام الطلبية أو إلكترونياً عبر البطاقة الذهبية و CIB.",
                  },
                  {
                    q: "كم تستغرق مدة التوصيل؟",
                    a: "من يوم إلى 3 أيام حسب الولاية، مع إمكانية الاستلام من مكتب التوصيل أو المنزل.",
                  },
                ],
              },
            },
          ],
        },
        product: {
          layout: "landing_page",
          showRelated: true,
        },
      },
    },
  },

  minimal_fr: {
    name: "Minimal Studio (Français)",
    theme: {
      tokens: {
        colors: {
          primary: "#1D4ED8",
          background: "#FFFFFF",
          surface: "#F8FAFC",
          text: "#0F172A",
          muted: "#64748B",
        },
        font: "Inter",
        radius: "md",
        direction: "ltr",
        headerStyle: "glass",
        cardStyle: "bordered",
        brand: { logoUrl: "", whatsapp: "", phone: "", instagram: "", tiktok: "", facebook: "" },
      },
      pages: {
        home: {
          sections: [
            {
              type: "banner",
              props: {
                text: "Livraison 69 wilayas • Paiement à la livraison ou par carte Edahabia / CIB",
                badge: "Algérie",
                variant: "solid",
              },
            },
            {
              type: "hero",
              props: {
                badge: "Nouvelle Collection",
                title: "L'essentiel du quotidien, livré chez vous",
                subtitle: "Commandez en 30 secondes sans carte bancaire requise. Paiement à la réception.",
                ctaText: "Voir le catalogue",
                ctaHref: "#products",
                imageUrl: "",
                variant: "centered",
              },
            },
            {
              type: "trust_badges",
              props: {
                items: [
                  { icon: "cod", label: "Paiement à la livraison" },
                  { icon: "58_wilayas", label: "Livraison 69 wilayas" },
                  { icon: "quality", label: "Qualité garantie" },
                  { icon: "support", label: "Support WhatsApp 7j/7" },
                ],
              },
            },
            {
              type: "product_grid",
              props: {
                title: "Nos produits",
                subtitle: "Sélection vérifiée et expédiée rapidement",
                columns: 3,
                limit: 12,
                showSearch: true,
              },
            },
            {
              type: "reviews",
              props: {
                title: "Avis clients vérifiés",
                items: [
                  { author: "Amine K.", city: "Alger", rating: 5, comment: "Livraison rapide et produit conforme à 100%." },
                  { author: "Lina B.", city: "Béjaïa", rating: 5, comment: "Très satisfaite de la qualité et du service client." },
                ],
              },
            },
          ],
        },
        product: {
          layout: "landing_page",
          showRelated: true,
        },
      },
    },
  },

  luxury_oud_ar: {
    name: "فاخر — عطور وعود (داكن وذهبي)",
    theme: {
      tokens: {
        colors: {
          primary: "#C9A227",
          background: "#0B0B0F",
          surface: "#15151C",
          text: "#F9FAFB",
          muted: "#9CA3AF",
        },
        font: "Readex Pro",
        radius: "md",
        direction: "rtl",
        headerStyle: "glass",
        cardStyle: "bordered",
        brand: { logoUrl: "", whatsapp: "", phone: "", instagram: "", tiktok: "", facebook: "" },
      },
      pages: {
        home: {
          sections: [
            {
              type: "banner",
              props: {
                text: "إصدارات حصرية من العود والعطور الشرقية الفاخرة — توصيل مؤمّن لجميع الولايات",
                badge: "فخامة",
                variant: "gradient",
              },
            },
            {
              type: "hero",
              props: {
                badge: "دار العطور الفاخرة",
                title: "عبق الأصالة والفخامة في كل قطرة",
                subtitle: "تركيبات عطرية مركّزة تدوم طوال اليوم، مصممة بذوق رفيع وتغليف يليق بالإهداء.",
                ctaText: "اكتشف المجموعة",
                ctaHref: "#products",
                imageUrl: "",
                variant: "immersive",
              },
            },
            {
              type: "trust_badges",
              props: {
                items: [
                  { icon: "quality", label: "تركيز عالٍ وثبات مضمون" },
                  { icon: "cod", label: "الدفع عند الاستلام" },
                  { icon: "58_wilayas", label: "توصيل سريع 69 ولاية" },
                ],
              },
            },
            {
              type: "product_grid",
              props: {
                title: "المجموعة الملكية",
                columns: 3,
                limit: 12,
                showSearch: true,
                badgeText: "الأكثر مبيعاً",
              },
            },
            {
              type: "countdown",
              props: {
                badge: "عرض محدود",
                title: "تخفيضات نهاية الأسبوع على العطور الملكية",
                subtitle: "اطلب الآن واستفد من التوصيل السريع والتغليف الفاخر مجاناً.",
                hours: 48,
                ctaText: "اطلب قبل انتهاء العرض",
                ctaHref: "#products",
              },
            },
          ],
        },
        product: {
          layout: "landing_page",
          showRelated: true,
        },
      },
    },
  },

  rose_beauty_ar: {
    name: "جمال وعناية (وردي ناعم)",
    theme: {
      tokens: {
        colors: {
          primary: "#BE185D",
          background: "#FFF9FB",
          surface: "#FFFFFF",
          text: "#1F2937",
          muted: "#6B7280",
        },
        font: "Tajawal",
        radius: "lg",
        direction: "rtl",
        headerStyle: "centered",
        cardStyle: "elevated",
        brand: { logoUrl: "", whatsapp: "", phone: "", instagram: "", tiktok: "", facebook: "" },
      },
      pages: {
        home: {
          sections: [
            {
              type: "banner",
              props: {
                text: "منتجات عناية أصلية 100% — توصيل سريع وسري لجميع الولايات",
                badge: "أصلي 100%",
                variant: "gradient",
              },
            },
            {
              type: "hero",
              props: {
                badge: "عناية بالبشرة والجمال",
                title: "روتين جمالك اليومي بلمسة طبيعية",
                subtitle: "مختارات من أفضل مستحضرات التجميل والعناية الأصلية بأسعار مدروسة.",
                ctaText: "تسوقي الآن",
                ctaHref: "#products",
                imageUrl: "",
                variant: "centered",
              },
            },
            {
              type: "product_grid",
              props: {
                title: "الأكثر طلباً",
                columns: 3,
                limit: 12,
                showSearch: true,
              },
            },
            {
              type: "promo_split",
              props: {
                badge: "باقة التوفير",
                title: "لماذا تختارين متجرنا؟",
                description: "نحرص على توفير منتجات أصلية مستوردة ومفحوصة بعناية لضمان أفضل نتائج لبشرتك.",
                bullets: [
                  "منتجات أصلية مضمونة 100%",
                  "توصيل سريع للمنزل أو مكتب التوصيل",
                  "إمكانية فحص الطلبية عند الاستلام",
                ],
                ctaText: "استكشفي المنتجات",
                ctaHref: "#products",
                imageUrl: "",
                imagePosition: "right",
              },
            },
            {
              type: "faq",
              props: {
                title: "أسئلة شائعة",
                items: [
                  { q: "هل المنتجات أصلية؟", a: "نعم، جميع منتجاتنا أصلية 100% ومضمونة." },
                  { q: "كيف أطلب؟", a: "اختاري المنتج، أكتبي اسمك ورقم هاتفك والولاية، وسنتصل بك لتأكيد الطلب." },
                ],
              },
            },
          ],
        },
        product: {
          layout: "landing_page",
          showRelated: true,
        },
      },
    },
  },

  streetwear_fr: {
    name: "Streetwear & Mode (Français)",
    theme: {
      tokens: {
        colors: {
          primary: "#111827",
          background: "#F4F4F5",
          surface: "#FFFFFF",
          text: "#09090B",
          muted: "#71717A",
        },
        font: "Outfit",
        radius: "sm",
        direction: "ltr",
        headerStyle: "minimal",
        cardStyle: "bordered",
        brand: { logoUrl: "", whatsapp: "", phone: "", instagram: "", tiktok: "", facebook: "" },
      },
      pages: {
        home: {
          sections: [
            {
              type: "banner",
              props: {
                text: "NOUVEAU DROP DISPONIBLE • LIVRAISON 69 WILAYAS • PAIEMENT À LA RÉCEPTION",
                badge: "DROP",
                variant: "solid",
              },
            },
            {
              type: "hero",
              props: {
                badge: "Édition Limitée",
                title: "Coupes Oversize & Qualité Premium",
                subtitle: "Des pièces pensées pour durer. Échange de taille facile partout en Algérie.",
                ctaText: "Découvrir le Drop",
                ctaHref: "#products",
                imageUrl: "",
                variant: "centered",
              },
            },
            {
              type: "product_grid",
              props: {
                title: "Collection Actuelle",
                columns: 4,
                limit: 12,
                showSearch: true,
              },
            },
            {
              type: "trust_badges",
              props: {
                items: [
                  { icon: "exchange", label: "Échange taille facile" },
                  { icon: "cod", label: "Paiement à la livraison" },
                  { icon: "fast_delivery", label: "Expédition 24h" },
                ],
              },
            },
          ],
        },
        product: {
          layout: "landing_page",
          showRelated: true,
        },
      },
    },
  },

  tech_store_ar: {
    name: "إلكترونيات وتقنية (أزرق حديث)",
    theme: {
      tokens: {
        colors: {
          primary: "#2563EB",
          background: "#F8FAFC",
          surface: "#FFFFFF",
          text: "#0F172A",
          muted: "#475569",
        },
        font: "Almarai",
        radius: "md",
        direction: "rtl",
        headerStyle: "glass",
        cardStyle: "elevated",
        brand: { logoUrl: "", whatsapp: "", phone: "", instagram: "", tiktok: "", facebook: "" },
      },
      pages: {
        home: {
          sections: [
            {
              type: "banner",
              props: {
                text: "ضمان حقيقي على جميع الأجهزة والإكسسوارات • دفع عند الاستلام أو عبر البطاقة الذهبية",
                badge: "ضمان",
                variant: "solid",
              },
            },
            {
              type: "hero",
              props: {
                badge: "تكنولوجيا حديثة",
                title: "أحدث الإكسسوارات والأجهزة الذكية",
                subtitle: "جودة عالية، ضمان استبدال، وتوصيل سريع لـ 69 ولاية جزائرية.",
                ctaText: "تصفح الأجهزة",
                ctaHref: "#products",
                imageUrl: "",
                variant: "centered",
              },
            },
            {
              type: "trust_badges",
              props: {
                items: [
                  { icon: "quality", label: "ضمان الاستبدال" },
                  { icon: "secure_payment", label: "دفع آمن بالذهبية و CIB" },
                  { icon: "cod", label: "الدفع عند الاستلام" },
                  { icon: "58_wilayas", label: "توصيل 69 ولاية" },
                ],
              },
            },
            {
              type: "product_grid",
              props: {
                title: "أحدث الوصولات",
                columns: 3,
                limit: 12,
                showSearch: true,
              },
            },
          ],
        },
        product: {
          layout: "landing_page",
          showRelated: true,
        },
      },
    },
  },
};
