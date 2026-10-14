/**
 * Results fixtures for the web app's tests and sample data mode, built from the backend's goldens: a package's
 * results v2 (python_backend/testing/golden/results) with its customer summary (.../golden/summaries), shaped like
 * the /v1/checks response. Page previews are left out (the goldens keep only their size).
 *
 *   npm run fixtures    # rewrite src/fixtures/*.json after the goldens change
 *
 * src/fixtures/fixtures.test.ts fails while the committed fixtures are out of date.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const GOLDEN = fileURLToPath(new URL('../../python_backend/testing/golden/', import.meta.url));
const OUT = fileURLToPath(new URL('../src/fixtures/', import.meta.url));

/** Fixture name -> golden package (its name in python_backend/testing/packages/, without .zip). */
export const PACKAGES = {
  'flyer-sales': 'Flyer-Sales_Bad',
  brochure: 'Brochure_Bad',
  'object-styles': '4 obj style',
  transformations: '3 err 2 warn transformation',
  'fact-sheet': 'Fact-Sheet-Images_Bad',
  clean: 'Brochure_Good',
};

const SEVERITY_COUNTS = { errors: 'blockers', warnings: 'warnings', infos: 'infos' };

async function fixture(pkg) {
  const { results } = JSON.parse(await readFile(`${GOLDEN}results/${pkg}.json`, 'utf-8'));
  const summary = JSON.parse(await readFile(`${GOLDEN}summaries/${pkg}.json`, 'utf-8'));
  const counts = { blockers: 0, warnings: 0, infos: 0 };
  for (const section of summary.sections) {
    if (section.problem_id) counts[SEVERITY_COUNTS[section.problem_id.split(':')[0]]] += 1;
  }
  return {
    results: { ...results, pages: results.pages.map((page) => ({ ...page, preview: null })) },
    customer_summary: {
      summary_version: 'golden',
      counts,
      html: summary.html,
      text: summary.plain_text,
      sections: summary.sections,
    },
  };
}

export const fixturePath = (name) => `${OUT}${name}.json`;

/** {fixture name: file contents}.
 * @returns {Promise<Record<string, string>>} */
export async function buildFixtures() {
  const files = {};
  for (const [name, pkg] of Object.entries(PACKAGES)) files[name] = JSON.stringify(await fixture(pkg), null, 1) + '\n';
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mkdir(OUT, { recursive: true });
  for (const [name, text] of Object.entries(await buildFixtures())) await writeFile(fixturePath(name), text);
}
