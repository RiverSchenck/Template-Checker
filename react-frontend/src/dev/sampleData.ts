/**
 * Dev-only: a year of synthetic checker runs, and the same aggregations the SQL functions in
 * python_backend/migrations/007_analytics_v2.sql perform, so the analytics page can be previewed (filters,
 * drill-downs and all) without a backend. Everything is seeded, so the data is the same on every load.
 *
 * Built in a few deliberate stories worth spotting on the page:
 *  - usage grows through the year; weekends are quiet
 *  - a deploy 9 days ago causes a run of PARSE_XML crashes
 *  - the text color tint check (FILL_TINT) is new: it started firing 12 days ago
 *  - overrides are trending down, missing fonts are steady
 */
import type { Check, CheckResult } from '../types';
import flyer from '../fixtures/flyer-sales.json';
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
import type { AdminFeedback, SummaryComment } from '../components/SummaryFeedback/api';

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
  /** Chance a completed run hits it, as a function of how many days ago the run was. */
  rate: (daysAgo: number) => number;
  identifiers?: readonly string[];
}

/** The catalogue (every check's wording), as results list it. */
const CHECKS = new Map<string, Check>(
  (flyer as unknown as CheckResult).results.checks.map((check) => [check.key, check])
);

const FONTS = ['Helvetica Neue', 'Gotham', 'Proxima Nova', 'Futura PT', 'Avenir Next', 'Brandon Grotesque', 'Minion Pro'];
const PAR_STYLES = ['Body', 'Headline 1', 'Subhead', 'Caption', 'Legal', 'Bullet list', 'Quote'];
const CHAR_STYLES = ['Bold', 'Italic', 'Superscript', 'Link', 'Price'];
const IMAGES = ['hero.psd', 'logo.ai', 'background.tif', 'product-shot.jpg', 'pattern.eps', 'portrait.png'];

const ISSUES: IssueType[] = [
  { type: 'FONTS_INCLUDED', rate: () => 0.36, identifiers: FONTS },
  { type: 'OVERRIDE', rate: (d) => 0.22 + 0.3 * (d / 365) },
  { type: 'PARAGRAPH_STYLE', rate: () => 0.27 },
  { type: 'HYPHENATION', rate: () => 0.24, identifiers: PAR_STYLES },
  { type: 'IMAGE_INCLUDED', rate: (d) => (d < 30 ? 0.2 : 0.13), identifiers: IMAGES },
  { type: 'KERNING', rate: () => 0.17, identifiers: PAR_STYLES },
  { type: 'COMPOSER', rate: () => 0.15, identifiers: PAR_STYLES },
  { type: 'DOCUMENT_BLEED', rate: () => 0.12 },
  { type: 'OTF_TTF_FONT', rate: () => 0.09, identifiers: ['Helvetica (Type 1)', 'Times (Type 1)', 'Univers 55 (PS)'] },
  { type: 'EMBEDDED_IMAGE', rate: () => 0.08, identifiers: IMAGES },
  { type: 'KERNING_CHAR', rate: () => 0.06, identifiers: CHAR_STYLES },
  { type: 'LINKED_TEXT_FRAME', rate: () => 0.05 },
  { type: 'TABLE', rate: () => 0.035 },
  { type: 'MASTERPAGE', rate: () => 0.03 },
  { type: 'FILL_TINT', rate: (d) => (d < 12 ? 0.11 : 0), identifiers: PAR_STYLES },
  { type: 'LARGE_IMAGE', rate: () => 0.19, identifiers: IMAGES },
  { type: 'EMPTY_TEXT_FRAME', rate: () => 0.14 },
];
const ISSUE_BY_TYPE = new Map(ISSUES.map((i) => [i.type, { ...i, ...describe(i.type) }]));

/** Severity, category and wording of a check, as the backend describes it (app/analytics_api.describe_issue). */
function describe(type: string) {
  const check = CHECKS.get(type)!;
  return {
    severity: check.severity as Severity,
    category: check.subject_kinds[0],
    label: check.title,
    message: check.why,
    help_article: check.help_article,
  };
}

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
        for (const issue of ISSUE_BY_TYPE.values()) {
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
        help_article: info.help_article,
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
    help_article: info?.help_article ?? null,
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

/* ---------- Customer summary feedback ---------- */


/** The sample-mode admin; comments by them show up on "Your feedback". */
export const SAMPLE_ADMIN_ID = 'a1000000-0000-4000-8000-000000000000';
const SAMPLE_ADMIN = { id: SAMPLE_ADMIN_ID, display_name: 'Sample Admin', email: 'admin@example.com' };

/** Summary sections as review mode lays them out: [section_key, section_title, text]. */
type Section = readonly [string, string, string];

const FONT_MISSING: Section = [
  'FONTS_INCLUDED',
  'Font missing from the package',
  '1. Font missing from the package\n   Where: “Brand Sans Bold” (used on pages 1–3)\n   – Make sure the font is installed or activated on your computer.\n   – Package the document again with File > Package, keeping "Copy Fonts" checked.\n   More info: https://help.frontify.com/en/articles/fonts-in-templates',
];
const NO_PAR_STYLE: Section = [
  'TEXT_FRAME_PAR_STYLE',
  'Text frame has no paragraph style',
  '2. Text frame has no paragraph style\n   Where: the text frame “Headline” on page 1, the text frame “Body copy” on pages 1, 2\n   – Select the text frame.\n   – Apply a paragraph style from Window > Styles > Paragraph Styles (not [Basic Paragraph] or [No Paragraph Style]).',
];
const MASTER_ITEMS: Section = [
  'MASTER_PAGE_ITEMS',
  'Items on a master page',
  '1. Items on a master page\n   Where: A-Parent\n   – Open the Pages panel and select the master (parent) page that has items on it.\n   – Move those items onto the document pages, or delete them from the master page.',
];
const LINK_MISSING: Section = [
  'LINKS_INCLUDED',
  'Linked image missing from the package',
  '1. Linked image missing from the package\n   Where: hero_visual.psd on page 1\n   – Open Window > Links and relink any missing images.\n   – Package the document again with File > Package, keeping "Copy Linked Graphics" checked.',
];
const VARIABLE_FONT: Section = [
  'VARIABLE_FONT',
  'Variable font used',
  '1. Variable font used\n   Where: “Inter Variable” (used on page 1)\n   – Install the static (individual weight) version of the font.\n   – Replace the variable font in the document (Type > Find/Replace Font) and package it again.',
];
const FLIPPED: Section = [
  'IMAGE_FLIPPED',
  'Image is flipped or skewed',
  '1. Image is flipped or skewed\n   Where: the image frame “Product shot” on page 2\n   – Select the image and reset its transformation (Object > Transform > Clear Transformations).',
];
const CLOSING: Section = [
  'closing',
  'Closing',
  'After making changes, package the document again with File > Package and upload the new ZIP to Frontify.',
];

const introFor = (name: string, n: number): Section => [
  'intro',
  'Introduction',
  `We checked “${name}” and found ${n === 1 ? 'one thing' : `${n} things`} in the InDesign file that are likely causing the issues. These can stop a template from working in Frontify, or make it look different:`,
];

type Author = { id: string; display_name: string | null; email: string };
type SampleComment = {
  /** 'intro' is the review's own introduction; 'general' is a general comment. */
  section: Section | 'intro' | 'general';
  body: string;
  quote?: string;
  hoursAgo: number;
  resolvedHoursAgo?: number;
};
type SampleReview = { template: string; author: Author; hoursAgo: number; sections: Section[]; comments: SampleComment[] };

const LOOKS_GOOD = 'Looks good to send.';
const [maya, jonas, priya, tomas, elena, sam, lea] = AGENTS;

const REVIEWS: SampleReview[] = [
  {
    template: 'Rollup_Banner_850x2000.zip',
    author: maya,
    hoursAgo: 2,
    sections: [FONT_MISSING, NO_PAR_STYLE],
    comments: [
      { section: FONT_MISSING, quote: 'keeping "Copy Fonts" checked', body: 'The customer is on InDesign 2025, where this option is called "Copy Fonts (Except activated from Adobe Fonts)". Worth matching the wording.', hoursAgo: 2 },
      { section: NO_PAR_STYLE, body: 'Lists every frame. With 14 frames this got very long; could we cap it and say "and 10 more"?', hoursAgo: 2 },
    ],
  },
  {
    template: 'Q3_Sales_Deck.zip',
    author: jonas,
    hoursAgo: 5,
    sections: [MASTER_ITEMS],
    comments: [{ section: 'general', body: LOOKS_GOOD, hoursAgo: 5 }],
  },
  {
    template: 'Event_Poster_A2.zip',
    author: priya,
    hoursAgo: 20,
    sections: [LINK_MISSING],
    comments: [
      { section: LINK_MISSING, quote: 'hero_visual.psd', body: 'Customer asked whether PSDs are supported at all. The summary should say they are, the link just needs to be in the package.', hoursAgo: 20 },
      { section: 'intro', quote: 'likely causing the issues', body: 'Customer never said they had issues; they asked for a check before launch. "likely causing the issues" sounds like we assume something broke.', hoursAgo: 20 },
    ],
  },
  {
    template: 'Brochure_A4.zip',
    author: SAMPLE_ADMIN,
    hoursAgo: 26,
    sections: [FONT_MISSING, NO_PAR_STYLE],
    comments: [
      { section: NO_PAR_STYLE, quote: 'not [Basic Paragraph] or [No Paragraph Style]', body: 'Good that this is spelled out. Customers kept applying Basic Paragraph before.', hoursAgo: 26, resolvedHoursAgo: 4 },
      { section: 'general', body: 'Would be nice to have a short German version for DACH customers.', hoursAgo: 26 },
    ],
  },
  {
    template: 'Social_Story_1080x1920.zip',
    author: tomas,
    hoursAgo: 30,
    sections: [VARIABLE_FONT],
    comments: [{ section: 'general', body: LOOKS_GOOD, hoursAgo: 30 }],
  },
  {
    template: 'Business_Card.zip',
    author: elena,
    hoursAgo: 52,
    sections: [FONT_MISSING],
    comments: [
      { section: FONT_MISSING, quote: 'installed or activated on your computer', body: 'They use a font manager (Extensis). Maybe mention that the font has to be active when packaging?', hoursAgo: 52, resolvedHoursAgo: 30 },
      { section: CLOSING, body: 'Closing line could link to the upload help article.', hoursAgo: 52 },
    ],
  },
  {
    template: 'Product_Flyer.zip',
    author: sam,
    hoursAgo: 75,
    sections: [FLIPPED],
    comments: [
      { section: FLIPPED, quote: 'Object > Transform > Clear Transformations', body: 'This also resets the crop, which the customer didn\'t want. We should warn about that.', hoursAgo: 75 },
      { section: 'general', body: LOOKS_GOOD, hoursAgo: 75, resolvedHoursAgo: 50 },
    ],
  },
  {
    template: 'Annual_Report_2026.zip',
    author: SAMPLE_ADMIN,
    hoursAgo: 98,
    sections: [MASTER_ITEMS, LINK_MISSING],
    comments: [
      { section: MASTER_ITEMS, quote: 'A-Parent', body: 'Customers don\'t know what A-Parent means. Say "the master page called A-Parent".', hoursAgo: 98 },
      { section: 'general', body: LOOKS_GOOD, hoursAgo: 98 },
    ],
  },
  {
    template: 'Menu_Card.zip',
    author: lea,
    hoursAgo: 140,
    sections: [NO_PAR_STYLE],
    comments: [
      { section: NO_PAR_STYLE, body: 'Fine, but the numbering starts at 2 because there was only one issue in this group.', hoursAgo: 140, resolvedHoursAgo: 120 },
    ],
  },
  {
    template: 'Letterhead.zip',
    author: maya,
    hoursAgo: 170,
    sections: [FONT_MISSING],
    comments: [{ section: 'general', body: LOOKS_GOOD, hoursAgo: 170 }],
  },
  {
    template: 'Price_List.zip',
    author: jonas,
    hoursAgo: 220,
    sections: [VARIABLE_FONT],
    comments: [
      { section: VARIABLE_FONT, quote: 'static (individual weight) version', body: 'Customer asked where to get the static version. Link to Google Fonts for open-source fonts?', hoursAgo: 220 },
      { section: 'general', body: LOOKS_GOOD, hoursAgo: 220, resolvedHoursAgo: 200 },
    ],
  },
  {
    template: 'Recruiting_Ad.zip',
    author: SAMPLE_ADMIN,
    hoursAgo: 300,
    sections: [FLIPPED],
    comments: [{ section: 'general', body: LOOKS_GOOD, hoursAgo: 300, resolvedHoursAgo: 280 }],
  },
];

function buildFeedback(): (SummaryComment & { user_id: string })[] {
  const now = Date.now();
  const iso = (hoursAgo: number) => new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();
  const out: (SummaryComment & { user_id: string })[] = [];
  REVIEWS.forEach((review, r) => {
    // Number the issues in the order this summary lists them, as the real summary does.
    const issues = review.sections.map(([key, title, text], i): Section => [key, title, text.replace(/^\d+\./, `${i + 1}.`)]);
    const sections = [introFor(review.template.replace(/\.zip$/, ''), issues.length), ...issues, CLOSING];
    const summary = sections.map(([, , text]) => text).join('\n\n');
    review.comments.forEach((c, i) => {
      const section = c.section === 'intro' ? sections[0] : c.section === 'general' ? 'general' : issues[review.sections.indexOf(c.section)] ?? c.section;
      const [key, title, text] = section === 'general' ? (['general', 'General feedback', ''] as const) : section;
      // Offsets within the whole summary, as review mode records them.
      const sectionStart = section === 'general' ? 0 : summary.indexOf(text);
      const at = c.quote ? summary.indexOf(c.quote, sectionStart) : -1;
      out.push({
        id: `5f000000-0000-4000-8000-${String(r * 10 + i).padStart(12, '0')}`,
        review_id: `5e000000-0000-4000-8000-${String(r).padStart(12, '0')}`,
        section_key: key,
        section_title: title,
        quote: c.quote ?? null,
        quote_start: at >= 0 ? at : null,
        quote_end: at >= 0 ? at + c.quote!.length : null,
        body: c.body,
        created_at: iso(c.hoursAgo),
        resolved_at: c.resolvedHoursAgo != null ? iso(c.resolvedHoursAgo) : null,
        template_name: review.template,
        summary,
        reviewed_at: iso(review.hoursAgo),
        user_id: review.author.id,
        user_email: review.author.email,
        user_display_name: review.author.display_name,
      });
    });
  });
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** In memory, so resolving in sample mode sticks until the page reloads. */
const summaryFeedback = buildFeedback();

export function sampleAdminSummaryFeedback(params: URLSearchParams): AdminFeedback {
  const status = params.get('status') ?? 'open';
  return {
    // A few older reviews from before a comment was required.
    stats: { reviews: REVIEWS.length + 3, with_feedback: REVIEWS.length, no_feedback: 3 },
    comments: summaryFeedback.filter((c) =>
      status === 'open' ? !c.resolved_at : status === 'resolved' ? !!c.resolved_at : true
    ),
  };
}

/** The caller's own comments, without author fields, as /summary-reviews/mine returns them. */
export function sampleMySummaryFeedback(userId: string): SummaryComment[] {
  return summaryFeedback
    .filter((c) => c.user_id === userId)
    .map(({ user_id, user_email, user_display_name, ...c }) => c);
}

/** PATCH /admin/summary-feedback/<id>. Like the API, the response has no author or review fields. */
export function sampleResolveSummaryComment(id: string, resolved: boolean): SummaryComment | null {
  const c = summaryFeedback.find((x) => x.id === id);
  if (!c) return null;
  c.resolved_at = resolved ? new Date().toISOString() : null;
  const { user_id, user_email, user_display_name, template_name, summary, reviewed_at, ...rest } = c;
  return { ...rest, template_name: null, summary: null, reviewed_at: null };
}
