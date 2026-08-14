import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

export interface AuthRequest extends Request {
  user?: { uid: string; email?: string };
  userApiKeys?: { openaiKey?: string; anthropicKey?: string; deepseekKey?: string };
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
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
      openaiKey: req.headers['x-openai-key'] as string | undefined,
      anthropicKey: req.headers['x-anthropic-key'] as string | undefined,
      deepseekKey: req.headers['x-deepseek-key'] as string | undefined,
    };

    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Verification failed:', error.message);
    return res.status(401).json({ error: 'Authorization token is invalid or expired.' });
  }
}
