import type { CustomerSummaryPayload, SummaryLine } from '../../types';

export type { SummaryLine } from '../../types';

/** Removes the file extension so the message names the template, not the upload. */
export const displayTemplateName = (templateName: string) => templateName.replace(/\.(zip|idml|indd)$/i, '');

/** How a line reads in the review panel; comments point at offsets in this text. */
export const lineText = (line: SummaryLine) => (line.kind === 'step' ? `• ${line.text}` : line.text);

/** One part of the summary: the intro, a single issue, a group heading, or the closing line. */
export type SummarySection = {
  /** Stable id within this summary, e.g. "section-3". */
  id: string;
  /** What feedback on it is filed under: an issue's check key (e.g. FONTS_INCLUDED), or 'intro' / 'closing'. */
  key: string;
  /** Short label for the section, e.g. the issue's title. */
  title: string;
  /** The issue this section describes, so the results can show it. Missing for the intro and closing. */
  problemId?: string;
  lines: SummaryLine[];
  /** The section's lines joined with newlines. */
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

/**
 * The customer summary the backend wrote (results.customer_summary), with each section's position in the review text
 * so reviewers can comment on parts of it. The backend is the only place the summary is written.
 */
export function toSummaryDocument(summary: CustomerSummaryPayload): SummaryDocument {
  let offset = 0;
  const sections = summary.sections.map((section, i) => {
    const text = section.lines.map(lineText).join('\n');
    const start = offset;
    offset += text.length + SECTION_GAP.length;
    return {
      id: `section-${i}`,
      key: section.key,
      title: section.title,
      problemId: section.problem_id ?? undefined,
      lines: section.lines,
      text,
      start,
      end: start + text.length,
    };
  });
  return {
    text: sections.map((s) => s.text).join(SECTION_GAP),
    html: summary.html,
    plainText: summary.text,
    sections,
  };
}
