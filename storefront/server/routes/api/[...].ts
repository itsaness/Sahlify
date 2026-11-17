import { createError, defineEventHandler, getRequestHeader, proxyRequest } from "h3";

const ALLOWED_PREFIXES = ["/api/storefront/", "/api/wilayas"];

export default defineEventHandler((event) => {
  const pathname = event.path.split("?")[0];
  const isAllowed = ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
  if (!isAllowed) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }

  const config = useRuntimeConfig(event);
  const target = `${config.public.apiBase}${event.path}`;
  const host = getRequestHeader(event, "host");

  return proxyRequest(event, target, {
    headers: host ? { "x-store-host": host } : undefined,
  });
});
