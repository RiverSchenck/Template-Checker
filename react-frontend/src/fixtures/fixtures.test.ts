// @vitest-environment node
import { readFileSync } from 'node:fs';
import { buildFixtures, fixturePath } from '../../scripts/fixtures.mjs';

describe('results fixtures', () => {
  it('match the backend goldens (run `npm run fixtures` after the goldens change)', async () => {
    const files: Record<string, string> = await buildFixtures();
    for (const [name, text] of Object.entries(files)) expect(readFileSync(fixturePath(name), 'utf-8')).toBe(text);
  });
});
