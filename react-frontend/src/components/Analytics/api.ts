const isDebug = import.meta.env.DEV;

/** Backend API URL. Set VITE_API_URL in .env for production (e.g. https://template-checker.fly.dev). */
export const baseURL =
  import.meta.env.VITE_API_URL ||
  (isDebug ? 'http://localhost:8000' : 'https://template-checker-test.fly.dev');

/**
 * Auth headers for backend. Prefer passing the Supabase session access_token when available.
 * Falls back to VITE_AUTH_TOKEN when no token is passed (e.g. legacy/extension).
 */
export function getAuthHeaders(accessToken?: string | null): Record<string, string> {
  const token = accessToken ?? import.meta.env.VITE_AUTH_TOKEN;
  const headers: Record<string, string> = { 'X-Source': 'react-frontend' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
