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

/** The viewer's IANA timezone, so day buckets match their calendar. */
export function viewerTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

type Params = Record<string, string | number | undefined>;

function analyticsUrl(path: string, params: Params): string {
  const query = new URLSearchParams({ tz: viewerTimezone() });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return `${baseURL}/analytics/${path}?${query}`;
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.error?.message || fallback;
}

/** GET an analytics endpoint. Throws with the backend's message when it gives one. */
export async function fetchAnalytics<T>(
  path: string,
  params: Params,
  accessToken: string | null | undefined,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(analyticsUrl(path, params), { headers: getAuthHeaders(accessToken), signal });
  if (!response.ok) throw new Error(await errorMessage(response, 'Failed to load analytics'));
  return (await response.json()) as T;
}

/**
 * Download a CSV export and hand it to the browser as a file. The request needs the bearer token, so this
 * fetches it rather than linking to it. Returns how many rows matched vs. made it into the file.
 */
export async function downloadAnalyticsCsv(
  path: string,
  params: Params,
  accessToken: string | null | undefined
): Promise<{ total: number; exported: number }> {
  const response = await fetch(analyticsUrl(path, params), { headers: getAuthHeaders(accessToken) });
  if (!response.ok) throw new Error(await errorMessage(response, 'Export failed'));
  const blob = await response.blob();
  const filename =
    response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'template-checks.csv';
  const href = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href, download: filename });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 0);
  return {
    total: Number(response.headers.get('X-Total-Rows') ?? 0),
    exported: Number(response.headers.get('X-Exported-Rows') ?? 0),
  };
}
