import {
  CategoryDetail,
  CheckDefinition,
  ContextDetails,
  PageBounds,
  PageLayout,
  ValidationCategory,
  ValidationItem,
  ValidationResult,
  ValidationType,
} from '../../types';
import { getCheckGuide, type CheckGuide, type SubjectKind } from './checkGuide';

export const SEVERITIES: ValidationType[] = ['errors', 'warnings', 'infos'];

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

const CATEGORY_KEYS = ['par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general'] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

/** One occurrence of a problem: usually a frame on a page. */
export type Place = {
  key: string;
  item: ValidationItem;
  category: CategoryKey;
  bounds?: PageBounds;
  pageName?: string;
  /** Text inside the frame, when it has any. */
  frameText?: string;
  frameLabel: string;
  context: string;
  contextDetails?: ContextDetails | null;
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
  label: string;
  message: string;
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
  passedChecks: CheckDefinition[];
  /** How many of each thing were checked, e.g. 14 paragraph styles. */
  checked: { label: string; count: number }[];
};

const CHECKED_LABELS: Record<CategoryKey, string> = {
  par_styles: 'paragraph styles',
  char_styles: 'character styles',
  text_boxes: 'text frames',
  fonts: 'fonts',
  images: 'images',
  general: '',
};

const SUBJECT_LABELS: Record<SubjectKind, string> = {
  'paragraph-style': 'Paragraph style',
  'character-style': 'Character style',
  font: 'Font',
  image: 'Image',
  frame: 'Frame',
  document: 'Document',
};

const clean = (text: string | undefined | null) => text?.replace(/\s+/g, ' ').trim() || undefined;

const isNamed = (identifier: string | null | undefined): identifier is string =>
  !!identifier && identifier !== 'null';

function frameLabel(bounds: PageBounds | undefined, category: CategoryKey): string {
  if (bounds?.kind === 'TextFrame' || category === 'text_boxes' || category === 'par_styles' || category === 'char_styles') {
    return 'Text frame';
  }
  if (bounds?.kind === 'Group') return 'Group';
  if (category === 'images') return 'Image frame';
  if (bounds?.kind === 'GraphicLine') return 'Line';
  return 'Frame';
}

function frameText(item: ValidationItem, result: ValidationResult): string | undefined {
  const storyId = (item.identifier ?? '').split('_par_')[0];
  return clean(result.text_box_data?.[storyId]?.content) ?? clean(item.text_content?.find((t) => t.trim()));
}

function subjectFor(kind: SubjectKind, place: Place): { key: string; name: string | null; label: string } {
  const { item } = place;
  switch (kind) {
    case 'paragraph-style':
    case 'character-style':
    case 'font':
    case 'image':
      if (isNamed(item.identifier)) {
        return { key: `${kind}:${item.identifier}`, name: item.identifier, label: `${SUBJECT_LABELS[kind]} “${item.identifier}”` };
      }
      break;
    case 'document':
      if (!place.bounds) return { key: 'document', name: null, label: 'Document' };
      break;
  }
  // Frame-level: each frame is its own thing to fix.
  const id = isNamed(item.data_id) ? item.data_id : `${item.identifier}:${item.page_id}`;
  const label = place.frameText ? `${place.frameLabel} “${place.frameText}”` : place.frameLabel;
  return { key: `frame:${id}`, name: place.frameText ?? null, label };
}

export function buildReport(result: ValidationResult): Report {
  const pageIndex = new Map((result.page_layouts ?? []).map((page: PageLayout) => [page.page_id, page]));
  const checks = result.checks ?? [];
  const checkFor = (severity: ValidationType, key: string) =>
    checks.find((check) => check.severity === severity && check.key === key);

  const problems = new Map<string, Problem>();

  CATEGORY_KEYS.forEach((category) => {
    const data = result[category] as CategoryDetail | undefined;
    Object.values(data?.details ?? {}).forEach((entries) => {
      SEVERITIES.forEach((severity) => {
        entries[severity].forEach((item, index) => {
          const key = item.validationClassifier;
          const id = `${severity}:${key}`;
          const check = checkFor(severity, key);
          const classifier = result.validation_classifiers?.[key];
          let problem = problems.get(id);
          if (!problem) {
            const label = check?.label ?? classifier?.label ?? key;
            const message = check?.message ?? classifier?.message ?? '';
            problem = {
              id,
              key,
              severity,
              guide: getCheckGuide(severity, key, label, message),
              label,
              message,
              helpArticle: check?.help_article ?? classifier?.help_article ?? null,
              subjects: [],
              placeCount: 0,
              pageNames: [],
            };
            problems.set(id, problem);
          }

          const bounds = item.bounds && pageIndex.has(item.bounds.page_id) ? item.bounds : undefined;
          const pageId = bounds?.page_id ?? item.page_id;
          const place: Place = {
            key: `${id}:${category}:${item.identifier}:${item.data_id}:${index}`,
            item,
            category,
            bounds,
            pageName: pageId ? pageIndex.get(pageId)?.name || item.page_name || undefined : undefined,
            frameText: frameText(item, result),
            frameLabel: frameLabel(bounds, category),
            context: item.context ?? '',
            contextDetails: item.context_details,
          };

          const subjectInfo = subjectFor(problem.guide.subject, place);
          let subject = problem.subjects.find((s) => s.key === subjectInfo.key);
          if (!subject) {
            const kind = subjectInfo.key.startsWith('frame:') ? 'frame' : problem.guide.subject;
            subject = { ...subjectInfo, kind, places: [] };
            problem.subjects.push(subject);
          }
          subject.places.push(place);
          problem.placeCount += 1;
        });
      });
    });
  });

  const pageOrder = (name: string) => {
    const index = Array.from(pageIndex.values()).find((page) => page.name === name)?.index;
    return index ?? (Number.isFinite(Number(name)) ? Number(name) : Infinity);
  };

  const placeOrder = (place: Place) => pageIndex.get(place.bounds?.page_id ?? place.item.page_id)?.index ?? Infinity;
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

  const checked = CATEGORY_KEYS.flatMap((category) => {
    const count = (result[category] as CategoryDetail | undefined)?.total_count ?? 0;
    return CHECKED_LABELS[category] && count > 0 ? [{ label: CHECKED_LABELS[category], count }] : [];
  });

  return {
    problems: sorted,
    problemCounts,
    placeCounts,
    passedChecks: checks.filter((check) => !problems.has(`${check.severity}:${check.key}`)),
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

export const categoryLabel = (category: CategoryKey) => ValidationCategory[category];

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
