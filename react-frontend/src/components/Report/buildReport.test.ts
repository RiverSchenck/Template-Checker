import type { Check, CheckResult, Issue, Results } from '../../types';
import { buildReport, compareReports, describeWhere, formatPages } from './buildReport';

type Kind = Issue['subject']['kind'];

/** A check as results v2 lists it; only the title, kinds and steps matter here. */
const check = (key: Check['key'], severity: Check['severity'], title: string, fix: Partial<Record<Kind, string[]>>): Check => ({
  key,
  severity,
  subject_kinds: Object.keys(fix) as Kind[],
  title,
  why: '',
  fix: fix as Record<string, string[]>,
  help_article: key === 'KERNING' ? 'https://help/kerning' : null,
  is_check: true,
});

const checks: Check[] = [
  check('KERNING', 'error', 'Kerning isn’t set to Metrics', { paragraph_style: ['Set Kerning to Metrics.'] }),
  check('AUTO_SIZE_TEXT_BOX', 'error', 'Auto-size text frame set up incorrectly', { text_frame: ['Fix auto-size.'] }),
  check('FONTS_INCLUDED', 'error', 'Font missing from the package', { font: ['Package the fonts.'] }),
  check('COMPOSER', 'warning', 'Paragraph Composer used', { paragraph_style: ['Use single-line.'] }),
  check('TABLE', 'error', 'Table in a text frame', { text_frame: ['Convert the table.'] }),
];

const style = (name: string) => ({ kind: 'paragraph_style' as const, id: `ParagraphStyle/${name}`, name });
const frame = (id: string) => ({ kind: 'text_frame' as const, id, name: null });

const issue = (
  checkKey: Issue['check'],
  subject: Issue['subject'],
  { severity = 'error', item_id = null, page_id = 'p1', page_name = '1', bounds = null, text = null, detail = null }: Partial<
    Pick<Issue, 'severity' | 'text' | 'detail'> & Issue['location']
  > = {}
): Issue => ({
  check: checkKey,
  severity,
  subject,
  location: { page_id, page_name, spread_id: 's1', item_id, bounds },
  facts: null,
  text,
  detail,
});

const bounds = (page_id: string, y: number) => ({ page_id, kind: 'TextFrame', x: 10, y, width: 100, height: 20 });

const ISSUES: Issue[] = [
  issue('KERNING', style('Headline'), { item_id: 'f1', text: ['Big title'], bounds: bounds('p1', 10) }),
  issue('KERNING', style('Headline'), { item_id: 'f2', page_id: 'p2', page_name: '2', bounds: bounds('p2', 10) }),
  issue('KERNING', style('Headline'), { item_id: 'f3', page_id: 'p3', page_name: '3', bounds: bounds('p3', 10) }),
  issue('COMPOSER', style('Headline'), { severity: 'warning', item_id: 'f1', bounds: bounds('p1', 10) }),
  issue('KERNING', style('Body'), { item_id: 'f4', bounds: bounds('p1', 50) }),
  issue('AUTO_SIZE_TEXT_BOX', frame('f5'), { item_id: 'f5', detail: "'No Line Breaks' must be checked.", bounds: bounds('p1', 80) }),
  issue('FONTS_INCLUDED', { kind: 'font', id: 'Pangea Bold', name: 'Pangea Bold' }, { page_id: null, page_name: null }),
];

function makeResult(overrides: Partial<Results> = {}): CheckResult {
  return {
    results: {
      schema_version: 2,
      template_name: 'Sample',
      issues: ISSUES,
      subjects_checked: { paragraph_style: 4, text_frame: 6 },
      pages: ['p1', 'p2', 'p3'].map((id, i) => ({
        id,
        name: String(i + 1),
        index: i + 1,
        spread_id: 's1',
        width: 600,
        height: 400,
        preview: null,
        frames: [],
      })),
      text_boxes: { f5: { content: 'AI-generated', page_id: 'p1' } },
      checks,
      ...overrides,
    },
    customer_summary: null,
  };
}

describe('buildReport', () => {
  it('groups style problems by the style to fix, not by frame', () => {
    const report = buildReport(makeResult());
    const kerning = report.problems.find((p) => p.id === 'errors:KERNING')!;
    expect(kerning.placeCount).toBe(4);
    expect(kerning.subjects.map((s) => [s.label, s.places.length])).toEqual([
      ['Paragraph style “Headline”', 3],
      ['Paragraph style “Body”', 1],
    ]);
    expect(kerning.pageNames).toEqual(['1', '2', '3']);
    expect(describeWhere(kerning)).toBe('2 paragraph styles');
  });

  it('treats frame problems frame by frame and names them by their text', () => {
    const report = buildReport(makeResult());
    const autoSize = report.problems.find((p) => p.key === 'AUTO_SIZE_TEXT_BOX')!;
    expect(autoSize.subjects).toHaveLength(1);
    expect(autoSize.subjects[0].kind).toBe('frame');
    expect(autoSize.subjects[0].label).toBe('Text frame “AI-generated”');
    expect(describeWhere(autoSize)).toBe('1 text frame, page 1');
  });

  it('keeps problems that are not on a page, like missing fonts', () => {
    const fonts = buildReport(makeResult()).problems.find((p) => p.key === 'FONTS_INCLUDED')!;
    expect(fonts.subjects[0].label).toBe('Font “Pangea Bold”');
    expect(fonts.subjects[0].places[0].bounds).toBeUndefined();
    expect(fonts.pageNames).toEqual([]);
  });

  it('orders errors first, then by how widespread they are', () => {
    const report = buildReport(makeResult());
    expect(report.problems.map((p) => p.id)).toEqual([
      'errors:KERNING',
      'errors:AUTO_SIZE_TEXT_BOX',
      'errors:FONTS_INCLUDED',
      'warnings:COMPOSER',
    ]);
    expect(report.problemCounts).toEqual({ errors: 3, warnings: 1, infos: 0 });
    expect(report.passedChecks.map((c) => c.key)).toEqual(['TABLE']);
    expect(report.checked).toEqual([
      { label: 'paragraph styles', count: 4 },
      { label: 'text frames', count: 6 },
    ]);
  });

  it('marks every check as passed when nothing is found', () => {
    const report = buildReport(makeResult({ issues: [] }));
    expect(report.problems).toEqual([]);
    expect(report.passedChecks).toHaveLength(checks.length);
  });
});

describe('compareReports', () => {
  it('lists fixed, new, and improved problems', () => {
    const before = buildReport(makeResult());
    const after = buildReport(
      makeResult({
        issues: [
          issue('KERNING', style('Headline'), { item_id: 'f1', bounds: bounds('p1', 10) }),
          issue('TABLE', frame('f9'), { item_id: 'f9' }),
          issue('AUTO_SIZE_TEXT_BOX', frame('f5'), { item_id: 'f5', bounds: bounds('p1', 80) }),
        ],
      })
    );
    const diff = compareReports(before, after);
    expect(diff.fixed.map((c) => c.id).sort()).toEqual(['errors:FONTS_INCLUDED', 'warnings:COMPOSER']);
    expect(diff.added.map((c) => c.id)).toEqual(['errors:TABLE']);
    expect(diff.better).toHaveLength(1);
    expect(diff.better[0]).toMatchObject({ id: 'errors:KERNING', before: 4, after: 1, fixedSubjects: ['Paragraph style “Body”'] });
    expect(diff.unchanged).toBe(1);
    expect(diff.byId['errors:TABLE'].status).toBe('new');
  });
});

describe('formatPages', () => {
  it('collapses consecutive pages into ranges', () => {
    expect(formatPages(['1', '2', '3', '5', '7', '8'])).toBe('1–3, 5, 7–8');
    expect(formatPages(['A', 'B'])).toBe('A, B');
  });
});

describe('check guides', () => {
  it('uses the copy in the results’ checks, and names a check it doesn’t list by its key', () => {
    const report = buildReport(makeResult());
    expect(report.problems.find((p) => p.key === 'KERNING')!.guide.title).toBe('Kerning isn’t set to Metrics');
    expect(report.passedChecks.map((c) => c.guide.title)).toEqual(['Table in a text frame']);

    const older = buildReport(makeResult({ checks: checks.filter((c) => c.key !== 'KERNING') }));
    const kerning = older.problems.find((p) => p.key === 'KERNING')!;
    expect(kerning.guide).toEqual({ title: 'KERNING', why: '', fix: [] });
  });

  it('shows a merged check as one problem, with each kind’s steps when they differ (like the customer summary)', () => {
    const objectStyle = check('OBJECT_STYLE', 'error', 'Object style applied', {
      text_frame: ['Apply [Basic Text Frame].'],
      image: ['Apply [Basic Graphics Frame].'],
    });
    const report = buildReport(
      makeResult({
        checks: [objectStyle],
        issues: [
          issue('OBJECT_STYLE', frame('f5'), { item_id: 'f5', bounds: bounds('p1', 80) }),
          issue('OBJECT_STYLE', { kind: 'image', id: 'logo.png', name: 'logo.png' }, { item_id: 'f6', bounds: bounds('p1', 10) }),
        ],
      })
    );
    expect(report.problems.map((p) => p.id)).toEqual(['errors:OBJECT_STYLE']);
    expect(report.problems[0].subjects.map((s) => s.label)).toEqual(['Image “logo.png”', 'Text frame “AI-generated”']);
    expect(report.problems[0].guide.fix).toEqual([
      'Text frames: Apply [Basic Text Frame].',
      'Image frames: Apply [Basic Graphics Frame].',
    ]);
  });
});
