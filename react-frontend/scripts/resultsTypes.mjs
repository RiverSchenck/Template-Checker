/**
 * TypeScript types for results v2, generated from the backend's JSON Schema (schema/results-v2.json, written from
 * python_backend/src/results/models.py).
 *
 *   npm run types    # rewrite src/resultsV2.ts after the schema changes
 *
 * src/resultsV2.test.ts fails while the committed types are out of date.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

export const SCHEMA_PATH = fileURLToPath(new URL('../../schema/results-v2.json', import.meta.url));
export const TYPES_PATH = fileURLToPath(new URL('../src/resultsV2.ts', import.meta.url));

const BANNER = `/* Generated from schema/results-v2.json by scripts/resultsTypes.mjs (npm run types). Don't edit. */`;

/** Pydantic titles every field; without them the types use the field's own type instead of an alias per field. */
function withoutFieldTitles(schema) {
  if (Array.isArray(schema)) return schema.map(withoutFieldTitles);
  if (!schema || typeof schema !== 'object') return schema;
  const copy = Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, withoutFieldTitles(value)]));
  if (copy.properties) {
    for (const property of Object.values(copy.properties)) delete property.title;
  }
  return copy;
}

export async function generateResultsTypes() {
  const schema = withoutFieldTitles(JSON.parse(await readFile(SCHEMA_PATH, 'utf-8')));
  return compile(schema, 'Results', { bannerComment: BANNER, additionalProperties: false, format: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(TYPES_PATH, await generateResultsTypes());
}
