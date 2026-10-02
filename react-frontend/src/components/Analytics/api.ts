const isDebug = import.meta.env.DEV;

/** Backend API URL. Set VITE_API_URL in .env for production (e.g. https://template-checker.fly.dev). */
export const baseURL =
  import.meta.env.VITE_API_URL ||
  (isDebug ? 'http://localhost:8000' : 'https://template-checker-test.fly.dev');

/**
 * Auth headers for backend, using the signed-in user's Supabase access_token.
 * Never embed a static token here: VITE_* variables are baked into the public JS bundle.
 */
export function getAuthHeaders(accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'X-Source': 'react-frontend' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}
