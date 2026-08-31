import { supabaseAdmin } from '../services/supabaseAdmin.js';
export async function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        res.status(401).json({ error: 'Not authenticated. Please sign in.' });
        return;
    }
    try {
        // Verify JWT with Supabase — this is the Supabase equivalent of
        // Firebase Admin verifyIdToken()
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            res.status(401).json({ error: 'Invalid or expired session. Sign in again.' });
            return;
        }
        req.user = { id: user.id, email: user.email };
        req.accessToken = token;
        // Session-only user model keys — never stored
        req.userApiKeys = {
            groqKey: req.headers['x-groq-key'],
        };
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Authentication failed.' });
    }
}
