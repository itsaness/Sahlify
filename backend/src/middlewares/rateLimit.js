/**
 * Simple bounded in-memory sliding-window rate limiter.
 */
export function rateLimit({ windowMs = 60_000, max = 20, maxEntries = 10_000, keyFn }) {
  const hits = new Map();

  // Periodic cleanup of expired buckets
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, entries] of hits.entries()) {
      const fresh = entries.filter((t) => now - t < windowMs);
      if (fresh.length === 0) hits.delete(k);
      else hits.set(k, fresh);
    }
  }, windowMs);
  timer.unref();

  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    if (!key) return next();

    const now = Date.now();
    const entries = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (entries.length >= max) {
      return res.status(429).json({ message: "Too many requests, please try again later." });
    }
    if (!hits.has(key) && hits.size >= maxEntries) {
      const oldestKey = hits.keys().next().value;
      if (oldestKey !== undefined) hits.delete(oldestKey);
    }
    entries.push(now);
    hits.set(key, entries);
    next();
  };
}
