import { CategoryDetail, CheckDefinition, ValidationItem, ValidationResult } from '../../types';
import { buildReport, compareReports, describeWhere, formatPages } from './buildReport';
import { buildCustomerSummary, buildCustomerSummaryDocument } from './customerSummary';

const item = (overrides: Partial<ValidationItem>): ValidationItem => ({
  validationClassifier: 'KERNING',
  context: '',
  identifier: 'null',
  page_id: 'p1',
  page_name: '1',
  spread_id: 's1',
  data_id: 'null',
  ...overrides,
});

const category = (details: CategoryDetail['details'], total_count = 0): CategoryDetail => ({ details, total_count });
const empty = { errors: [], warnings: [], infos: [] };

const checks: CheckDefinition[] = [
  { key: 'KERNING', severity: 'errors', label: 'Kerning', message: "Kerning must be 'Metrics'", help_article: 'https://help/kerning', category: 'par_styles' },
  { key: 'AUTO_SIZE_TEXT_BOX', severity: 'errors', label: 'Auto Sizing Text Box', message: 'Auto-size wrong', help_article: null, category: 'text_boxes' },
  { key: 'FONTS_INCLUDED', severity: 'errors', label: 'Fonts Included', message: 'Missing fonts', help_article: null, category: 'fonts' },
  { key: 'COMPOSER', severity: 'warnings', label: 'Composer', message: 'Use single-line', help_article: null, category: 'par_styles' },
  { key: 'TABLE', severity: 'errors', label: 'Table', message: 'No tables', help_article: null, category: 'text_boxes' },
];

const bounds = (page_id: string, y: number) => ({ page_id, kind: 'TextFrame', x: 10, y, width: 100, height: 20 });

function makeResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    template_name: 'Sample',
    output_folder: '',
    par_styles: category(
      {
        Headline: {
          ...empty,
          errors: [
            item({ identifier: 'Headline', data_id: 'f1', text_content: ['Big title'], bounds: bounds('p1', 10) }),
            item({ identifier: 'Headline', data_id: 'f2', page_id: 'p2', page_name: '2', bounds: bounds('p2', 10) }),
            item({ identifier: 'Headline', data_id: 'f3', page_id: 'p3', page_name: '3', bounds: bounds('p3', 10) }),
          ],
          warnings: [item({ validationClassifier: 'COMPOSER', identifier: 'Headline', data_id: 'f1', bounds: bounds('p1', 10) })],
        },
        Body: { ...empty, errors: [item({ identifier: 'Body', data_id: 'f4', bounds: bounds('p1', 50) })] },
      },
      4
    ),
    char_styles: category({}),
    text_boxes: category(
      {
        story1: {
          ...empty,
          errors: [
            item({
              validationClassifier: 'AUTO_SIZE_TEXT_BOX',
              identifier: 'story1',
              data_id: 'f5',
              context: "'No Line Breaks' must be checked.",
              bounds: bounds('p1', 80),
            }),
          ],
        },
      },
      6
    ),
    fonts: category({
      'Pangea Bold': { ...empty, errors: [item({ validationClassifier: 'FONTS_INCLUDED', identifier: 'Pangea Bold', page_id: '', page_name: '' })] },
    }),
    images: category({}),
    general: category({}),
    validation_classifiers: {},
    text_box_data: { story1: { identifier: 'story1', content: 'AI-generated', page_id: 'p1', page_name: '1' } },
    spread_to_pages: {},
    pages: {},
    page_layouts: ['p1', 'p2', 'p3'].map((page_id, i) => ({
      page_id,
      name: String(i + 1),
      index: i + 1,
      spread_id: 's1',
      width: 600,
      height: 400,
      preview: null,
      frames: [],
    })),
    checks,
    ...overrides,
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
    const report = buildReport(
      makeResult({ par_styles: category({}), text_boxes: category({}), fonts: category({}) })
    );
    expect(report.problems).toEqual([]);
    expect(report.passedChecks).toHaveLength(checks.length);
  });
});

describe('compareReports', () => {
  it('lists fixed, new, and improved problems', () => {
    const before = buildReport(makeResult());
    const after = buildReport(
      makeResult({
        par_styles: category({
          Headline: { ...empty, errors: [item({ identifier: 'Headline', data_id: 'f1', bounds: bounds('p1', 10) })] },
        }),
        fonts: category({}),
        text_boxes: category({
          story2: { ...empty, errors: [item({ validationClassifier: 'TABLE', identifier: 'story2', data_id: 'f9' })] },
          story1: {
            ...empty,
            errors: [item({ validationClassifier: 'AUTO_SIZE_TEXT_BOX', identifier: 'story1', data_id: 'f5', bounds: bounds('p1', 80) })],
          },
        }),
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

describe('buildCustomerSummary', () => {
  it('lists blockers with why, where and how, without internal ids', () => {
    const summary = buildCustomerSummary(buildReport(makeResult()), 'Sample');
    expect(summary).toContain(
      'We checked “Sample” and found 3 issues in the InDesign file that are likely causing the problems in Frontify, plus 1 that may change how it looks.'
    );
    expect(summary).toContain('Likely causing the problems\n\n1. Kerning isn’t set to Metrics\nFrontify spaces letters');
    expect(summary).toContain('Where: paragraph styles “Headline” and “Body”, used on pages 1–3');
    expect(summary).toContain('• In the paragraph style, go to Basic Character Formats and set Kerning to Metrics.');
    expect(summary).toContain('Where: the text frame “AI-generated” (page 1, turn on No Line Breaks)');
    expect(summary).toContain('\nLearn more\n');
    // Numbering continues across groups so the customer can refer to an item by number.
    expect(summary).toContain('May change how it looks\n\n4. Paragraph Composer used');
    expect(summary).toContain('upload it to Frontify');
    expect(summary).not.toMatch(/send us/i);
    expect(summary).not.toMatch(/\bf[1-5]\b|KERNING|story1/);
  });

  it('lists the same frame on several pages once, and drops the file extension', () => {
    const frame = (page: string) =>
      item({ validationClassifier: 'AUTO_SIZE_TEXT_BOX', identifier: 'story1', data_id: `f-${page}`, page_id: page, bounds: bounds(page, 80) });
    const summary = buildCustomerSummary(
      buildReport(
        makeResult({
          par_styles: category({}),
          fonts: category({}),
          text_boxes: category({ story1: { ...empty, errors: ['p1', 'p2', 'p3'].map(frame) } }),
        })
      ),
      'Sample.zip'
    );
    expect(summary).toContain('We checked “Sample” and found one issue in the InDesign file that is likely causing');
    expect(summary).toContain('Where: the text frame “AI-generated” (pages 1–3)');
    // A single group needs no heading.
    expect(summary).not.toContain('Likely causing the problems');
  });

  it('names frames on the same page once, and puts checker details in plain words', () => {
    const textFrame = (id: string, text: string) => {
      const data = { identifier: id, content: text, page_id: 'p1', page_name: '1' };
      return [item({ validationClassifier: 'OVERRIDE', identifier: id, data_id: id, bounds: bounds('p1', 10) }), data] as const;
    };
    const frames = [textFrame('s1', 'Title'), textFrame('s2', 'Intro')];
    const summary = buildCustomerSummary(
      buildReport(
        makeResult({
          par_styles: category({
            NormalParagraphStyle: { ...empty, warnings: [item({ validationClassifier: 'COMPOSER', identifier: 'NormalParagraphStyle', bounds: bounds('p1', 10) })] },
          }),
          fonts: category({}),
          text_boxes: category(Object.fromEntries(frames.map(([i]) => [i.identifier, { ...empty, warnings: [i] }]))),
          general: category({
            document: {
              ...empty,
              warnings: [
                item({
                  validationClassifier: 'DOCUMENT_BLEED',
                  identifier: 'document',
                  page_id: '',
                  page_name: '',
                  context: 'top: 8.503937007874017pt, bottom: 8.503937007874017pt, inside: 8.503937007874017pt, outside: 8.503937007874017pt.',
                }),
              ],
            },
          }),
          text_box_data: Object.fromEntries(frames.map(([, d]) => [d.identifier, d])),
          checks: [],
        })
      ),
      'Sample'
    );
    expect(summary).toContain('Where: text frames “Intro”, “Title” (page 1)');
    expect(summary).toContain('Where: the paragraph style “[Basic Paragraph]”, used on page 1');
    expect(summary).toContain('Current bleed: 3 mm on all sides');
    expect(summary).not.toMatch(/8\.50|NormalParagraphStyle/);
  });
});

describe('buildCustomerSummary overrides', () => {
  it('says which formatting was changed, in InDesign’s words', () => {
    const override = (overrides: Record<string, string>) =>
      item({ validationClassifier: 'OVERRIDE', identifier: 'story1', data_id: 'f5', bounds: bounds('p1', 80), context_details: { overrides } });
    const summary = buildCustomerSummary(
      buildReport(
        makeResult({
          par_styles: category({}),
          fonts: category({}),
          text_boxes: category({
            story1: { ...empty, warnings: [override({ AppliedFont: 'Arial', MiterLimit: '4' }), override({ FontStyle: 'Bold', PointSize: '12' })] },
          }),
        })
      ),
      'Sample'
    );
    expect(summary).toContain('Where: the text frame “AI-generated” (page 1, font and size changed)');
    expect(summary).toContain('• To remove it, select the text and click Clear Overrides');
  });
});

describe('buildCustomerSummary severities', () => {
  it('covers warning-only templates and lists infos as worth a check', () => {
    const summary = buildCustomerSummary(
      buildReport(
        makeResult({
          par_styles: category({
            Headline: {
              ...empty,
              warnings: [item({ validationClassifier: 'COMPOSER', identifier: 'Headline', data_id: 'f1', bounds: bounds('p1', 10) })],
            },
          }),
          text_boxes: category({
            story1: { ...empty, infos: [item({ validationClassifier: 'EMPTY_TEXT_FRAME', identifier: 'story1', data_id: 'f5', bounds: bounds('p1', 80) })] },
          }),
          fonts: category({}),
        })
      ),
      'Sample'
    );
    expect(summary).toContain('We checked “Sample” and didn’t find anything that should stop it from working in Frontify, but one issue may make it look different');
    expect(summary).toContain('Worth a quick check (often fine as is)\n\n2. Empty text frame');
    expect(summary).toContain('Once that’s done, package the document again');
  });
});

describe('buildCustomerSummaryDocument', () => {
  it('splits the summary into sections whose offsets point at their text', () => {
    const report = buildReport(makeResult());
    const doc = buildCustomerSummaryDocument(report, 'Sample');
    expect(doc.text).toBe(buildCustomerSummary(report, 'Sample'));
    for (const section of doc.sections) {
      expect(doc.text.slice(section.start, section.end)).toBe(section.text);
    }
    expect(doc.sections[0].key).toBe('intro');
    expect(doc.sections.at(-1)?.key).toBe('closing');
    const issueKeys = doc.sections.filter((s) => !['intro', 'closing'].includes(s.key)).map((s) => s.key);
    expect(issueKeys).toEqual(report.problems.map((p) => p.key));
  });

  it('has an HTML version for pasting into Intercom, with escaped text and linked help articles', () => {
    const doc = buildCustomerSummaryDocument(buildReport(makeResult()), 'A <b> & “quotes”');
    expect(doc.html).toContain('<p><strong>Likely causing the problems</strong></p>');
    expect(doc.html).toContain('<p><strong>1. Kerning isn’t set to Metrics</strong><br>Frontify spaces letters');
    expect(doc.html).toContain('<ul><li>In the paragraph style, go to Basic Character Formats and set Kerning to Metrics.</li></ul>');
    expect(doc.html).toContain('<a href="https://help/kerning">Learn more</a>');
    expect(doc.html).toContain('A &lt;b&gt; &amp; “quotes”');
  });

  it('reviews the same words it copies: links read “Learn more”, written out only in the plain-text copy', () => {
    const doc = buildCustomerSummaryDocument(buildReport(makeResult()), 'Sample');
    expect(doc.text).toContain('\nLearn more\n');
    expect(doc.text).not.toContain('https://help/kerning');
    expect(doc.plainText).toContain('Learn more: https://help/kerning');
    expect(doc.plainText.replace(/Learn more: \S+/g, 'Learn more')).toBe(doc.text);
    const htmlText = doc.html.replace(/<li>/g, '• ').replace(/<br>|<\/p>|<\/li>/g, ' ').replace(/<[^>]+>/g, '').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    expect(htmlText.replace(/\s+/g, ' ').trim()).toBe(doc.text.replace(/\s+/g, ' ').trim());
  });

  it('is a single intro section when nothing was found', () => {
    const doc = buildCustomerSummaryDocument(buildReport({ ...makeResult(), par_styles: category({}) } as never), 'X');
    expect(doc.sections.length).toBeGreaterThan(0);
    expect(doc.text.slice(doc.sections[0].start, doc.sections[0].end)).toBe(doc.sections[0].text);
  });
});
