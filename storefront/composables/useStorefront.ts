export function useStorefrontHeaders() {
  const headers = useRequestHeaders(["host"]);
  const route = useRoute();
  const preview = typeof route.query.preview === "string" ? route.query.preview : undefined;
  return {
    reqHeaders: headers.host ? { "X-Store-Host": headers.host } : {},
    preview,
  };
}

export function useApiBase() {
  const config = useRuntimeConfig();
  // Browser requests go same-origin via Caddy (/api/...); SSR uses internal service URL
  return import.meta.client ? "" : config.public.apiBase;
}

export async function useStorefrontData() {
  const apiBase = useApiBase();
  const { reqHeaders, preview } = useStorefrontHeaders();
  const query = preview ? { preview } : undefined;
  const hostKey = reqHeaders["X-Store-Host"] || "default";
  const suffix = `${hostKey}:${preview || ""}`;

  const [{ data: storeData, error: storeError }, { data: themeData }] = await Promise.all([
    useFetch<{ store: any; preview: boolean }>(`${apiBase}/api/storefront/store`, {
      key: `sf-store:${suffix}`,
      headers: reqHeaders,
      query,
    }),
    useFetch<{ theme: any; version: number }>(`${apiBase}/api/storefront/theme`, {
      key: `sf-theme:${suffix}`,
      headers: reqHeaders,
      query,
    }),
  ]);

  return { storeData, storeError, themeData, preview };
}
