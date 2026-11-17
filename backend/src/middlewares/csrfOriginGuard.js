import { env } from "../config/env.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection for cookie-authenticated dashboard & admin endpoints.
 * Rejects cross-site / same-site-subdomain state-changing requests.
 */
export function csrfOriginGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const secFetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (secFetchSite === "cross-site" || secFetchSite === "same-site") {
    return res.status(403).json({ message: "Cross-site request blocked" });
  }

  const origin = req.headers.origin;
  if (origin) {
    if (origin !== env.FRONTEND_URL) {
      return res.status(403).json({ message: "Untrusted request origin" });
    }
    return next();
  }

  const referer = req.headers.referer;
  if (referer) {
    try {
      const refOrigin = new URL(String(referer)).origin;
      if (refOrigin !== env.FRONTEND_URL) {
        return res.status(403).json({ message: "Untrusted request referer" });
      }
    } catch {
      return res.status(403).json({ message: "Invalid request referer" });
    }
  }

  next();
}
