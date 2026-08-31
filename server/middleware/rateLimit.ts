const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(max = 20, windowMs = 60_000) {
  return (req: any, res: any, next: any) => {
    const key = req.user?.id ?? req.ip ?? 'anon';
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      return res.status(429).json({
        error: 'Too many requests. Wait a moment before trying again.'
      });
    }

    entry.count++;
    next();
  };
}
