const rateLimits = new Map();
export function rateLimit(req, res, next) {
    const uid = req.user?.uid;
    if (!uid) {
        return next();
    }
    const now = Date.now();
    const limitWindow = 60 * 1000; // 60 seconds
    const maxRequests = 20;
    let limitData = rateLimits.get(uid);
    if (!limitData || now > limitData.resetTime) {
        limitData = {
            count: 1,
            resetTime: now + limitWindow,
        };
        rateLimits.set(uid, limitData);
        return next();
    }
    if (limitData.count >= maxRequests) {
        return res.status(429).json({ error: 'Too many requests. Wait a moment.' });
    }
    limitData.count += 1;
    next();
}
