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
export const LATEST_EXTENSION_VERSION = "1.0.1";

/** Download URL for the extension ZIP. Update the version segment when you release a new version. */
export const EXTENSION_DOWNLOAD_URL =
  "https://github.com/RiverSchenck/Template-Checker/releases/download/v1.0.1/frontify-template-checker-extension-v1.0.1.zip";

/**
 * "New" badge window for the Checker Extension nav item.
 * Set this to the launch date/time, then the badge auto-hides after 30 days.
 */
export const EXTENSION_NEW_BADGE_START_AT = "2026-03-11T00:00:00Z";
export const EXTENSION_NEW_BADGE_DURATION_DAYS = 30;

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

/** Returns true while the extension "New" badge should be visible. */
export function shouldShowExtensionNewBadge(now: Date = new Date()): boolean {
  const start = new Date(EXTENSION_NEW_BADGE_START_AT);
  if (Number.isNaN(start.getTime())) return false;
  const end = new Date(
    start.getTime() + EXTENSION_NEW_BADGE_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );
  return now >= start && now < end;
}
