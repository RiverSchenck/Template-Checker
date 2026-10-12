/**
 * Everything the API docs tab says, as data. Keep it in step with the backend (python_backend/app/routes.py,
 * app/errors.py) and docs/API.md. Keep it short: one sentence per thing.
 */

export type ErrorTone = 'amber' | 'red';

export type ApiErrorDoc = {
  status: number;
  code: string;
  /** What happened and what to do, in one sentence. */
  hint: string;
  /** Set when only some endpoints return it. */
  only?: string;
};

export const ERRORS: ApiErrorDoc[] = [
  { status: 400, code: 'missing_file', hint: 'Attach the zipped package as `file`. We can’t check thin air.' },
  {
    status: 400,
    code: 'unsupported_file_type',
    hint: 'Send a .zip: File > Package in InDesign, then zip the folder.',
    only: '/v1/checks/summary',
  },
  { status: 401, code: 'unauthorized', hint: 'The key is missing, expired or revoked.' },
  { status: 403, code: 'access_denied', hint: 'Signed in, but not approved yet. Request access first.' },
  { status: 413, code: 'file_too_large', hint: 'Over 200 MB. Unused images are the usual suspects.' },
  {
    status: 422,
    code: 'template_not_checkable',
    hint: 'Not a checkable package. `message` says why; pass it on.',
    only: '/v1/checks/summary',
  },
  { status: 429, code: 'check_in_progress', hint: 'One check at a time. Retry when the other finishes.' },
  { status: 429, code: 'rate_limited', hint: 'Over 50 checks this hour. Wait `Retry-After` seconds.' },
  { status: 500, code: 'upload_failed', hint: 'We couldn’t store the upload. Retry.' },
  { status: 500, code: 'check_failed', hint: 'The checker crashed on this file. Send us the request ID.' },
  {
    status: 500,
    code: 'summary_failed',
    hint: 'The check ran, the summary didn’t. Send us the request ID.',
    only: '/v1/checks/summary',
  },
  {
    status: 500,
    code: 'export_failed',
    hint: 'The XML export failed. Retry, then send us the request ID.',
    only: '/v1/checks/xml',
  },
];

export const errorTone = (status: number): ErrorTone => (status >= 500 ? 'red' : 'amber');

export type ResponseField = { name: string; type: string; description: string };

export type EndpointDoc = {
  id: string;
  method: 'POST';
  path: string;
  /** Short name for the nav. */
  name: string;
  /** One sentence. */
  summary: string;
  /** Optional one-line note, e.g. a gotcha. */
  note?: string;
  response: { contentType: string; example: string };
  fields: ResponseField[];
  /** Error codes this endpoint can return, in ERRORS order. */
  errors: string[];
  output: 'json' | 'zip';
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

export const ENDPOINTS: EndpointDoc[] = [
  {
    id: 'summary',
    method: 'POST',
    path: '/v1/checks/summary',
    name: 'Customer summary',
    summary: 'Check a template and get a message for the customer, ready to paste into Intercom.',
    output: 'json',
    response: {
      contentType: 'application/json',
      example: json({
        run_id: '6f1c2b9e-0d4a-4c1e-9a51-3b2f7c8d9e10',
        template_name: 'Brochure',
        summary_version: '2026-10-12',
        counts: { blockers: 4, warnings: 3, infos: 0 },
        html: '<p>We checked “Brochure” and…',
        text: 'We checked “Brochure” and…',
      }),
    },
    fields: [
      { name: 'html', type: 'string', description: 'Paste into Intercom; formatting comes along.' },
      { name: 'text', type: 'string', description: 'Plain text, links written out.' },
      { name: 'counts', type: 'object', description: 'Blockers, warnings and infos found.' },
      { name: 'run_id', type: 'string | null', description: 'This check’s id. Null if analytics was down.' },
      { name: 'summary_version', type: 'string', description: 'Changes whenever the wording does.' },
    ],
    errors: [
      'missing_file',
      'unsupported_file_type',
      'unauthorized',
      'access_denied',
      'file_too_large',
      'template_not_checkable',
      'check_in_progress',
      'rate_limited',
      'upload_failed',
      'check_failed',
      'summary_failed',
    ],
  },
  {
    id: 'run',
    method: 'POST',
    path: '/v1/checks',
    name: 'Check results',
    summary: 'Check a template and get every result as JSON.',
    note: 'A package that can’t be checked still returns 200, with `status: "rejected"` and the reason in the results.',
    output: 'json',
    response: {
      contentType: 'application/json',
      example: json({
        run_id: '6f1c2b9e-0d4a-4c1e-9a51-3b2f7c8d9e10',
        status: 'completed',
        results: {
          template_name: 'Brochure.zip',
          fonts: { details: {}, total_count: 3 },
          check_guides: {},
          customer_summary: {},
        },
      }),
    },
    fields: [
      { name: 'status', type: 'string', description: '`completed`, or `rejected` if the package couldn’t be checked.' },
      { name: 'results.<category>', type: 'object', description: 'Issues by category, then severity.' },
      { name: 'results.check_guides', type: 'object', description: 'Plain-language copy per check.' },
      { name: 'results.customer_summary', type: 'object | null', description: 'Same message as the summary endpoint.' },
    ],
    errors: [
      'missing_file',
      'unauthorized',
      'access_denied',
      'file_too_large',
      'check_in_progress',
      'rate_limited',
      'upload_failed',
      'check_failed',
    ],
  },
  {
    id: 'run-and-download-xml',
    method: 'POST',
    path: '/v1/checks/xml',
    name: 'XML export',
    summary: 'Check a template and download its XML as a ZIP.',
    output: 'zip',
    response: {
      contentType: 'application/zip',
      example: 'Content-Type: application/zip\nContent-Disposition: attachment; filename="Brochure-xml.zip"',
    },
    fields: [],
    errors: [
      'missing_file',
      'unauthorized',
      'access_denied',
      'file_too_large',
      'check_in_progress',
      'rate_limited',
      'upload_failed',
      'check_failed',
      'export_failed',
    ],
  },
];

export type Language = 'curl' | 'javascript' | 'python';

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'curl', label: 'cURL' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
];

/** A ready-to-run request for an endpoint in the given language. */
export function requestExample(endpoint: EndpointDoc, language: Language, baseURL: string): string {
  const url = `${baseURL}${endpoint.path}`;
  const zip = endpoint.output === 'zip';
  if (language === 'curl') {
    return [
      `curl -X POST ${url} \\`,
      '  -H "Authorization: Bearer $TC_KEY" \\',
      `  -F "file=@Brochure.zip"${zip ? ' \\\n  -o Brochure-xml.zip' : ''}`,
    ].join('\n');
  }
  if (language === 'javascript') {
    const result = zip ? 'const zip = await res.blob();' : 'const body = await res.json();';
    return [
      'const form = new FormData();',
      "form.append('file', zipFile);",
      '',
      `const res = await fetch('${url}', {`,
      "  method: 'POST',",
      '  headers: { Authorization: `Bearer ${TC_KEY}` },',
      '  body: form,',
      '});',
      result,
    ].join('\n');
  }
  const result = zip ? 'open("Brochure-xml.zip", "wb").write(res.content)' : 'body = res.json()';
  return [
    'import requests',
    '',
    'res = requests.post(',
    `    "${url}",`,
    '    headers={"Authorization": f"Bearer {TC_KEY}"},',
    '    files={"file": open("Brochure.zip", "rb")},',
    ')',
    result,
  ].join('\n');
}

export const ERROR_EXAMPLE = json({
  error: { code: 'rate_limited', message: 'Limit of 50 checks per hour reached.', request_id: '9b2e4c7a…' },
});

export const CLIPBOARD_EXAMPLE = `navigator.clipboard.write([
  new ClipboardItem({
    'text/html': new Blob([body.html], { type: 'text/html' }),
    'text/plain': new Blob([body.text], { type: 'text/plain' }),
  }),
]);`;
