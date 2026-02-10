import type { StoredUserProfile } from '../types';

const STORAGE_KEY = 'supabaseAccessToken';
const STORAGE_USER_KEY = 'supabaseUser';

/** Production frontend URL so login flow stays on same origin and token returns to extension. */
const DEFAULT_FRONTEND_URL = 'https://template-checker.fly.dev';

export function getStoredToken(): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Promise.resolve(null);
  }
  return chrome.storage.local.get([STORAGE_KEY]).then(
    (result: { [key: string]: string }) => result[STORAGE_KEY] || null
  );
}

export function getStoredUser(): Promise<StoredUserProfile | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Promise.resolve(null);
  }
  return chrome.storage.local.get([STORAGE_USER_KEY]).then(
    (result: { [key: string]: StoredUserProfile | undefined }) => result[STORAGE_USER_KEY] || null
  );
}

export function logout(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Promise.resolve();
  }
  return chrome.storage.local.remove([STORAGE_KEY, STORAGE_USER_KEY, 'supabaseRefreshToken']);
}

export function getFrontendUrl(): string {
  const env = typeof process !== 'undefined' && process.env?.REACT_APP_FRONTEND_URL;
  if (env && (env as string).trim() !== '') return (env as string).trim();
  return DEFAULT_FRONTEND_URL;
}

export function openLoginTab(frontendUrl?: string): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  const base = (frontendUrl || getFrontendUrl()).replace(/\/$/, '');
  const loginUrl = base + '/?extension=true';
  chrome.runtime.sendMessage({ action: 'openLoginTab', url: loginUrl });
}

export async function ensureAuthenticated(frontendUrl?: string): Promise<string> {
  const token = await getStoredToken();
  if (!token) {
    openLoginTab(frontendUrl);
    throw new Error('Please sign in');
  }
  return token;
}
