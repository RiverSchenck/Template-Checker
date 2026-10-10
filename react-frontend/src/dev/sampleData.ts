/**
 * Dev-only: a year of synthetic checker runs, and the same aggregations the SQL functions in
 * python_backend/migrations/007_analytics_v2.sql perform, so the analytics page can be previewed (filters,
 * drill-downs and all) without a backend. Everything is seeded, so the data is the same on every load.
 *
 * Built in a few deliberate stories worth spotting on the page:
 *  - usage grows through the year; weekends are quiet
 *  - a deploy 9 days ago causes a run of PARSE_XML crashes
 *  - "Color Fill Tint" is a new check that started firing 12 days ago
 *  - overrides are trending down, missing fonts are steady
 */
import type {
  Bucket,
  IssueDetail,
  Overview,
  PeriodStats,
  RunRow,
  RunsPage,
  RunStatus,
  Severity,
  SourceType,
} from '../components/Analytics/types';

const DAY = 24 * 60 * 60 * 1000;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261010);
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
function weighted<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}
function logNormal(median: number, spread: number) {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return median * Math.exp(spread * z);
}

const AGENTS = [
  { id: 'a1000000-0000-4000-8000-000000000001', display_name: 'Maya Lindqvist', email: 'maya.lindqvist@example.com', weight: 22 },
  { id: 'a1000000-0000-4000-8000-000000000002', display_name: 'Jonas Weber', email: 'jonas.weber@example.com', weight: 18 },
  { id: 'a1000000-0000-4000-8000-000000000003', display_name: 'Priya Raman', email: 'priya.raman@example.com', weight: 15 },
  { id: 'a1000000-0000-4000-8000-000000000004', display_name: 'Tomás Herrera', email: 'tomas.herrera@example.com', weight: 12 },
  { id: 'a1000000-0000-4000-8000-000000000005', display_name: 'Elena Rossi', email: 'elena.rossi@example.com', weight: 10 },
  { id: 'a1000000-0000-4000-8000-000000000006', display_name: 'Sam Okafor', email: 'sam.okafor@example.com', weight: 8 },
  { id: 'a1000000-0000-4000-8000-000000000007', display_name: null, email: 'lea.martin@example.com', weight: 6 },
  { id: 'a1000000-0000-4000-8000-000000000008', display_name: 'Daniel Kim', email: 'daniel.kim@example.com', weight: 5 },
  { id: 'a1000000-0000-4000-8000-000000000009', display_name: 'Ava Brooks', email: 'ava.brooks@example.com', weight: 3 },
] as const;

const TEMPLATE_STEMS = [
  'Q3_Sales_Deck', 'Brochure_A4', 'Event_Poster_A2', 'Social_Story_1080x1920', 'Business_Card', 'Product_Flyer',
  'Annual_Report_2026', 'Email_Header', 'Rollup_Banner_850x2000', 'Letterhead', 'Menu_Card', 'Trade_Show_Booth',
  'Price_List', 'Recruiting_Ad', 'Newsletter_Spring', 'Case_Study_Onepager', 'Gift_Voucher', 'Store_Window_Decal',
];

interface IssueType {
  type: string;
  severity: Severity;
  category: string;
  label: string;
  message: string;
  /** Chance a completed run hits it, as a function of how many days ago the run was. */
  rate: (daysAgo: number) => number;
  identifiers?: readonly string[];
}

const FONTS = ['Helvetica Neue', 'Gotham', 'Proxima Nova', 'Futura PT', 'Avenir Next', 'Brandon Grotesque', 'Minion Pro'];
const PAR_STYLES = ['Body', 'Headline 1', 'Subhead', 'Caption', 'Legal', 'Bullet list', 'Quote'];
const CHAR_STYLES = ['Bold', 'Italic', 'Superscript', 'Link', 'Price'];
const IMAGES = ['hero.psd', 'logo.ai', 'background.tif', 'product-shot.jpg', 'pattern.eps', 'portrait.png'];

const help = 'http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates';
const ISSUES: IssueType[] = [
  { type: 'FONTS_INCLUDED', severity: 'error', category: 'fonts', label: 'Fonts Included', message: 'Package is missing fonts.', rate: () => 0.36, identifiers: FONTS },
  { type: 'OVERRIDE', severity: 'warning', category: 'text_boxes', label: 'Override', message: 'Overrides are not supported.', rate: (d) => 0.22 + 0.3 * (d / 365) },
  { type: 'PARAGRAPH_STYLE', severity: 'error', category: 'text_boxes', label: 'Paragraph Style', message: 'Text found missing paragraph styles.', rate: () => 0.27 },
  { type: 'HYPHENATION', severity: 'warning', category: 'par_styles', label: 'Hyphenation', message: 'Hyphenation is not supported.', rate: () => 0.24, identifiers: PAR_STYLES },
  { type: 'IMAGE_INCLUDED', severity: 'error', category: 'images', label: 'Images Included', message: 'Package missing image link.', rate: (d) => (d < 30 ? 0.2 : 0.13), identifiers: IMAGES },
  { type: 'KERNING', severity: 'error', category: 'par_styles', label: 'Kerning', message: "Kerning must be 'Metrics'", rate: () => 0.17, identifiers: PAR_STYLES },
  { type: 'COMPOSER', severity: 'warning', category: 'par_styles', label: 'Composer', message: "We recommend defining paragraph style composers as 'Adobe Single-line Composer', as browsers can render this composer.", rate: () => 0.15, identifiers: PAR_STYLES },
  { type: 'DOCUMENT_BLEED', severity: 'warning', category: 'general', label: 'Document Bleed', message: 'InDesign defined bleed is applied.', rate: () => 0.12 },
  { type: 'OTF_TTF_FONT', severity: 'error', category: 'fonts', label: 'OTF/TTF Font', message: 'Only OTF or TTF fonts are supported.', rate: () => 0.09, identifiers: ['Helvetica (Type 1)', 'Times (Type 1)', 'Univers 55 (PS)'] },
  { type: 'EMBEDDED_IMAGE', severity: 'error', category: 'images', label: 'Embedded Image', message: 'Embedded images are not supported.', rate: () => 0.08, identifiers: IMAGES },
  { type: 'KERNING_CHAR', severity: 'error', category: 'char_styles', label: 'Kerning', message: "Kerning must be 'Metrics'", rate: () => 0.06, identifiers: CHAR_STYLES },
  { type: 'LINKED_TEXT_FRAME', severity: 'error', category: 'text_boxes', label: 'Linked Text Frame', message: 'Linked (threaded) text frames are not supported.', rate: () => 0.05 },
  { type: 'TABLE', severity: 'error', category: 'text_boxes', label: 'Table', message: 'Tables are not supported', rate: () => 0.035 },
  { type: 'MASTERPAGE', severity: 'error', category: 'general', label: 'Masterpage', message: "Master Page can't be used.", rate: () => 0.03 },
  { type: 'FILL_TINT', severity: 'error', category: 'par_styles', label: 'Color Fill Tint (Beta)', message: 'Fill Tint must be 100. (This may be inaccurate, testing currently)', rate: (d) => (d < 12 ? 0.11 : 0), identifiers: PAR_STYLES },
  { type: 'LARGE_IMAGE', severity: 'info', category: 'images', label: 'Large Image', message: 'Image is large. Verify that this large of an image is needed.', rate: () => 0.19, identifiers: IMAGES },
  { type: 'EMPTY_TEXT_FRAME', severity: 'info', category: 'text_boxes', label: 'Empty Text Frames', message: 'Empty text frame found.', rate: () => 0.14 },
];
const ISSUE_BY_TYPE = new Map(ISSUES.map((i) => [i.type, i]));

interface SampleRun extends RunRow {
  t: number;
  validations: { type: string; identifier: string | null }[];
}

const REJECTIONS = [
  ['UNZIP_PACKAGE', 'File uploaded is not ZIP'],
  ['UNZIP_IDML', 'No IDML file found in the package.'],
  ['UNZIP_IDML', 'Multiple IDML files found in the package. Only one is allowed.'],
  ['PARSE_XML', 'The IDML file could not be read.'],
] as const;
const OLD_CRASHES = [
  ['PARSE_XML', "AttributeError: 'NoneType' object has no attribute 'get'"],
  ['IMAGES_INCLUDED_CHECK', 'FileNotFoundError: [Errno 2] No such file or directory: Links/hero.psd'],
  ['OVERRIDES_CHECK', 'IndexError: list index out of range'],
] as const;

function generate(now: number): SampleRun[] {
  const runs: SampleRun[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let daysAgo = 400; daysAgo >= 0; daysAgo--) {
    const day = new Date(today.getTime() - daysAgo * DAY);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const growth = 0.55 + 0.45 * (1 - daysAgo / 400);
    const expected = (weekend ? 2.5 : 19) * growth;
    const count = Math.max(0, Math.round(expected + (rand() - 0.5) * expected * 0.7));
    const version = daysAgo < 9 ? 'deployment-01JB7K' : daysAgo < 40 ? 'deployment-01J9QX' : 'deployment-01J6MA';

    for (let n = 0; n < count; n++) {
      const t = day.getTime() + (8 + rand() * 10) * 60 * 60 * 1000;
      if (t > now) continue;
      const agent = daysAgo > 380 && rand() < 0.5 ? null : weighted(AGENTS.map((a) => [a, a.weight] as const));
      const source: SourceType = weighted([['react-frontend', 70], ['extension', 22], ['api', 8]] as const);
      const crashRate = daysAgo < 9 ? 0.06 : 0.008;
      const r = rand();
      const status: RunStatus = r < crashRate ? 'failed' : r < crashRate + 0.035 ? 'rejected' : 'completed';
      const stem = pick(TEMPLATE_STEMS);
      const suffix = rand() < 0.4 ? `_v${1 + Math.floor(rand() * 4)}` : rand() < 0.15 ? '_FINAL' : '';
      const fileSize = Math.round(logNormal(18 * 1024 * 1024, 0.8));
      const run: SampleRun = {
        id: `00000000-0000-4000-8000-${String(runs.length).padStart(12, '0')}`,
        t,
        timestamp: new Date(t).toISOString(),
        template_name: status === 'rejected' && rand() < 0.3 ? `${stem}.pdf` : `${stem}${suffix}.zip`,
        source_type: source,
        status,
        stopped_at_stage: null,
        error_message: null,
        app_version: version,
        duration_ms: Math.round(logNormal(3200, 0.45) * (fileSize / (18 * 1024 * 1024)) ** 0.3),
        file_size_bytes: fileSize,
        total_errors: 0,
        total_warnings: 0,
        total_infos: 0,
        user_id: agent?.id ?? null,
        display_name: agent?.display_name ?? null,
        email: agent?.email ?? null,
        validations: [],
      };
      if (status === 'failed') {
        const [stage, message] =
          daysAgo < 9 && rand() < 0.8 ? (['PARSE_XML', "KeyError: 'Self'"] as const) : pick(OLD_CRASHES);
        run.stopped_at_stage = stage;
        run.error_message = message;
        run.duration_ms = Math.round(run.duration_ms * rand() * 0.6);
      } else if (status === 'rejected') {
        const [stage, message] = run.template_name.endsWith('.pdf') ? REJECTIONS[0] : pick(REJECTIONS.slice(1));
        run.stopped_at_stage = stage;
        run.error_message = message;
        run.duration_ms = Math.round(80 + rand() * 400);
        run.total_errors = 1;
      } else {
        for (const issue of ISSUES) {
          if (rand() >= issue.rate(daysAgo)) continue;
          const hits = 1 + Math.floor(logNormal(2, 0.8));
          for (let h = 0; h < hits; h++) {
            run.validations.push({ type: issue.type, identifier: issue.identifiers ? pick(issue.identifiers) : null });
            if (issue.severity === 'error') run.total_errors! += 1;
            else if (issue.severity === 'warning') run.total_warnings! += 1;
            else run.total_infos! += 1;
          }
        }
      }
      runs.push(run);
    }
  }
  return runs.sort((a, b) => b.t - a.t);
}

const NOW = Date.now();
const RUNS = generate(NOW);

/* ---------- Aggregation (mirrors the SQL functions) ---------- */

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Same window rules as analytics_period() in the backend: ?days=N, or ?start=&end= as whole local days. */
function periodFor(params: URLSearchParams) {
  const startParam = params.get('start');
  const endParam = params.get('end');
  let start: Date;
  let end: number;
  let days: number;
  if (startParam && endParam) {
    start = new Date(`${startParam}T00:00:00`);
    const endDay = new Date(`${endParam}T00:00:00`);
    endDay.setDate(endDay.getDate() + 1);
    end = Math.min(NOW, endDay.getTime());
    days = Math.round((endDay.getTime() - start.getTime()) / DAY);
  } else {
    days = Number(params.get('days') ?? 30);
    start = new Date(NOW);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    end = NOW;
  }
  const bucket: Bucket = days <= 90 ? 'day' : 'week';
  return { start: start.getTime(), end, prevStart: start.getTime() - (end - start.getTime()), bucket };
}

const inRange = (start: number, end: number) => RUNS.filter((r) => r.t >= start && r.t < end);

function stats(runs: SampleRun[]): PeriodStats {
  const completed = runs.filter((r) => r.status === 'completed');
  return {
    runs: runs.length,
    completed: completed.length,
    rejected: runs.filter((r) => r.status === 'rejected').length,
    failed: runs.filter((r) => r.status === 'failed').length,
    clean_runs: completed.filter((r) => r.total_errors === 0).length,
    active_users: new Set(runs.map((r) => r.user_id).filter(Boolean)).size,
    median_errors: percentile(completed.map((r) => r.total_errors!), 0.5),
    median_warnings: percentile(completed.map((r) => r.total_warnings!), 0.5),
    p50_duration_ms: percentile(completed.map((r) => r.duration_ms), 0.5),
    p95_duration_ms: percentile(completed.map((r) => r.duration_ms), 0.95),
    median_file_size_bytes: percentile(runs.map((r) => r.file_size_bytes), 0.5),
  };
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bucketKey(t: number, bucket: Bucket) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  if (bucket === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday, like Postgres date_trunc
  return ymd(d);
}

function bucketKeys(start: number, end: number, bucket: Bucket) {
  const keys: string[] = [];
  const d = new Date(bucketKey(start, bucket) + 'T00:00:00');
  while (d.getTime() < end) {
    keys.push(ymd(d));
    d.setDate(d.getDate() + (bucket === 'week' ? 7 : 1));
  }
  return keys;
}

function issueRunCounts(runs: SampleRun[]) {
  const map = new Map<string, { occurrences: number; runs: number }>();
  for (const run of runs) {
    if (run.status !== 'completed') continue;
    const seen = new Set<string>();
    for (const v of run.validations) {
      const entry = map.get(v.type) ?? { occurrences: 0, runs: 0 };
      entry.occurrences += 1;
      if (!seen.has(v.type)) {
        entry.runs += 1;
        seen.add(v.type);
      }
      map.set(v.type, entry);
    }
  }
  return map;
}

const FIRST_SEEN = new Map<string, number>();
for (const run of [...RUNS].reverse()) {
  if (run.status !== 'completed') continue;
  for (const v of run.validations) if (!FIRST_SEEN.has(v.type)) FIRST_SEEN.set(v.type, run.t);
}

function stripRun(run: SampleRun): RunRow {
  const { t, validations, ...row } = run;
  return row;
}

export function sampleOverview(params: URLSearchParams): Overview {
  const { start, end, prevStart, bucket } = periodFor(params);
  const current = inRange(start, end);
  const previous = inRange(prevStart, start);

  const byBucket = new Map<string, SampleRun[]>();
  for (const run of current) {
    const key = bucketKey(run.t, bucket);
    byBucket.set(key, [...(byBucket.get(key) ?? []), run]);
  }
  const timeseries = bucketKeys(start, end, bucket).map((date) => {
    const runs = byBucket.get(date) ?? [];
    const s = stats(runs);
    return {
      date,
      runs: s.runs,
      web: runs.filter((r) => r.source_type === 'react-frontend').length,
      extension: runs.filter((r) => r.source_type === 'extension').length,
      api: runs.filter((r) => r.source_type === 'api').length,
      completed: s.completed,
      rejected: s.rejected,
      failed: s.failed,
      clean_runs: s.clean_runs,
      active_users: s.active_users,
      p95_duration_ms: s.p95_duration_ms,
    };
  });

  const now = issueRunCounts(current);
  const before = issueRunCounts(previous);
  const issues = [...now.entries()]
    .map(([type, c]) => {
      const info = ISSUE_BY_TYPE.get(type)!;
      return {
        validation_type: type,
        severity: info.severity,
        category: info.category,
        occurrences: c.occurrences,
        runs_affected: c.runs,
        prev_runs_affected: before.get(type)?.runs ?? 0,
        first_seen_at: new Date(FIRST_SEEN.get(type)!).toISOString(),
        label: info.label,
        message: info.message,
        help_article: help,
      };
    })
    .sort((a, b) => b.runs_affected - a.runs_affected || b.occurrences - a.occurrences);

  const categories = new Map<string, { occurrences: number; runs: Set<string> }>();
  for (const run of current) {
    if (run.status !== 'completed') continue;
    for (const v of run.validations) {
      const category = ISSUE_BY_TYPE.get(v.type)!.category;
      const entry = categories.get(category) ?? { occurrences: 0, runs: new Set<string>() };
      entry.occurrences += 1;
      entry.runs.add(run.id);
      categories.set(category, entry);
    }
  }

  const users = new Map<string | null, SampleRun[]>();
  for (const run of current) users.set(run.user_id, [...(users.get(run.user_id) ?? []), run]);

  return {
    period: {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      previous_start: new Date(prevStart).toISOString(),
      bucket,
      tz: 'local',
    },
    data_since: RUNS.length ? RUNS[RUNS.length - 1].timestamp : null,
    current: stats(current),
    previous: stats(previous),
    timeseries,
    issues,
    categories: [...categories.entries()]
      .map(([category, c]) => ({ category, occurrences: c.occurrences, runs_affected: c.runs.size }))
      .sort((a, b) => b.runs_affected - a.runs_affected),
    users: [...users.entries()]
      .map(([userId, runs]) => ({
        user_id: userId,
        display_name: runs[0].display_name,
        email: runs[0].email,
        avatar_url: null,
        runs: runs.length,
        problem_runs: runs.filter((r) => r.status !== 'completed').length,
        last_run_at: runs[0].timestamp,
      }))
      .sort((a, b) => b.runs - a.runs),
    problem_runs: current.filter((r) => r.status !== 'completed').slice(0, 20).map(stripRun),
  };
}

export function sampleRuns(params: URLSearchParams): RunsPage {
  const { start, end } = periodFor(params);
  const status = params.get('status');
  const source = params.get('source');
  const userId = params.get('user_id');
  const q = params.get('q')?.toLowerCase();
  const type = params.get('validation_type');
  const limit = Number(params.get('limit') ?? 25);
  const offset = Number(params.get('offset') ?? 0);
  const matched = inRange(start, end).filter(
    (r) =>
      (!status || r.status === status) &&
      (!source || r.source_type === source) &&
      (!userId || r.user_id === userId) &&
      (!q || r.template_name.toLowerCase().includes(q)) &&
      (!type || r.validations.some((v) => v.type === type))
  );
  return { total: matched.length, runs: matched.slice(offset, offset + limit).map(stripRun) };
}

export function sampleIssueDetail(type: string, params: URLSearchParams): IssueDetail {
  const { start, end, bucket } = periodFor(params);
  const completed = inRange(start, end).filter((r) => r.status === 'completed');
  const hits = completed.filter((r) => r.validations.some((v) => v.type === type));
  const info = ISSUE_BY_TYPE.get(type);

  const perBucket = new Map<string, { completed: number; runs_affected: number }>();
  for (const run of completed) {
    const key = bucketKey(run.t, bucket);
    const entry = perBucket.get(key) ?? { completed: 0, runs_affected: 0 };
    entry.completed += 1;
    if (run.validations.some((v) => v.type === type)) entry.runs_affected += 1;
    perBucket.set(key, entry);
  }

  const identifiers = new Map<string, { occurrences: number; runs: Set<string> }>();
  for (const run of hits) {
    for (const v of run.validations) {
      if (v.type !== type || !v.identifier) continue;
      const entry = identifiers.get(v.identifier) ?? { occurrences: 0, runs: new Set<string>() };
      entry.occurrences += 1;
      entry.runs.add(run.id);
      identifiers.set(v.identifier, entry);
    }
  }

  return {
    validation_type: type,
    label: info?.label ?? type,
    message: info?.message ?? null,
    help_article: help,
    occurrences: hits.reduce((a, r) => a + r.validations.filter((v) => v.type === type).length, 0),
    runs_affected: hits.length,
    completed_runs: completed.length,
    timeseries: bucketKeys(start, end, bucket).map((date) => ({ date, completed: 0, runs_affected: 0, ...perBucket.get(date) })),
    identifiers: [...identifiers.entries()]
      .map(([identifier, c]) => ({ identifier, occurrences: c.occurrences, runs_affected: c.runs.size }))
      .sort((a, b) => b.runs_affected - a.runs_affected || b.occurrences - a.occurrences)
      .slice(0, 25),
  };
}

const CSV_COLUMNS: [keyof RunRow, string][] = [
  ['timestamp', 'Time (UTC)'],
  ['template_name', 'Template'],
  ['status', 'Result'],
  ['source_type', 'Source'],
  ['display_name', 'Agent'],
  ['email', 'Agent email'],
  ['total_errors', 'Errors'],
  ['total_warnings', 'Warnings'],
  ['total_infos', 'Infos'],
  ['duration_ms', 'Duration (ms)'],
  ['file_size_bytes', 'File size (bytes)'],
  ['stopped_at_stage', 'Stopped at'],
  ['error_message', 'Error'],
  ['app_version', 'App version'],
  ['id', 'Run ID'],
];

/** Mirrors /analytics/runs.csv (export_runs_csv in the backend). */
export function sampleRunsCsv(params: URLSearchParams): { csv: string; total: number; exported: number } {
  const all = new URLSearchParams(params);
  all.set('limit', '10000');
  all.set('offset', '0');
  const { total, runs } = sampleRuns(all);
  const cell = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.map(([, label]) => label).join(',')];
  for (const run of runs) lines.push(CSV_COLUMNS.map(([key]) => cell(run[key])).join(','));
  return { csv: lines.join('\r\n') + '\r\n', total, exported: runs.length };
}
