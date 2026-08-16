import admin from 'firebase-admin';
import { verifyAuthToken } from '../routes/auth.js';
export async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authorization token is missing.' });
    }
    // 1. Try custom JWT auth token verification first
    const customUser = verifyAuthToken(token);
    if (customUser) {
        req.user = customUser;
        req.userApiKeys = {
            openaiKey: req.headers['x-openai-key'],
            anthropicKey: req.headers['x-anthropic-key'],
            deepseekKey: req.headers['x-deepseek-key'],
        };
        return next();
    }
    // 2. Fallback to Firebase ID Token verification if custom token verification failed
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
        };
        req.userApiKeys = {
            openaiKey: req.headers['x-openai-key'],
            anthropicKey: req.headers['x-anthropic-key'],
            deepseekKey: req.headers['x-deepseek-key'],
        };
        return next();
    }
    catch (error) {
        console.error('[Auth Middleware] Verification failed:', error.message);
        return res.status(401).json({ error: 'Authorization token is invalid or expired.' });
    }
}
