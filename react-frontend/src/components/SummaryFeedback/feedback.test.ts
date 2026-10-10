import type { SummaryComment } from './api';
import { groupComments, isApproval, matchesFilters, matchesQuery, quoteRange, sortComments } from './feedback';

let n = 0;
const comment = (overrides: Partial<SummaryComment>): SummaryComment => ({
  id: `c${++n}`,
  review_id: 'r1',
  section_key: 'FONTS_INCLUDED',
  section_title: 'Font missing from the package',
  quote: null,
  quote_start: null,
  quote_end: null,
  body: 'Too technical for this customer.',
  created_at: '2026-10-01T10:00:00Z',
  resolved_at: null,
  template_name: 'RollUp_Bad.zip',
  summary: null,
  reviewed_at: '2026-10-01T10:00:00Z',
  ...overrides,
});

const approval = (overrides: Partial<SummaryComment> = {}) =>
  comment({ section_key: 'general', section_title: 'General feedback', body: 'Looks good to send.', ...overrides });

describe('isApproval', () => {
  it('is the one-click general comment', () => {
    expect(isApproval(approval())).toBe(true);
  });

  it('is not a general comment with other text, or the same text on an issue', () => {
    expect(isApproval(approval({ body: 'Looks good to send, but shorten the intro.' }))).toBe(false);
    expect(isApproval(comment({ body: 'Looks good to send.' }))).toBe(false);
  });
});

describe('sortComments', () => {
  it('puts real comments before approvals, newest first within each', () => {
    const oldApproval = approval({ id: 'a-old', created_at: '2026-10-01T00:00:00Z' });
    const newApproval = approval({ id: 'a-new', created_at: '2026-10-05T00:00:00Z' });
    const oldComment = comment({ id: 'c-old', section_key: 'general', created_at: '2026-09-01T00:00:00Z' });
    const newComment = comment({ id: 'c-new', section_key: 'general', created_at: '2026-10-03T00:00:00Z' });
    expect(sortComments([oldApproval, newComment, newApproval, oldComment]).map((c) => c.id)).toEqual([
      'c-new',
      'c-old',
      'a-new',
      'a-old',
    ]);
  });
});

describe('groupComments', () => {
  it('groups by section title, falling back to the key', () => {
    const groups = groupComments([
      comment({ section_title: 'Embedded image', section_key: 'IMAGE_EMBEDDED' }),
      comment({ section_title: 'Embedded image', section_key: 'IMAGE_EMBEDDED' }),
      comment({ section_title: null, section_key: 'KERNING' }),
    ]);
    expect(groups.map((g) => [g.title, g.comments.length])).toEqual([
      ['Embedded image', 2],
      ['KERNING', 1],
    ]);
  });

  it('orders issues by open count, then puts intro, closing and general feedback last', () => {
    const groups = groupComments([
      approval(),
      comment({ section_key: 'intro', section_title: 'Introduction' }),
      comment({ section_key: 'closing', section_title: 'Closing' }),
      comment({ section_key: 'A', section_title: 'One open' }),
      comment({ section_key: 'B', section_title: 'Two open' }),
      comment({ section_key: 'B', section_title: 'Two open' }),
      comment({ section_key: 'C', section_title: 'Resolved only', resolved_at: '2026-10-02T00:00:00Z' }),
      comment({ section_key: 'C', section_title: 'Resolved only', resolved_at: '2026-10-02T00:00:00Z' }),
      comment({ section_key: 'C', section_title: 'Resolved only', resolved_at: '2026-10-02T00:00:00Z' }),
    ]);
    expect(groups.map((g) => [g.title, g.openCount])).toEqual([
      ['Two open', 2],
      ['One open', 1],
      ['Resolved only', 0],
      ['Introduction', 1],
      ['Closing', 1],
      ['General feedback', 1],
    ]);
  });

  it('sorts approvals after real comments within a group', () => {
    const [general] = groupComments([
      approval({ id: 'a', created_at: '2026-10-09T00:00:00Z' }),
      comment({ id: 'c', section_key: 'general', section_title: 'General feedback', created_at: '2026-10-01T00:00:00Z' }),
    ]);
    expect(general.comments.map((c) => c.id)).toEqual(['c', 'a']);
  });
});

describe('matchesFilters', () => {
  const open = comment({});
  const resolved = comment({ resolved_at: '2026-10-02T00:00:00Z' });
  const ok = approval();

  it('filters by status', () => {
    expect([open, resolved].filter((c) => matchesFilters(c, 'open', 'all'))).toEqual([open]);
    expect([open, resolved].filter((c) => matchesFilters(c, 'resolved', 'all'))).toEqual([resolved]);
    expect([open, resolved].filter((c) => matchesFilters(c, 'all', 'all'))).toEqual([open, resolved]);
  });

  it('filters by type', () => {
    expect([open, ok].filter((c) => matchesFilters(c, 'all', 'comments'))).toEqual([open]);
    expect([open, ok].filter((c) => matchesFilters(c, 'all', 'approvals'))).toEqual([ok]);
  });
});

describe('matchesQuery', () => {
  const c = comment({ quote: 'File > Package', user_display_name: 'Maya Lindqvist', user_email: 'maya@example.com' });

  it('matches body, quote, template and author, ignoring case', () => {
    expect(matchesQuery(c, 'technical')).toBe(true);
    expect(matchesQuery(c, 'file > package')).toBe(true);
    expect(matchesQuery(c, 'rollup')).toBe(true);
    expect(matchesQuery(c, 'lindqvist')).toBe(true);
    expect(matchesQuery(c, 'MAYA@')).toBe(true);
    expect(matchesQuery(c, '  ')).toBe(true);
    expect(matchesQuery(c, 'kerning')).toBe(false);
  });
});

describe('quoteRange', () => {
  const summary = 'We checked “RollUp”. Package it again with File > Package.';

  it('uses the saved offsets when they point at the quote', () => {
    const start = summary.indexOf('File > Package');
    expect(quoteRange({ summary, quote: 'File > Package', quote_start: start, quote_end: start + 14 })).toEqual([
      start,
      start + 14,
    ]);
  });

  it('falls back to finding the quote when the offsets are off', () => {
    expect(quoteRange({ summary, quote: 'RollUp', quote_start: 0, quote_end: 6 })).toEqual([12, 18]);
  });

  it('is null without a quote, a summary, or a match', () => {
    expect(quoteRange({ summary, quote: null, quote_start: null, quote_end: null })).toBeNull();
    expect(quoteRange({ summary: null, quote: 'RollUp', quote_start: 12, quote_end: 18 })).toBeNull();
    expect(quoteRange({ summary, quote: 'not there', quote_start: null, quote_end: null })).toBeNull();
  });
});
