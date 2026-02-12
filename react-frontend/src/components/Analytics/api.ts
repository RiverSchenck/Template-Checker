const isDebug = process.env.NODE_ENV !== 'production';

export const baseURL = isDebug ? 'http://localhost:8000' : 'https://template-checker-test.fly.dev';

export function getAuthHeaders(): Record<string, string> {
  const token = process.env.REACT_APP_AUTH_TOKEN;
  const headers: Record<string, string> = { 'X-Source': 'react-frontend' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
