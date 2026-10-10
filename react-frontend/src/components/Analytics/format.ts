import type { Bucket, Overview, SourceType } from './types';

/**
 * Whether "vs previous period" is a fair comparison: data collection must have started before the previous
 * period did. Otherwise a mostly empty previous period makes every change look huge.
 */
export function hasFullPreviousPeriod(overview: Overview): boolean {
  if (!overview.data_since) return false;
  return new Date(overview.data_since).getTime() <= new Date(overview.period.previous_start).getTime();
}

export function formatCount(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US');
}

/** a / b, or null when there's nothing to divide by. */
export function ratio(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

/** 0.6432 -> "64%", 0.042 -> "4.2%", 0.0004 -> "<0.1%". */
export function formatPercent(r: number | null | undefined): string {
  if (r == null) return '—';
  const pct = r * 100;
  if (pct > 0 && pct < 0.1) return '<0.1%';
  const oneDecimal = pct.toFixed(1);
  if (pct < 10 && !oneDecimal.endsWith('.0')) return `${oneDecimal}%`;
  return `${Math.round(pct)}%`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Bucket start date (YYYY-MM-DD) for axes and tooltips. Parsed at local noon so the calendar day never shifts. */
export function formatBucket(date: string, bucket: Bucket, long = false): string {
  const d = new Date(`${date}T12:00:00`);
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!long) return day;
  return bucket === 'week'
    ? `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export const SOURCE_LABELS: Record<SourceType, string> = {
  'react-frontend': 'Web',
  extension: 'Extension',
  api: 'API',
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source as SourceType] ?? source;
}

const CATEGORY_LABELS: Record<string, string> = {
  par_styles: 'Paragraph styles',
  char_styles: 'Character styles',
  text_boxes: 'Text boxes',
  fonts: 'Fonts',
  images: 'Images',
  general: 'General',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

const STAGE_LABELS: Record<string, string> = {
  UNZIP_PACKAGE: 'Opening the ZIP',
  UNZIP_IDML: 'Opening the IDML',
  PARSE_XML: 'Reading the IDML',
  RESULTS: 'Building results',
};

/** Lowercase the first letter only, for mid-sentence use ("while reading the IDML"). */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Checker state name -> readable step, e.g. PARSE_XML -> "Reading the IDML", KERNING_CHECK -> "Kerning check". */
export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return 'Unknown step';
  if (STAGE_LABELS[stage]) return STAGE_LABELS[stage];
  const words = stage.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Alice Smith", else the email, else a placeholder for runs from before attribution. */
export function personLabel(name: string | null | undefined, email: string | null | undefined): string {
  return name?.trim() || email || 'Unattributed';
}
