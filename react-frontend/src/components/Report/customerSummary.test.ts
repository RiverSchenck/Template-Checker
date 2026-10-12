import { describe, expect, it } from 'vitest';
import type { CustomerSummaryPayload } from '../../types';
import { displayTemplateName, toSummaryDocument } from './customerSummary';

const payload: CustomerSummaryPayload = {
  summary_version: '2026-10-12',
  counts: { blockers: 1, warnings: 0, infos: 0 },
  html: '<p>We checked “Sale 🎉”.</p>',
  text: 'We checked “Sale 🎉”.\n\n1. Kerning\n• Fix it.\nLearn more: https://help/kerning',
  sections: [
    { key: 'intro', title: 'Introduction', problem_id: null, lines: [{ kind: 'text', text: 'We checked “Sale 🎉”.' }] },
    {
      key: 'KERNING',
      title: 'Kerning',
      problem_id: 'errors:KERNING',
      lines: [
        { kind: 'title', text: '1. Kerning' },
        { kind: 'step', text: 'Fix it.' },
        { kind: 'link', text: 'Learn more', href: 'https://help/kerning' },
      ],
    },
  ],
};

describe('toSummaryDocument', () => {
  it('lays out the backend’s summary for review, with each section’s offsets in the review text', () => {
    const doc = toSummaryDocument(payload);
    expect(doc.text).toBe('We checked “Sale 🎉”.\n\n1. Kerning\n• Fix it.\nLearn more');
    for (const section of doc.sections) expect(doc.text.slice(section.start, section.end)).toBe(section.text);
    expect(doc.sections.map((s) => [s.id, s.key, s.problemId])).toEqual([
      ['section-0', 'intro', undefined],
      ['section-1', 'KERNING', 'errors:KERNING'],
    ]);
  });

  it('copies exactly what the backend wrote', () => {
    const doc = toSummaryDocument(payload);
    expect(doc.html).toBe(payload.html);
    expect(doc.plainText).toBe(payload.text);
  });
});

describe('displayTemplateName', () => {
  it('drops the file extension', () => {
    expect(displayTemplateName('Brochure.zip')).toBe('Brochure');
    expect(displayTemplateName('Brochure.v2.IDML')).toBe('Brochure.v2');
  });
});
