import { supabaseAdmin } from '../services/supabaseAdmin.js';

const FREE_DAILY_LIMIT = 20;

export async function creditCheck(req: any, res: any, next: any) {
  // If user brought their own Groq key, bypass quota entirely
  if (req.userApiKeys?.groqKey) return next();

  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabaseAdmin
      .from('ai_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    const current = data?.count ?? 0;

    if (current >= FREE_DAILY_LIMIT) {
      return res.status(429).json({
        error: `Daily limit of ${FREE_DAILY_LIMIT} AI requests reached. ` +
               `Add your own Groq API key in Settings → My AI for unlimited ` +
               `access. Free quota resets at midnight.`
      });
    }

    // Upsert increment
    await supabaseAdmin.from('ai_usage').upsert(
      { user_id: userId, usage_date: today, count: current + 1 },
      { onConflict: 'user_id,usage_date' }
    );

    next();
  } catch (err: any) {
    // If quota check fails, let through rather than blocking the user
    console.error('[CreditCheck] Failed:', err.message);
    next();
  }
}
