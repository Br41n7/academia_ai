import { auth } from '../firebase';

export async function apiFetch(path: string, options: RequestInit = {}) {
  let token = localStorage.getItem('customAuthToken');

  if (!token && auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch {
      // Ignore firebase token error if unused
    }
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only default to application/json if body is NOT FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Forward user model keys from sessionStorage (session preference only)
  const keys = JSON.parse(sessionStorage.getItem('userApiKeys') || '{}');
  if (keys.openaiKey) headers['x-openai-key'] = keys.openaiKey;
  if (keys.anthropicKey) headers['x-anthropic-key'] = keys.anthropicKey;
  if (keys.deepseekKey) headers['x-deepseek-key'] = keys.deepseekKey;

  return fetch(path, { ...options, headers });
}
