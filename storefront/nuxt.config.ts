const apiTarget = process.env.NUXT_PUBLIC_API_BASE || "http://localhost:3000";

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      apiBase: apiTarget,
    },
  },
  routeRules: {
    "/uploads/**": { proxy: `${apiTarget}/uploads/**` },
  },
});
