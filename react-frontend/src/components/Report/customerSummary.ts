import { formatPages, type Place, type Problem, type Report, type Subject } from './buildReport';
import type { ValidationType } from '../../types';

const MAX_LISTED = 3;

const shorten = (text: string, max = 32) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const pagesText = (pages: string[]) => `${pages.length === 1 ? 'page' : 'pages'} ${formatPages(pages)}`;
const listText = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';

const unique = (values: (string | undefined)[]) => Array.from(new Set(values.filter((v): v is string => !!v)));

// ------------------------------------------------------------------ Details from the checker, in customer words

const AUTO_SIZE_SETTINGS: [RegExp, string][] = [
  [/no line breaks/i, 'turn on No Line Breaks'],
  [/widthonly.*center/i, 'Width Only can’t grow from the center, pick a left or right reference point'],
  [/heightonly.*center/i, 'Height Only can’t grow from the center, pick a top or bottom reference point'],
];

/** A short note about one place, e.g. "rotated 90°" or "15.25 MB". Raw checker values (skew factors, link ids) are left out. */
function placeDetail(problem: Problem, place: Place): string | null {
  const { context } = place;
  if (!context) return null;
  switch (problem.key) {
    case 'AUTO_SIZE_TEXT_BOX':
      return AUTO_SIZE_SETTINGS.find(([pattern]) => pattern.test(context))?.[1] ?? context.replace(/\.$/, '');
    case 'LARGE_IMAGE':
      return context.match(/([\d.]+)\s*MB/i)?.[1].concat(' MB') ?? null;
    case 'IMAGE_TRANSFORMATION':
    case 'IMAGE_TRANSFORMATION_IMAGE':
    case 'IMAGE_TRANSFORMATION_CONTAINER':
    case 'PAGE_ITEM_TRANSFORMATION': {
      const degrees = context.match(/rotated by (-?[\d.]+) degrees/i)?.[1];
      return degrees ? `rotated ${Math.round(Number(degrees))}°` : null;
    }
    default:
      return null;
  }
}

/** Overridden properties customers would recognise, in the order InDesign shows them. Others (e.g. MiterLimit) are left out. */
const OVERRIDE_NAMES: Record<string, string> = {
  AppliedFont: 'font',
  FontStyle: 'font',
  PointSize: 'size',
  Leading: 'leading',
  Tracking: 'tracking',
  Capitalization: 'capitalization',
  FillColor: 'color',
};

/** Notes about one frame, style or image: its place details, or for overrides which formatting was changed. */
function placesDetails(problem: Problem, places: Place[]): string[] {
  if (problem.key === 'OVERRIDE') {
    const changed = new Set(places.flatMap((p) => Object.keys(p.contextDetails?.overrides ?? {})));
    const names = unique(Object.keys(OVERRIDE_NAMES).filter((k) => changed.has(k)).map((k) => OVERRIDE_NAMES[k]));
    if (!names.length) return [];
    return [`${names.length > 3 ? `${names.slice(0, 3).join(', ')} and more` : listText(names)} changed`];
  }
  return unique(places.map((p) => placeDetail(problem, p) ?? undefined));
}

const ELEMENT_NAMES: Record<string, string> = {
  TextFrame: 'text frame',
  Rectangle: 'rectangle',
  Oval: 'oval',
  Polygon: 'polygon',
  GraphicLine: 'line',
  Group: 'group',
};

const ptToMm = (pt: number) => `${Number(((pt * 25.4) / 72).toFixed(1))} mm`;

/** Extra lines for the whole issue, e.g. what's on the master page or how big the bleed is. */
function problemNotes(problem: Problem): string[] {
  const contexts = unique(problem.subjects.flatMap((s) => s.places.map((p) => p.context)));
  switch (problem.key) {
    case 'MASTERPAGE': {
      const counts = new Map<string, number>();
      contexts.forEach((c) =>
        c
          .replace(/^Elements:\s*/i, '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
          .forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1))
      );
      const items = Array.from(counts).map(([e, n]) => plural(n, ELEMENT_NAMES[e] ?? e.toLowerCase()));
      return items.length ? [`Found on the master page: ${listText(items)}`] : [];
    }
    case 'DOCUMENT_BLEED': {
      const sides = Array.from((contexts[0] ?? '').matchAll(/(\w+):\s*([\d.]+)pt/g)).map(([, side, pt]) => ({
        side,
        size: ptToMm(Number(pt)),
      }));
      if (!sides.length) return [];
      const sizes = unique(sides.map((s) => s.size));
      return [`Current bleed: ${sizes.length === 1 ? `${sizes[0]} on all sides` : sides.map((s) => `${s.side} ${s.size}`).join(', ')}`];
    }
    case 'PARAGRAPH_STYLE':
      return contexts.some((c) => /whitespace/i.test(c))
        ? ['Tip: some of this is only spaces or empty lines after the text. Delete them, or give them a style too.']
        : [];
    default:
      return [];
  }
}

// ------------------------------------------------------------------ Where the issue is

/** InDesign's internal style names, as the panels show them. */
const STYLE_NAMES: Record<string, string> = {
  NormalParagraphStyle: '[Basic Paragraph]',
  NormalCharacterStyle: '[None]',
};
const styleName = (name: string) => STYLE_NAMES[name] ?? name;

const KIND_WORDS: Record<Subject['kind'], string> = {
  'paragraph-style': 'paragraph style',
  'character-style': 'character style',
  font: 'font',
  image: 'image',
  frame: 'frame',
  document: '',
};

/** Frames are listed by their text, e.g. text frames “Title” (page 1), “Intro” (page 2) and 3 more. */
function framesWhere(problem: Problem, subjects: Subject[]): string {
  const named = new Map<string, { pages: Set<string>; places: Place[] }>();
  const unnamed = { count: 0, pages: new Set<string>() };
  subjects.forEach((s) => {
    const place = s.places[0];
    if (!s.name) {
      unnamed.count += 1;
      if (place.pageName) unnamed.pages.add(place.pageName);
      return;
    }
    const text = `“${shorten(s.name)}”`;
    const entry = named.get(text) ?? { pages: new Set(), places: [] };
    if (place.pageName) entry.pages.add(place.pageName);
    entry.places.push(...s.places);
    named.set(text, entry);
  });

  const labels = unique(subjects.map((s) => s.places[0].frameLabel.toLowerCase()));
  const word = labels.length === 1 ? labels[0] : 'frame';
  const firstPage = (pages: Set<string>) => Math.min(...Array.from(pages).map((p) => problem.pageNames.indexOf(p) >>> 0));
  const entries = Array.from(named, ([text, e]) => [text, { ...e, details: placesDetails(problem, e.places) }] as const).sort(([, a], [, b]) => firstPage(a.pages) - firstPage(b.pages));
  const shown = entries.slice(0, MAX_LISTED);
  const pageKey = (e: (typeof entries)[number][1]) => (e.details.length ? null : Array.from(e.pages).join());

  // Frames on the same page share one page note: “Title”, “Intro” (page 1), “Footer” (page 2).
  const names = shown.map(([text, e], i) => {
    const next = shown[i + 1]?.[1];
    const pageNote = e.pages.size && !(next && pageKey(e) !== null && pageKey(e) === pageKey(next)) ? pagesText(Array.from(e.pages)) : '';
    const notes = [pageNote, ...e.details].filter(Boolean);
    return notes.length ? `${text} (${notes.join(', ')})` : text;
  });
  const hidden = entries.length - names.length;

  if (!entries.length) {
    const pages = unnamed.pages.size ? ` on ${pagesText(Array.from(unnamed.pages))}` : '';
    return unnamed.count === 1 ? `a ${word}${pages}` : `${plural(unnamed.count, word)}${pages}`;
  }
  let text = `${entries.length + unnamed.count === 1 ? `the ${word}` : `${word}s`} ${names.join(', ')}`;
  const more = hidden + unnamed.count;
  if (more) text += ` and ${more} more`;
  return text;
}

/**
 * Styles, fonts and images are listed by name: styles with the pages they're used on at the end
 * (paragraph styles “Title” and “Body”, used on page 1), images with their own pages (image “a.png” (page 2)).
 */
function namedWhere(problem: Problem, kind: Subject['kind'], subjects: Subject[]): string {
  const isStyle = kind === 'paragraph-style' || kind === 'character-style';
  const names = subjects.map((s) => {
    const pages = kind === 'image' ? unique(s.places.map((p) => p.pageName)) : [];
    const notes = [
      pages.length ? pagesText(pages) : '',
      ...placesDetails(problem, s.places),
    ].filter(Boolean);
    return `“${shorten(styleName(s.name ?? ''), 60)}”${notes.length ? ` (${notes.join(', ')})` : ''}`;
  });
  const shown = names.slice(0, MAX_LISTED);
  const hidden = names.length - shown.length;
  const list = hidden ? `${shown.join(', ')} and ${hidden} more` : listText(shown);
  const pages = isStyle ? unique(subjects.flatMap((s) => s.places.map((p) => p.pageName))) : [];
  const used = pages.length ? `, used on ${pagesText(problem.pageNames.filter((p) => pages.includes(p)))}` : '';
  return `${subjects.length === 1 ? 'the ' : ''}${KIND_WORDS[kind]}${subjects.length === 1 ? '' : 's'} ${list}${used}`;
}

function whereLine(problem: Problem): string | null {
  const byKind = new Map<Subject['kind'], Subject[]>();
  problem.subjects.forEach((s) => s.kind !== 'document' && byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s]));
  const parts = Array.from(byKind).map(([kind, subjects]) =>
    kind === 'frame' ? framesWhere(problem, subjects) : namedWhere(problem, kind, subjects)
  );
  return parts.length ? parts.join('; ') : null;
}

// ------------------------------------------------------------------ Text and HTML

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * One line of the summary. The review panel, the HTML copy (for Intercom) and the plain-text copy are all rendered
 * from these, so they say the same thing and look alike.
 */
export type SummaryLine =
  | { kind: 'heading' | 'title' | 'text' | 'step'; text: string }
  | { kind: 'link'; text: string; href: string };

/** How a line reads in the review panel; comments point at offsets in this text. */
export const lineText = (line: SummaryLine) => (line.kind === 'step' ? `• ${line.text}` : line.text);

/** Plain-text copy: same as the review text, but with the link written out. */
const plainLineText = (line: SummaryLine) => (line.kind === 'link' ? `${line.text}: ${line.href}` : lineText(line));

/** HTML that Intercom keeps when pasted: bold titles with their details below, bullet lists, and links. */
function linesHtml(lines: SummaryLine[]): string {
  let html = '';
  let steps: string[] = [];
  let paragraph: string[] | null = null;
  const flush = () => {
    if (paragraph) html += `<p>${paragraph.join('<br>')}</p>`;
    if (steps.length) html += `<ul>${steps.map((s) => `<li>${s}</li>`).join('')}</ul>`;
    paragraph = null;
    steps = [];
  };
  lines.forEach((line) => {
    const text = escapeHtml(line.text);
    if (line.kind === 'step') {
      if (paragraph) {
        html += `<p>${paragraph.join('<br>')}</p>`;
        paragraph = null;
      }
      steps.push(text);
    } else if (line.kind === 'text' && paragraph) {
      paragraph.push(text);
    } else {
      flush();
      if (line.kind === 'link') html += `<p><a href="${escapeHtml(line.href)}">${text}</a></p>`;
      else if (line.kind === 'heading') html += `<p><strong>${text}</strong></p>`;
      else paragraph = [line.kind === 'title' ? `<strong>${text}</strong>` : text];
    }
  });
  flush();
  return html;
}

function problemLines(problem: Problem, number: number): SummaryLine[] {
  const why = firstSentence(problem.guide.why);
  const where = whereLine(problem);
  const details = [why, where && `Where: ${where}`, ...problemNotes(problem)].filter((l): l is string => !!l);
  return [
    { kind: 'title', text: `${number}. ${problem.guide.title}` },
    ...details.map((text): SummaryLine => ({ kind: 'text', text })),
    ...problem.guide.fix.map((text): SummaryLine => ({ kind: 'step', text })),
    ...(problem.helpArticle ? [{ kind: 'link', text: 'Learn more', href: problem.helpArticle } as SummaryLine] : []),
  ];
}

/** Removes the file extension so the message names the template, not the upload. */
export const displayTemplateName = (templateName: string) => templateName.replace(/\.(zip|idml|indd)$/i, '');

/** One part of the summary: the intro, a single issue, a group heading, or the closing line. */
export type SummarySection = {
  /** Stable id within this summary, e.g. "issue-3". */
  id: string;
  /** What feedback on it is filed under: an issue's check key (e.g. FONTS_INCLUDED), or 'intro' / 'closing'. */
  key: string;
  /** Short label for the section, e.g. the issue's title. */
  title: string;
  /** The issue this section describes, so the results can show it. Missing for the intro and closing. */
  problemId?: string;
  /** The section's lines; `text` is them joined with newlines. */
  lines: SummaryLine[];
  text: string;
  /** Character offsets of `text` within the full summary. */
  start: number;
  end: number;
};

export type SummaryDocument = {
  /** What's reviewed and saved; comment offsets point into this. */
  text: string;
  /** What's copied: HTML for pasting with formatting, and plain text with links written out. */
  html: string;
  plainText: string;
  sections: SummarySection[];
};

const SECTION_GAP = '\n\n';

/** Group headings, shown when the summary has issues of more than one severity. */
const GROUP_HEADINGS: Record<ValidationType, string> = {
  errors: 'Likely causing the problems',
  warnings: 'May change how it looks',
  infos: 'Worth a quick check (often fine as is)',
};

/** The customer summary, plus where each section sits in it so reviewers can comment on parts of it. */
export function buildCustomerSummaryDocument(report: Report, templateName: string): SummaryDocument {
  const groups = (['errors', 'warnings', 'infos'] as ValidationType[])
    .map((severity) => ({ severity, problems: report.problems.filter((p) => p.severity === severity) }))
    .filter((g) => g.problems.length);
  const [blockers, warnings, infos] = (['errors', 'warnings', 'infos'] as ValidationType[]).map(
    (severity) => groups.find((g) => g.severity === severity)?.problems.length ?? 0
  );
  const cleanName = displayTemplateName(templateName);
  const name = cleanName && cleanName !== 'No Name' ? `“${cleanName}”` : 'your template';
  const issues = (n: number) => (n === 1 ? 'one issue' : `${n} issues`);

  const parts: Omit<SummarySection, 'id' | 'text' | 'start' | 'end'>[] = [];
  const intro = (text: string) => parts.push({ key: 'intro', title: 'Introduction', lines: [{ kind: 'text', text }] });

  if (blockers) {
    intro(
      `We checked ${name} and found ${issues(blockers)} in the InDesign file that ${blockers === 1 ? 'is' : 'are'} likely causing the problems in Frontify${
        warnings ? `, plus ${warnings} that may change how it looks` : ''
      }. Here’s what to change:`
    );
  } else if (warnings) {
    intro(
      `We checked ${name} and didn’t find anything that should stop it from working in Frontify, but ${issues(warnings)} may make it look different than expected. Here’s what to change:`
    );
  } else if (infos) {
    intro(
      `We checked ${name} and didn’t find anything that should cause problems in Frontify. ${
        infos === 1 ? 'One thing is' : 'A few things are'
      } worth a quick check, though ${infos === 1 ? 'it’s' : 'they’re'} often fine as is:`
    );
  } else {
    intro(`We checked ${name} and didn’t find anything in the InDesign file that would cause problems in Frontify.`);
  }

  let number = 0;
  groups.forEach(({ severity, problems }) => {
    if (groups.length > 1) {
      parts.push({ key: 'intro', title: 'Group heading', lines: [{ kind: 'heading', text: GROUP_HEADINGS[severity] }] });
    }
    problems.forEach((problem) => {
      number += 1;
      parts.push({ key: problem.key, title: problem.guide.title, problemId: problem.id, lines: problemLines(problem, number) });
    });
  });

  if (groups.length) {
    parts.push({
      key: 'closing',
      title: 'Closing',
      lines: [
        {
          kind: 'text',
          text: `${blockers || warnings ? 'Once that’s done' : 'If you change anything'}, package the document again with File > Package, zip the package folder and upload it to Frontify.`,
        },
      ],
    });
  }

  let offset = 0;
  const sections = parts.map((part, i) => {
    const text = part.lines.map(lineText).join('\n');
    const start = offset;
    offset += text.length + SECTION_GAP.length;
    return { ...part, text, id: `section-${i}`, start, end: start + text.length };
  });
  return {
    text: sections.map((s) => s.text).join(SECTION_GAP),
    html: sections.map((s) => linesHtml(s.lines)).join(''),
    plainText: sections.map((s) => s.lines.map(plainLineText).join('\n')).join(SECTION_GAP),
    sections,
  };
}

/** A message support can paste into a reply, explaining what may be causing the customer's issues. */
export function buildCustomerSummary(report: Report, templateName: string): string {
  return buildCustomerSummaryDocument(report, templateName).text;
}
