/**
 * Simple authentication for the extension.
 * Just uses the token if available, otherwise fails.
 */

// Use backend URL (same as API calls)
const isDebug = true; // Match your FileUpload/Analytics setting
const BACKEND_URL = isDebug
  ? "http://localhost:8000"
  : "https://template-checker-test.fly.dev";

/**
 * Get stored authentication token.
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return null;
  }

  const result = await chrome.storage.local.get(["authToken"]);
  return result.authToken || null;
}

/**
 * Store authentication token.
 */
export async function setAuthToken(token: string): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage) {
    throw new Error("Chrome extension API not available");
  }

  await chrome.storage.local.set({ authToken: token });
}

/**
 * Get token from backend API.
 * Backend returns AUTH_TOKEN or null.
 */
async function getTokenFromBackend(): Promise<string | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/extension-token`, {
      method: "GET",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error("Error getting token from backend:", error);
    return null;
  }
}

/**
 * Ensure we have a valid auth token.
 * Just checks storage and backend. If no token, throws error.
 */
export async function ensureAuthenticated(): Promise<string> {
  // First check stored token
  let token = await getAuthToken();

  // If no stored token, try backend
  if (!token) {
    token = await getTokenFromBackend();
    if (token) {
      await setAuthToken(token);
    }
  }

  // If still no token, fail
  if (!token) {
    throw new Error(
      "Authentication required. Please log in to the web app first."
    );
  }

  return token;
}
