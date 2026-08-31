import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  extraHeaders: Record<string, string> = {}
) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
    ...extraHeaders,
  };

  // Only set Content-Type for non-FormData requests
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Forward session-only user model keys
  try {
    const keys = JSON.parse(sessionStorage.getItem('academia_keys') || '{}');
    if (keys.groqKey) headers['x-groq-key'] = keys.groqKey;
  } catch {}

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Request failed: ${response.status}`);
  }

  return response.json();
}
