import type { Bounds, Check, CheckResult, Issue, Results, ValidationType } from '../../types';

/**
 * The report: a checker result (results v2) grouped into problems, one per check, each listing what to fix and
 * where. The customer summary groups them the same way (python_backend/app/customer_summary/report.py), so a summary
 * section and its problem share an id, e.g. `errors:KERNING`.
 */

export const SEVERITIES: ValidationType[] = ['errors', 'warnings', 'infos'];

/** Severity in results v2 -> how the report groups it. */
const SEVERITY_LIST: Record<Issue['severity'], ValidationType> = { error: 'errors', warning: 'warnings', info: 'infos' };

/** What each severity means, as the support team uses them. */
export const SEVERITY_INFO: Record<ValidationType, { title: string; description: string }> = {
  errors: {
    title: 'Blockers',
    description: 'Breaks the template, or will very likely make it look different.',
  },
  warnings: {
    title: 'Warnings',
    description: 'May make the template look different than expected.',
  },
  infos: {
    title: 'Infos',
    description: 'A heads up. Worth a check, but often fine.',
  },
};

/**
 * What a problem's places are grouped by: fixing one paragraph style fixes every frame that uses it, while a frame
 * problem has to be fixed frame by frame.
 */
export type SubjectKind = 'paragraph-style' | 'character-style' | 'font' | 'image' | 'frame' | 'document';

type IssueKind = Issue['subject']['kind'];

const GROUPED_AS: Record<IssueKind, SubjectKind> = {
  paragraph_style: 'paragraph-style',
  character_style: 'character-style',
  font: 'font',
  image: 'image',
  image_frame: 'image',
  text_frame: 'frame',
  page_item: 'frame',
  document: 'document',
};
const TEXT_KINDS: IssueKind[] = ['text_frame', 'paragraph_style', 'character_style'];
const IMAGE_KINDS: IssueKind[] = ['image', 'image_frame'];

/** When a problem's places are of several kinds whose fix differs, each kind's steps start with what they're for. */
const FIX_LEADS: Record<IssueKind, string> = {
  text_frame: 'Text frames',
  image: 'Images',
  image_frame: 'Image frames',
  page_item: 'Other items',
  paragraph_style: 'Paragraph styles',
  character_style: 'Character styles',
  font: 'Fonts',
  document: 'Document',
};
/** An object style is applied to the image's frame, so its steps are for image frames. */
const FIX_LEAD_OF: Record<string, string> = { 'OBJECT_STYLE:image': 'Image frames' };

/** What goes wrong in Frontify and how to fix it in InDesign, for one check. */
export type CheckGuide = {
  /** Short plain-language name of the problem. */
  title: string;
  /** What goes wrong in Frontify, in a sentence or two. */
  why: string;
  /** How the template author fixes it in InDesign. */
  fix: string[];
};

/** One occurrence of a problem: usually a frame on a page. */
export type Place = {
  key: string;
  issue: Issue;
  bounds?: Bounds;
  pageName?: string;
  /** Text inside the frame, when it has any. */
  frameText?: string;
  frameLabel: string;
  context: string;
  facts: Issue['facts'];
};

/** What to fix: a style, font, image file, frame, or the document itself. */
export type Subject = {
  key: string;
  kind: SubjectKind;
  name: string | null;
  label: string;
  places: Place[];
};

export type Problem = {
  id: string;
  key: string;
  severity: ValidationType;
  guide: CheckGuide;
  helpArticle: string | null;
  subjects: Subject[];
  placeCount: number;
  /** Page names the problem appears on, in document order. */
  pageNames: string[];
};

export type Report = {
  problems: Problem[];
  problemCounts: Record<ValidationType, number>;
  placeCounts: Record<ValidationType, number>;
  /** Checks that found nothing, with their plain-language copy. */
  passedChecks: (Check & { guide: CheckGuide })[];
  /** How many of each thing were checked, e.g. 14 paragraph styles. */
  checked: { label: string; count: number }[];
};

/** What was checked, in the singular (an s is added for more than one). */
const CHECKED_LABELS: [keyof Results['subjects_checked'], string][] = [
  ['paragraph_style', 'paragraph style'],
  ['character_style', 'character style'],
  ['text_frame', 'text frame'],
  ['font', 'font'],
  ['image', 'image'],
];

const SUBJECT_LABELS: Record<SubjectKind, string> = {
  'paragraph-style': 'Paragraph style',
  'character-style': 'Character style',
  font: 'Font',
  image: 'Image',
  frame: 'Frame',
  document: 'Document',
};

const clean = (text: string | undefined | null) => text?.replace(/\s+/g, ' ').trim() || undefined;

function frameLabel(bounds: Bounds | undefined, kind: IssueKind): string {
  if (bounds?.kind === 'TextFrame' || TEXT_KINDS.includes(kind)) return 'Text frame';
  if (bounds?.kind === 'Group') return 'Group';
  if (IMAGE_KINDS.includes(kind)) return 'Image frame';
  if (bounds?.kind === 'GraphicLine') return 'Line';
  return 'Frame';
}

function frameText(issue: Issue, results: Results): string | undefined {
  const { subject } = issue;
  const box = subject.kind === 'text_frame' && subject.id ? results.text_boxes[subject.id] : undefined;
  return clean(box?.content) ?? clean(issue.text?.find((t) => t.trim()));
}

function subjectFor(kind: SubjectKind, place: Place): { key: string; name: string | null; label: string } {
  const { subject, location } = place.issue;
  switch (kind) {
    case 'paragraph-style':
    case 'character-style':
    case 'font':
    case 'image':
      if (subject.name) return { key: `${kind}:${subject.name}`, name: subject.name, label: `${SUBJECT_LABELS[kind]} “${subject.name}”` };
      break;
    case 'document':
      if (!place.bounds) return { key: 'document', name: null, label: 'Document' };
      break;
  }
  // Frame-level: each frame is its own thing to fix.
  const id = location.item_id ?? `${subject.id}:${location.page_id}`;
  const label = place.frameText ? `${place.frameLabel} “${place.frameText}”` : place.frameLabel;
  return { key: `frame:${id}`, name: place.frameText ?? null, label };
}

/** The check's wording; when its places are of several kinds with different steps, each kind's steps, led by what
 * they're for. A check the result doesn't list (a checker that no longer has it) is named by its key. */
function guideFor(check: Check | undefined, key: string, kinds: IssueKind[]): CheckGuide {
  if (!check) return { title: key, why: '', fix: [] };
  const present = check.subject_kinds.filter((kind) => kinds.includes(kind) && check.fix[kind]);
  const steps = present.map((kind) => check.fix[kind]);
  const distinct = new Set(steps.map((s) => JSON.stringify(s)));
  if (distinct.size <= 1) return { title: check.title, why: check.why, fix: steps[0] ?? [] };
  return {
    title: check.title,
    why: check.why,
    fix: present.flatMap((kind, k) =>
      steps[k].map((step, i) => (i === 0 ? `${FIX_LEAD_OF[`${check.key}:${kind}`] ?? FIX_LEADS[kind]}: ${step}` : step))
    ),
  };
}

export function buildReport({ results }: CheckResult): Report {
  const pageIndex = new Map(results.pages.map((page) => [page.id, page]));
  const checks = new Map<string, Check>(results.checks.map((check) => [check.key, check]));
  const problems = new Map<string, Problem>();
  const kinds = new Map<string, IssueKind[]>();

  results.issues.forEach((issue, index) => {
    const severity = SEVERITY_LIST[issue.severity];
    const id = `${severity}:${issue.check}`;
    let problem = problems.get(id);
    if (!problem) {
      problem = {
        id,
        key: issue.check,
        severity,
        guide: { title: issue.check, why: '', fix: [] },
        helpArticle: checks.get(issue.check)?.help_article ?? null,
        subjects: [],
        placeCount: 0,
        pageNames: [],
      };
      problems.set(id, problem);
      kinds.set(id, []);
    }
    kinds.get(id)!.push(issue.subject.kind);

    const { location } = issue;
    const bounds = location.bounds && pageIndex.has(location.bounds.page_id) ? location.bounds : undefined;
    const pageId = bounds?.page_id ?? location.page_id;
    const place: Place = {
      key: `${id}:${index}`,
      issue,
      bounds,
      pageName: pageId ? pageIndex.get(pageId)?.name || location.page_name || undefined : undefined,
      frameText: frameText(issue, results),
      frameLabel: frameLabel(bounds, issue.subject.kind),
      context: issue.detail ?? '',
      facts: issue.facts,
    };

    const kind = GROUPED_AS[issue.subject.kind] ?? 'document';
    const subjectInfo = subjectFor(kind, place);
    let subject = problem.subjects.find((s) => s.key === subjectInfo.key);
    if (!subject) {
      subject = { ...subjectInfo, kind: subjectInfo.key.startsWith('frame:') ? 'frame' : kind, places: [] };
      problem.subjects.push(subject);
    }
    subject.places.push(place);
    problem.placeCount += 1;
  });
  problems.forEach((problem, id) => {
    problem.guide = guideFor(checks.get(problem.key), problem.key, kinds.get(id)!);
  });

  const pageOrder = (name: string) => {
    const index = Array.from(pageIndex.values()).find((page) => page.name === name)?.index;
    return index ?? (Number.isFinite(Number(name)) ? Number(name) : Infinity);
  };

  const placeOrder = (place: Place) =>
    pageIndex.get(place.bounds?.page_id ?? place.issue.location.page_id ?? '')?.index ?? Infinity;
  problems.forEach((problem) => {
    problem.subjects.forEach((subject) =>
      subject.places.sort(
        (a, b) =>
          placeOrder(a) - placeOrder(b) ||
          (a.bounds?.y ?? 0) - (b.bounds?.y ?? 0) ||
          (a.bounds?.x ?? 0) - (b.bounds?.x ?? 0)
      )
    );
    problem.subjects.sort(
      (a, b) =>
        b.places.length - a.places.length ||
        placeOrder(a.places[0]) - placeOrder(b.places[0]) ||
        (a.places[0].bounds?.y ?? 0) - (b.places[0].bounds?.y ?? 0) ||
        a.label.localeCompare(b.label)
    );
    const names = new Set<string>();
    problem.subjects.forEach((s) => s.places.forEach((p) => p.pageName && names.add(p.pageName)));
    problem.pageNames = Array.from(names).sort((a, b) => pageOrder(a) - pageOrder(b));
  });

  const sorted = Array.from(problems.values()).sort(
    (a, b) =>
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
      b.placeCount - a.placeCount ||
      a.guide.title.localeCompare(b.guide.title)
  );

  const problemCounts = { errors: 0, warnings: 0, infos: 0 };
  const placeCounts = { errors: 0, warnings: 0, infos: 0 };
  sorted.forEach((problem) => {
    problemCounts[problem.severity] += 1;
    placeCounts[problem.severity] += problem.placeCount;
  });

  const checked = CHECKED_LABELS.flatMap(([kind, label]) => {
    const count = results.subjects_checked[kind] ?? 0;
    return count > 0 ? [{ label: count === 1 ? label : `${label}s`, count }] : [];
  });

  return {
    problems: sorted,
    problemCounts,
    placeCounts,
    passedChecks: results.checks
      .filter((check) => check.is_check && !problems.has(`${SEVERITY_LIST[check.severity]}:${check.key}`))
      .map((check) => ({ ...check, guide: guideFor(check, check.key, check.subject_kinds) })),
    checked,
  };
}

/** Joins page names into a short range like "1–3, 5". */
export function formatPages(names: string[]): string {
  if (names.length === 0) return '';
  const numbers = names.map(Number);
  if (numbers.some((n) => !Number.isInteger(n))) return names.join(', ');
  const ranges: string[] = [];
  let start = numbers[0];
  let prev = numbers[0];
  numbers.slice(1).concat(NaN).forEach((n) => {
    if (n === prev + 1) {
      prev = n;
      return;
    }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = n;
  });
  return ranges.join(', ');
}

/** One-line summary of where a problem is, e.g. "2 paragraph styles" or "3 text frames, pages 1–3". */
export function describeWhere(problem: Problem): string {
  const kinds = new Set(problem.subjects.map((s) => s.kind));
  const pages = problem.pageNames.length
    ? `${problem.pageNames.length === 1 ? 'page' : 'pages'} ${formatPages(problem.pageNames)}`
    : '';
  if (kinds.size === 1) {
    const kind = problem.subjects[0].kind;
    const n = problem.subjects.length;
    const plural = (word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    switch (kind) {
      case 'paragraph-style':
        return plural('paragraph style');
      case 'character-style':
        return plural('character style');
      case 'font':
        return n === 1 ? `Font “${problem.subjects[0].name}”` : plural('font');
      case 'image':
        return n === 1 ? `Image “${problem.subjects[0].name}”` : plural('image');
      case 'document':
        return 'Whole document';
      case 'frame': {
        const labels = new Set(problem.subjects.map((s) => s.places[0].frameLabel.toLowerCase()));
        const word = labels.size === 1 ? Array.from(labels)[0] : 'frame';
        return [plural(word), pages].filter(Boolean).join(', ');
      }
    }
  }
  return [`${problem.placeCount} places`, pages].filter(Boolean).join(', ');
}

// ------------------------------------------------------------------ Comparison with the previous upload

export type ProblemChange = {
  id: string;
  title: string;
  severity: ValidationType;
  before: number;
  after: number;
  fixedSubjects: string[];
  newSubjects: string[];
};

export type ReportComparison = {
  fixed: ProblemChange[];
  added: ProblemChange[];
  better: ProblemChange[];
  worse: ProblemChange[];
  unchanged: number;
  byId: Record<string, ProblemChange & { status: 'new' | 'better' | 'worse' | 'same' }>;
};

export function compareReports(previous: Report, current: Report): ReportComparison {
  const prevById = new Map(previous.problems.map((p) => [p.id, p]));
  const curById = new Map(current.problems.map((p) => [p.id, p]));
  const comparison: ReportComparison = { fixed: [], added: [], better: [], worse: [], unchanged: 0, byId: {} };

  const change = (before: Problem | undefined, after: Problem | undefined): ProblemChange => {
    const beforeSubjects = new Map((before?.subjects ?? []).map((s) => [s.key, s.label]));
    const afterSubjects = new Map((after?.subjects ?? []).map((s) => [s.key, s.label]));
    const problem = (after ?? before)!;
    return {
      id: problem.id,
      title: problem.guide.title,
      severity: problem.severity,
      before: before?.placeCount ?? 0,
      after: after?.placeCount ?? 0,
      fixedSubjects: Array.from(beforeSubjects).filter(([key]) => !afterSubjects.has(key)).map(([, label]) => label),
      newSubjects: Array.from(afterSubjects).filter(([key]) => !beforeSubjects.has(key)).map(([, label]) => label),
    };
  };

  previous.problems.forEach((before) => {
    if (!curById.has(before.id)) comparison.fixed.push(change(before, undefined));
  });
  current.problems.forEach((after) => {
    const before = prevById.get(after.id);
    const diff = change(before, after);
    if (!before) {
      comparison.added.push(diff);
      comparison.byId[after.id] = { ...diff, status: 'new' };
    } else if (diff.after < diff.before) {
      comparison.better.push(diff);
      comparison.byId[after.id] = { ...diff, status: 'better' };
    } else if (diff.after > diff.before || diff.newSubjects.length) {
      comparison.worse.push(diff);
      comparison.byId[after.id] = { ...diff, status: 'worse' };
    } else {
      comparison.unchanged += 1;
      comparison.byId[after.id] = { ...diff, status: 'same' };
    }
  });
  return comparison;
}
