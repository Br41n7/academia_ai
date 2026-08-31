const store = new Map();
export function rateLimit(max = 20, windowMs = 60_000) {
    return (req, res, next) => {
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
