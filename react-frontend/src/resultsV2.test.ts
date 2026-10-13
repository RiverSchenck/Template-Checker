// @vitest-environment node
import { readFileSync } from 'node:fs';
import { TYPES_PATH, generateResultsTypes } from '../scripts/resultsTypes.mjs';

describe('results v2 types', () => {
  it('match schema/results-v2.json (run `npm run types` after the schema changes)', async () => {
    expect(readFileSync(TYPES_PATH, 'utf-8')).toBe(await generateResultsTypes());
  });
});
