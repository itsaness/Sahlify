<script setup lang="ts">
const { storeData, storeError, themeData } = await useStorefrontData();

const theme = computed(() => themeData.value?.theme);
const tokens = computed(() => theme.value?.tokens);
const brand = computed(() => tokens.value?.brand || {});

const radiusMap: Record<string, string> = {
  none: "0px",
  sm: "6px",
  md: "10px",
  lg: "16px",
  full: "24px",
};

const safeLogoUrl = computed(() => {
  const u = String(brand.value?.logoUrl || "").trim();
  return (u.startsWith("/uploads/") && !u.includes("..")) || u.startsWith("https://") ? u : "";
});

const whatsappHref = computed(() => {
  const raw = String(brand.value?.whatsapp || "").replace(/[^0-9]/g, "");
  if (!raw) return "";
  const normalized = raw.startsWith("0") ? `213${raw.slice(1)}` : raw;
  return `https://wa.me/${normalized}`;
});

const safeSocials = computed(() => {
  const list: Array<{ label: string; href: string }> = [];
  for (const [label, key] of [
    ["Instagram", "instagram"],
    ["TikTok", "tiktok"],
    ["Facebook", "facebook"],
  ] as const) {
    const u = String(brand.value?.[key] || "").trim();
    if (u.startsWith("https://")) {
      list.push({ label, href: u });
    }
  }
  return list;
});

useHead(() => {
  const font = tokens.value?.font || "Cairo";
  const dir = tokens.value?.direction || "rtl";
  const name = storeData.value?.store?.name || "Sahlify Store";
  return {
    title: name,
    htmlAttrs: {
      dir,
      lang: storeData.value?.store?.language || "ar",
    },
    link: [
      {
        rel: "stylesheet",
        href: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700;800&display=swap`,
      },
    ],
    meta: [
      { property: "og:title", content: name },
      { property: "og:type", content: "website" },
    ],
  };
});

const rootStyle = computed(() => {
  const c = tokens.value?.colors;
  if (!c) return {};
  const cardStyle = tokens.value?.cardStyle || "bordered";
  return {
    "--c-primary": c.primary,
    "--c-bg": c.background,
    "--c-surface": c.surface,
    "--c-text": c.text,
    "--c-muted": c.muted,
    "--radius": radiusMap[tokens.value?.radius || "lg"] || "16px",
    "--card-border": cardStyle === "minimal" ? "1px solid transparent" : "1px solid rgba(128, 128, 128, 0.16)",
    "--card-shadow":
      cardStyle === "elevated" ? "0 10px 30px -12px rgba(0, 0, 0, 0.14)" : "none",
    fontFamily: `'${tokens.value?.font || "Cairo"}', sans-serif`,
    backgroundColor: c.background,
    color: c.text,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  };
});

const headerStyle = computed(() => {
  const style = tokens.value?.headerStyle || "minimal";
  const base: Record<string, string> = {
    borderBottom: "1px solid rgba(128, 128, 128, 0.14)",
    padding: "0.9rem 1.5rem",
    position: "sticky",
    top: "0",
    zIndex: "40",
    background: style === "glass" ? "color-mix(in srgb, var(--c-surface) 84%, transparent)" : "var(--c-surface)",
    backdropFilter: style === "glass" ? "blur(12px)" : "none",
  };
  return base;
});
</script>

<template>
  <div :style="rootStyle">
    <div v-if="storeError" style="padding: 4rem 1.5rem; text-align: center">
      <h1>المتجر غير متاح حالياً</h1>
      <p>Store unavailable.</p>
    </div>
    <template v-else>
      <header :style="headerStyle">
        <div
          style="
            max-width: 1180px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
          "
        >
          <NuxtLink
            to="/"
            style="
              display: inline-flex;
              align-items: center;
              gap: 0.65rem;
              font-weight: 800;
              font-size: 1.2rem;
              text-decoration: none;
              color: inherit;
            "
          >
            <img
              v-if="safeLogoUrl"
              :src="safeLogoUrl"
              :alt="storeData?.store?.name || 'Store Logo'"
              style="height: 36px; width: auto; max-width: 140px; object-fit: contain; border-radius: 6px"
            />
            <span>{{ storeData?.store?.name }}</span>
          </NuxtLink>

          <div style="display: flex; align-items: center; gap: 0.75rem">
            <NuxtLink
              to="/#products"
              style="
                font-size: 0.9rem;
                font-weight: 600;
                text-decoration: none;
                color: var(--c-muted);
              "
            >
              {{ tokens?.direction === "ltr" ? "Catalog" : "المنتجات" }}
            </NuxtLink>
            <a
              v-if="whatsappHref"
              :href="whatsappHref"
              target="_blank"
              rel="noopener noreferrer"
              style="
                display: inline-flex;
                align-items: center;
                gap: 0.35rem;
                padding: 0.42rem 0.85rem;
                border-radius: 999px;
                background: #16a34a;
                color: #ffffff;
                font-size: 0.82rem;
                font-weight: 700;
                text-decoration: none;
              "
            >
              WhatsApp
            </a>
            <span
              v-if="storeData?.preview"
              style="font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 999px; background: #fef3c7; color: #92400e; font-weight: 700"
            >
              Preview
            </span>
          </div>
        </div>
      </header>

      <main style="flex: 1">
        <NuxtPage />
      </main>

      <footer
        style="
          border-top: 1px solid rgba(128, 128, 128, 0.14);
          background: var(--c-surface);
          padding: 2.25rem 1.5rem;
          text-align: center;
          color: var(--c-muted);
          font-size: 0.875rem;
        "
      >
        <div
          v-if="safeSocials.length || brand.phone || whatsappHref"
          style="
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
            margin-bottom: 1rem;
          "
        >
          <a
            v-if="brand.phone"
            :href="`tel:${brand.phone}`"
            style="color: inherit; text-decoration: none; font-weight: 600"
          >
            {{ brand.phone }}
          </a>
          <a
            v-if="whatsappHref"
            :href="whatsappHref"
            target="_blank"
            rel="noopener noreferrer"
            style="color: inherit; text-decoration: none; font-weight: 600"
          >
            WhatsApp
          </a>
          <a
            v-for="s in safeSocials"
            :key="s.label"
            :href="s.href"
            target="_blank"
            rel="noopener noreferrer"
            style="color: inherit; text-decoration: none; font-weight: 600"
          >
            {{ s.label }}
          </a>
        </div>

        <div>© {{ new Date().getFullYear() }} {{ storeData?.store?.name }}</div>
        <div style="margin-top: 0.65rem">
          <a
            href="https://sahlify.dz"
            target="_blank"
            rel="noopener noreferrer"
            style="
              display: inline-flex;
              align-items: center;
              gap: 0.4rem;
              color: var(--c-muted);
              text-decoration: none;
              font-size: 0.78rem;
              opacity: 0.85;
            "
          >
            <span
              aria-hidden="true"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                border-radius: 5px;
                background: var(--c-primary, #111827);
                color: #ffffff;
                font-weight: 800;
                font-size: 0.7rem;
              "
            >
              S
            </span>
            <span>Powered by <strong>Sahlify</strong></span>
          </a>
        </div>
      </footer>

      <a
        v-if="whatsappHref"
        :href="whatsappHref"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact on WhatsApp"
        style="
          position: fixed;
          bottom: 1.25rem;
          inset-inline-end: 1.25rem;
          z-index: 50;
          width: 52px;
          height: 52px;
          border-radius: 999px;
          background: #16a34a;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(22, 163, 74, 0.35);
          text-decoration: none;
        "
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm5.8 14.08c-.24.68-1.41 1.3-1.95 1.38-.5.07-1.13.1-1.82-.12-.42-.13-.96-.31-1.65-.61-2.9-1.26-4.8-4.18-4.94-4.37-.15-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.77-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.82 2 .89 2.14.07.15.12.32.02.52-.1.2-.15.32-.29.49-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.02 1.12 1 2.07 1.31 2.36 1.46.29.15.46.12.63-.07.17-.2.73-.85.92-1.14.19-.29.39-.24.66-.14.27.1 1.7.8 1.99.95.29.15.49.22.56.34.07.12.07.7-.17 1.38Z"
          />
        </svg>
      </a>
    </template>
  </div>
</template>
