import { createClient } from '@supabase/supabase-js';
// Service role client — bypasses RLS for server operations
// NEVER send SUPABASE_SERVICE_ROLE_KEY to the browser
export const supabaseAdmin = createClient(process.env.SUPABASE_URL || 'https://mock.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key', { auth: { autoRefreshToken: false, persistSession: false } });
// User-scoped client — respects RLS, takes user's JWT
export function supabaseForUser(accessToken) {
    return createClient(process.env.SUPABASE_URL || 'https://mock.supabase.co', process.env.SUPABASE_ANON_KEY || 'mock-anon-key', {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { autoRefreshToken: false, persistSession: false }
    });
}
