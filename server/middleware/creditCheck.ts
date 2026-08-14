import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import admin from 'firebase-admin';

export async function creditCheck(req: AuthRequest, res: Response, next: NextFunction) {
  const uid = req.user?.uid;
  if (!uid) {
    return next();
  }

  // Skip quota check entirely if the user has provided any of their own keys in the headers
  const hasCustomKey = !!(
    req.userApiKeys?.openaiKey ||
    req.userApiKeys?.anthropicKey ||
    req.userApiKeys?.deepseekKey
  );

  if (hasCustomKey) {
    return next();
  }

  try {
    const db = admin.firestore();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const usageDocId = `${uid}_${today}`;
    const usageDocRef = db.collection('usage').doc(usageDocId);

    const docSnap = await usageDocRef.get();
    const currentCount = docSnap.exists ? (docSnap.data()?.count || 0) : 0;

    if (currentCount >= 15) {
      return res.status(429).json({
        error: "Daily limit of 15 AI requests reached. Add your own API key in Settings > My AI for unlimited access. Resets at midnight."
      });
    }

    // Increment count atomically or merge
    await usageDocRef.set({ count: currentCount + 1 }, { merge: true });
    next();
  } catch (error: any) {
    console.error('[Credit Check Middleware] Error:', error.message);
    // On unexpected Firestore errors, we still allow the user through but log a warning to ensure platform resilience
    next();
  }
}
