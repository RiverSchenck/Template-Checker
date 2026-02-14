/**
 * Notify the extension to highlight an element on the Frontify page.
 * If spreadId is provided and the item is on a different spread, the extension will navigate to that spread in Frontify first, then highlight.
 */
export function notifyExtensionToHighlight(
  dataId: string,
  textContent?: string[],
  spreadId?: string | null
): void {
  if (!dataId || dataId === 'null') return;
  window.postMessage(
    {
      action: 'highlightOnFrontify',
      dataId,
      textContent: textContent ?? undefined,
      spreadId: spreadId ?? undefined,
    },
    '*'
  );
}

/**
 * Notify the extension to highlight all (filtered) issues on the Frontify page.
 * errors, warnings, infos are arrays of data_id strings for the current filter view.
 */
export function notifyExtensionToHighlightFiltered(
  errors: string[],
  warnings: string[],
  infos: string[]
): void {
  window.postMessage(
    {
      action: 'highlightFilteredIssuesOnFrontify',
      errors: errors ?? [],
      warnings: warnings ?? [],
      infos: infos ?? [],
    },
    '*'
  );
}

/**
 * Notify the extension to clear the bulk filter highlights on the Frontify page.
 */
export function notifyExtensionToClearFilterHighlights(): void {
  window.postMessage({ action: 'clearFilterHighlightsOnFrontify' }, '*');
}
