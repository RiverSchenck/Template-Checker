/**
 * Extension version and download URL — single source of truth for the web app.
 *
 * When you release a new extension:
 * 1. Bump LATEST_EXTENSION_VERSION here (e.g. "1.1.0").
 * 2. Bump "version" in extension/public/manifest.json and extension/package.json to match.
 * 3. Create a new GitHub release and update EXTENSION_DOWNLOAD_URL if the release tag changes
 *    (e.g. .../releases/download/v1.1.0/frontify-template-checker-extension.zip).
 *
 * The extension sends its version when it opens the checker tab (?checkUrl=...&extVersion=1.0.0).
 * ProtectedLayout compares extVersion to LATEST_EXTENSION_VERSION and shows an "out of date" toast
 * when the user's extension is older.
 */

/** Current extension version we consider "latest". Update this when you publish a new release. */
export const LATEST_EXTENSION_VERSION = "1.0.0";

/** Download URL for the extension ZIP. Update the version segment when you release a new version. */
export const EXTENSION_DOWNLOAD_URL = `https://github.com/RiverSchenck/Template-Checker/releases/download/v${LATEST_EXTENSION_VERSION}/frontify-template-checker-extension.zip`;

/**
 * Returns true if `installed` is strictly older than `latest` (e.g. 1.0.0 < 1.1.0).
 * Handles x.y.z format; missing segments treated as 0.
 */
export function isExtensionOutOfDate(
  installed: string,
  latest: string,
): boolean {
  const toParts = (v: string): number[] =>
    v.split(".").map((n) => Math.max(0, parseInt(n, 10) || 0));
  const a = toParts(installed);
  const b = toParts(latest);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai < bi) return true;
    if (ai > bi) return false;
  }
  return false; // same version
}
