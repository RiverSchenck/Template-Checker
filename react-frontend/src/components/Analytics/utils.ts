/**
 * Format a date-only string (YYYY-MM-DD) for chart axes/tooltips.
 * Uses noon local time so the calendar day displays correctly in all timezones
 * (parsing "YYYY-MM-DD" as UTC midnight would show as the previous day for users behind UTC).
 */
export function formatChartDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
  const d = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? new Date(dateStr + 'T12:00:00')
    : new Date(dateStr);
  return d.toLocaleDateString('en-US', options);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

export function getSourceTypeLabel(source: string): string {
  switch (source) {
    case 'react-frontend':
      return 'Web';
    case 'extension':
      return 'Extension';
    case 'api':
      return 'API';
    default:
      return source;
  }
}
