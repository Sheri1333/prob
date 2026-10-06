import type { Request, Response, NextFunction } from "express";

/**
 * Small in-memory fixed-window limiter. Good enough for a single API process
 * behind Nginx; protects login / password reset from brute force and mail spam.
 */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  message: string;
  key?: (req: Request) => string;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, opts.windowMs);
  sweep.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = opts.key?.(req) ?? req.ip ?? "unknown";
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ error: opts.message });
      return;
    }
    next();
  };
}
