import type { Results } from './resultsV2';

export type { Bounds, Check, Issue, Page, Results, Subject } from './resultsV2';

/** What /v1/checks answers with, as the web app keeps it. */
export type CheckResult = {
  /** Results v2: every issue, the checks, pages and text (schema/results-v2.json). */
  results: Results;
  /** The message for the customer, written by the backend. Null if it couldn't be written. */
  customer_summary: CustomerSummaryPayload | null;
};

/** How the report groups problems: errors are shown as Blockers. */
export type ValidationType = 'errors' | 'warnings' | 'infos';

/** One line of the customer summary. The HTML and plain-text copies are rendered from the same lines. */
export type SummaryLine =
  | { kind: 'heading' | 'title' | 'text' | 'step'; text: string }
  | { kind: 'link'; text: string; href: string };

export type CustomerSummaryPayload = {
  summary_version: string;
  counts: { blockers: number; warnings: number; infos: number };
  /** For pasting with formatting (Intercom). */
  html: string;
  /** For pasting where formatting isn't kept; links are written out. */
  text: string;
  sections: {
    /** What review feedback is filed under: an issue's check key, or 'intro' / 'closing'. */
    key: string;
    title: string;
    /** The issue the section describes, e.g. 'errors:FONTS_INCLUDED'. */
    problem_id: string | null;
    lines: SummaryLine[];
  }[];
};
