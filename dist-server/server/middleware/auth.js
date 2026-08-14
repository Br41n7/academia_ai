import admin from 'firebase-admin';
export async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authorization token is missing.' });
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
        };
        // Read optional per-request model keys from headers (session-only)
        req.userApiKeys = {
            openaiKey: req.headers['x-openai-key'],
            anthropicKey: req.headers['x-anthropic-key'],
            deepseekKey: req.headers['x-deepseek-key'],
        };
        next();
    }
    catch (error) {
        console.error('[Auth Middleware] Verification failed:', error.message);
        return res.status(401).json({ error: 'Authorization token is invalid or expired.' });
    }
}
