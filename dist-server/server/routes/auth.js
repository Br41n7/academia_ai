import { Router } from 'express';
import crypto from 'crypto';
const router = Router();
const AUTH_SECRET = process.env.JWT_SECRET || 'academia-ai-custom-auth-secret-key-2025';
export function createAuthToken(user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    })).toString('base64url');
    const signature = crypto
        .createHmac('sha256', AUTH_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');
    return `${header}.${payload}.${signature}`;
}
export function verifyAuthToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const [header, payload, signature] = parts;
        const expectedSignature = crypto
            .createHmac('sha256', AUTH_SECRET)
            .update(`${header}.${payload}`)
            .digest('base64url');
        if (signature !== expectedSignature)
            return null;
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
        if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return {
            uid: decodedPayload.uid,
            email: decodedPayload.email,
            displayName: decodedPayload.displayName
        };
    }
    catch (err) {
        return null;
    }
}
/**
 * POST /api/auth/login
 * Logs in or registers a user with email / name and generates a custom token.
 */
router.post('/login', (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const cleanEmail = email.trim().toLowerCase();
        const displayName = name ? name.trim() : cleanEmail.split('@')[0];
        const uid = 'user_' + crypto.createHash('md5').update(cleanEmail).digest('hex').substring(0, 12);
        const user = { uid, email: cleanEmail, displayName };
        const token = createAuthToken(user);
        return res.json({
            token,
            user
        });
    }
    catch (err) {
        console.error('[Auth Login Error]:', err);
        return res.status(500).json({ error: 'Failed to authenticate user.' });
    }
});
/**
 * GET /api/auth/session
 * Validates token and returns current user context.
 */
router.get('/session', (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const token = authHeader.split(' ')[1];
        const user = verifyAuthToken(token);
        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        return res.json({ user });
    }
    catch (err) {
        return res.status(500).json({ error: 'Session validation error' });
    }
});
export default router;
