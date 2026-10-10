import { formatPages, type Problem, type Report } from './buildReport';

const MAX_LISTED = 4;

const shorten = (text: string, max = 40) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

function whereLine(problem: Problem): string | null {
  const { subjects } = problem;
  const kind = subjects[0]?.kind;
  if (!kind || kind === 'document') return null;

  // Frames with the same text (e.g. the same label on every page) are listed once with all their pages.
  const entries = new Map<string, { text: string; pages: string[] }>();
  subjects.forEach((s) => {
    if (s.kind !== 'frame') {
      entries.set(s.key, { text: s.label.charAt(0).toLowerCase() + s.label.slice(1), pages: [] });
      return;
    }
    const place = s.places[0];
    const text = `the ${place.frameLabel.toLowerCase()}${s.name ? ` “${shorten(s.name)}”` : ''}`;
    const entry = entries.get(text) ?? { text, pages: [] };
    if (place.pageName) entry.pages.push(place.pageName);
    entries.set(text, entry);
  });
  const list = Array.from(entries.values());
  const names = list.slice(0, MAX_LISTED).map(({ text, pages }) =>
    pages.length ? `${text} on ${pages.length === 1 ? 'page' : 'pages'} ${formatPages(pages)}` : text
  );
  const more = list.length > MAX_LISTED ? ` and ${list.length - MAX_LISTED} more` : '';
  const pages =
    kind !== 'frame' && problem.pageNames.length
      ? ` (used on ${problem.pageNames.length === 1 ? 'page' : 'pages'} ${formatPages(problem.pageNames)})`
      : '';
  return `${names.join(', ')}${more}${pages}`;
}

/** Frame-specific settings from the checker, e.g. "'No Line Breaks' must be checked." */
function settingLines(problem: Problem): string[] {
  const settings = new Set<string>();
  problem.subjects.forEach((s) => s.places.forEach((p) => p.context && !p.contextDetails && settings.add(p.context)));
  return settings.size > 0 && settings.size <= MAX_LISTED ? Array.from(settings) : [];
}

function problemBlock(problem: Problem, number: number): string {
  const lines = [`${number}. ${problem.guide.title}`];
  const where = whereLine(problem);
  if (where) lines.push(`   Where: ${where}`);
  problem.guide.fix.forEach((step) => lines.push(`   – ${step}`));
  settingLines(problem).forEach((setting) => lines.push(`   Details: ${setting}`));
  if (problem.helpArticle) lines.push(`   More info: ${problem.helpArticle}`);
  return lines.join('\n');
}

/** A message support can paste straight into a reply to the customer. */
/** Removes the file extension so the message names the template, not the upload. */
export const displayTemplateName = (templateName: string) => templateName.replace(/\.(zip|idml|indd)$/i, '');

/** A message support can paste into a reply, explaining what may be causing the customer's issues. */
export function buildCustomerSummary(report: Report, templateName: string): string {
  const blockers = report.problems.filter((p) => p.severity === 'errors');
  const warnings = report.problems.filter((p) => p.severity === 'warnings');
  const infos = report.problems.filter((p) => p.severity === 'infos');
  const cleanName = displayTemplateName(templateName);
  const name = cleanName && cleanName !== 'No Name' ? `“${cleanName}”` : 'your template';
  const count = (n: number) => (n === 1 ? 'one thing' : `${n} things`);
  const parts: string[] = [];

  if (blockers.length) {
    parts.push(
      `We checked ${name} and found ${count(blockers.length)} in the InDesign file that are likely causing the issues. These can stop a template from working in Frontify, or make it look different:`,
      ''
    );
    blockers.forEach((problem, i) => parts.push(problemBlock(problem, i + 1), ''));
  }

  if (warnings.length) {
    parts.push(
      blockers.length
        ? 'These may also make the template look different than expected:'
        : `We checked ${name} and found ${count(warnings.length)} that may make it look different than expected in Frontify:`,
      ''
    );
    warnings.forEach((problem, i) => parts.push(problemBlock(problem, i + 1), ''));
  }

  if (infos.length) {
    parts.push(
      parts.length
        ? 'Also worth a quick check, though these are often fine as they are:'
        : `We checked ${name}. A few things are worth a quick check, though they’re often fine as they are:`,
      ''
    );
    infos.forEach((problem, i) => parts.push(problemBlock(problem, i + 1), ''));
  }

  if (!parts.length) return `We checked ${name} and didn’t find anything in the template that would cause issues.`;

  parts.push('After making changes, package the document again with File > Package and upload the new ZIP to Frontify.');
  return parts.join('\n');
}
