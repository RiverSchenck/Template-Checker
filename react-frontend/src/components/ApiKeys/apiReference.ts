/**
 * Everything the API docs tab says, as data. Keep it in step with the backend (python_backend/app/routes.py,
 * app/errors.py) and docs/API.md.
 */

export type ErrorTone = 'amber' | 'red';

export type ApiErrorDoc = {
  status: number;
  code: string;
  /** When it happens and what to do about it. */
  hint: string;
  /** Whether the same request can succeed if sent again. */
  retry: Retry;
  /** Set when only some endpoints return it. */
  only?: string;
};

export type Retry = 'no' | 'yes' | 'retry-after';

export const RETRY_LABEL: Record<Retry, string> = {
  no: 'No',
  yes: 'Yes, with backoff',
  'retry-after': 'After `Retry-After`',
};

export const ERRORS: ApiErrorDoc[] = [
  { status: 400, code: 'missing_file',
    retry: 'no', hint: 'The request has no `file` field, or the file is empty.' },
  {
    status: 400,
    code: 'unsupported_file_type',
    retry: 'no',
    hint: 'The uploaded file is not a ZIP archive.',
    only: '/v1/checks/summary',
  },
  { status: 401, code: 'unauthorized',
    retry: 'no', hint: 'The API key is missing, invalid, expired or revoked.' },
  {
    status: 403,
    code: 'access_denied',
    retry: 'no',
    hint: 'The key belongs to a user who has not been approved for Template Checker.',
  },
  { status: 413, code: 'file_too_large',
    retry: 'no', hint: 'The upload exceeds the 200 MB limit.' },
  {
    status: 422,
    code: 'template_not_checkable',
    retry: 'no',
    hint: 'The package could not be checked, for example because it contains no `.idml` file. `message` states the reason and is suitable to show to the customer. Returned by `/v1/checks/summary` and `/v1/checks/xml`; `/v1/checks` returns 200 with `status: "rejected"` instead.',
  },
  {
    status: 429,
    code: 'check_in_progress',
    retry: 'yes',
    hint: 'Another check for the same user is still running. Retry once it has finished.',
  },
  {
    status: 429,
    code: 'rate_limited',
    retry: 'retry-after',
    hint: 'The hourly limit of 50 checks has been reached. Retry after the number of seconds in `Retry-After`.',
  },
  { status: 500, code: 'upload_failed',
    retry: 'yes', hint: 'The upload could not be stored. The request can safely be retried.' },
  {
    status: 500,
    code: 'check_failed',
    retry: 'no',
    hint: 'The checker failed on this package. Retrying will not help; report it with the request ID.',
  },
  {
    status: 500,
    code: 'summary_failed',
    retry: 'no',
    hint: 'The check completed, but the summary could not be generated. Report it with the request ID.',
    only: '/v1/checks/summary',
  },
  {
    status: 500,
    code: 'export_failed',
    retry: 'yes',
    hint: 'The XML export could not be created. Retry, and report it with the request ID if it persists.',
    only: '/v1/checks/xml',
  },
];

export const errorTone = (status: number): ErrorTone => (status >= 500 ? 'red' : 'amber');

export type Attribute = {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  /** Nested attributes, shown indented under the parent. */
  children?: Attribute[];
};

/** Every check endpoint takes the same request. */
export const REQUEST_HEADERS: Attribute[] = [
  {
    name: 'Authorization',
    type: 'string',
    required: true,
    description: 'Your API key as a bearer token: `Bearer tc_…`.',
  },
  {
    name: 'X-Request-ID',
    type: 'string',
    description: 'Optional identifier for this request, echoed back in the response. See Request IDs.',
  },
];

export const REQUEST_BODY: Attribute[] = [
  {
    name: 'file',
    type: 'file',
    required: true,
    description:
      'The packaged InDesign template as a ZIP archive. In InDesign, choose File › Package, then compress the resulting folder.',
  },
];

export type EndpointDoc = {
  id: string;
  method: 'POST' | 'GET';
  path: string;
  /** False for endpoints that take no API key or upload. Defaults to true. */
  authenticated?: boolean;
  /** Short name for the nav and the section heading. */
  name: string;
  /** What it does, in a sentence or two. */
  summary: string;
  /** Optional remark shown below the summary, e.g. a behaviour worth knowing. */
  note?: string;
  response: { status: string; contentType: string; example: string };
  /** Response attributes. Empty for binary responses. */
  fields: Attribute[];
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
    name: 'Create a summary',
    summary:
      'Checks a packaged template and returns a customer-facing summary: each issue found, why it matters and how to resolve it in InDesign. The summary is returned as HTML and as plain text.',
    output: 'json',
    response: {
      status: '200 OK',
      contentType: 'application/json',
      example: json({
        run_id: '6f1c2b9e-0d4a-4c1e-9a51-3b2f7c8d9e10',
        template_name: 'Brochure',
        summary_version: 'deployment-01JA2X7Q9K',
        counts: { blockers: 4, warnings: 3, infos: 0 },
        html: '<p>Our review of “Brochure” found…',
        text: 'Our review of “Brochure” found…',
      }),
    },
    fields: [
      {
        name: 'run_id',
        type: 'string | null',
        description: 'Identifier of this check. `null` if it could not be recorded; the summary is still valid.',
      },
      { name: 'template_name', type: 'string', description: 'Name of the template, without the file extension.' },
      {
        name: 'summary_version',
        type: 'string',
        description: 'Version of the summary wording. Changes whenever its copy or structure changes.',
      },
      {
        name: 'counts',
        type: 'object',
        description: 'Number of distinct issues found, by severity.',
        children: [
          { name: 'blockers', type: 'integer', description: 'Issues likely to stop the template from working.' },
          { name: 'warnings', type: 'integer', description: 'Issues that may change how the template looks.' },
          { name: 'infos', type: 'integer', description: 'Items worth reviewing.' },
        ],
      },
      {
        name: 'html',
        type: 'string',
        description:
          'The summary as HTML, using only `<p>`, `<br>`, `<strong>`, `<ul>`, `<li>` and `<a>`. Built from escaped text, so it is safe to render.',
      },
      { name: 'text', type: 'string', description: 'The same summary as plain text, with links written out.' },
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
    name: 'Run a check',
    summary: 'Checks a packaged template and returns every issue found as JSON, with the customer summary.',
    note: 'A package that cannot be checked is not reported as an error. The response is `200` with `status` set to `rejected`, and the reason is included in `results`. Page previews (`results.pages[].preview`) are only rendered when you add `?previews=1`; otherwise they are `null`. The JSON Schema of `results` is `schema/results-v2.json` in the repository.',
    output: 'json',
    response: {
      status: '200 OK',
      contentType: 'application/json',
      example: json({
        run_id: '6f1c2b9e-0d4a-4c1e-9a51-3b2f7c8d9e10',
        status: 'completed',
        results: {
          schema_version: 2,
          template_name: 'Brochure.zip',
          issues: [
            {
              check: 'FONTS_INCLUDED',
              severity: 'error',
              subject: { kind: 'font', id: 'Minion Pro', name: 'Minion Pro' },
              location: { page_id: null, page_name: null, spread_id: null, item_id: null, bounds: null },
              facts: { missing_styles: ['Bold'], whole_family: false },
              text: null,
              detail: 'Missing styles: Bold',
            },
          ],
          checks: [],
          pages: [],
          text_boxes: {},
          subjects_checked: { font: 3 },
        },
        customer_summary: {},
      }),
    },
    fields: [
      { name: 'run_id', type: 'string | null', description: 'Identifier of this check.' },
      {
        name: 'status',
        type: 'string',
        description: '`completed`, or `rejected` if the package could not be checked.',
      },
      {
        name: 'results',
        type: 'object',
        description: 'The check results (results v2).',
        children: [
          {
            name: 'issues',
            type: 'array',
            description:
              'Every issue, in the order found: `check`, `severity` (`error`, `warning` or `info`), `subject` (what to fix: `kind`, `id`, `name`), `location` (page, item and its position), `facts` (the check’s structured data) and `detail` (display text; don’t parse it).',
          },
          {
            name: 'checks',
            type: 'array',
            description: 'Every check, with its plain-language title, explanation, fix steps per kind of subject and help article.',
          },
          { name: 'pages', type: 'array', description: 'The pages in document order, with size, preview and frame outlines.' },
          { name: 'text_boxes', type: 'object', description: 'The text of each text frame an issue is about.' },
          { name: 'subjects_checked', type: 'object', description: 'How many styles, text frames, fonts and images were checked.' },
        ],
      },
      {
        name: 'customer_summary',
        type: 'object | null',
        description: 'The same summary returned by Create a summary, with its sections, or `null` if it could not be generated.',
      },
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
    name: 'Export XML',
    summary: 'Checks a packaged template and returns the generated template XML as a ZIP archive.',
    output: 'zip',
    response: {
      status: '200 OK',
      contentType: 'application/zip',
      example: 'Content-Type: application/zip\nContent-Disposition: attachment; filename="Brochure-xml.zip"',
    },
    fields: [],
    errors: [
      'missing_file',
      'unauthorized',
      'access_denied',
      'file_too_large',
      'template_not_checkable',
      'check_in_progress',
      'rate_limited',
      'upload_failed',
      'check_failed',
      'export_failed',
    ],
  },
  {
    id: 'health',
    method: 'GET',
    path: '/health',
    name: 'Health check',
    summary:
      'Reports whether the service is up. Requires no API key and runs no check, so it is suitable for uptime monitoring and for waking the service before a batch of requests.',
    authenticated: false,
    output: 'json',
    response: {
      status: '200 OK',
      contentType: 'application/json',
      example: json({ status: 'ok', version: 'deployment-01JA2X7Q9K' }),
    },
    fields: [
      { name: 'status', type: 'string', description: 'Always `ok` when the service is reachable.' },
      { name: 'version', type: 'string | null', description: 'The deployed version, if known.' },
    ],
    errors: [],
  },
];

export const LIMITS: { name: string; value: string; exceeded: string }[] = [
  { name: 'Concurrent checks', value: '1 per user', exceeded: '`429` `check_in_progress`' },
  {
    name: 'Checks per hour',
    value: '50 per user, rolling window',
    exceeded: '`429` `rate_limited`, with `Retry-After`',
  },
  { name: 'Upload size', value: '200 MB', exceeded: '`413` `file_too_large`' },
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
  if (endpoint.method === 'GET') {
    if (language === 'curl') return `curl ${url}`;
    if (language === 'javascript') return [`const res = await fetch('${url}');`, 'const body = await res.json();'].join('\n');
    return ['import requests', '', `res = requests.get("${url}", timeout=10)`, 'body = res.json()'].join('\n');
  }
  const zip = endpoint.output === 'zip';
  if (language === 'curl') {
    return [
      `curl -X POST ${url} \\`,
      '  -H "Authorization: Bearer $TC_KEY" \\',
      `  -F "file=@Brochure.zip"${zip ? ' \\\n  -o Brochure-xml.zip' : ''}`,
    ].join('\n');
  }
  if (language === 'javascript') {
    return [
      zip ? "import { openAsBlob } from 'node:fs';\nimport { writeFile } from 'node:fs/promises';" : "import { openAsBlob } from 'node:fs';",
      '',
      'const form = new FormData();',
      "form.append('file', await openAsBlob('Brochure.zip'), 'Brochure.zip');",
      '',
      `const res = await fetch('${url}', {`,
      "  method: 'POST',",
      '  headers: { Authorization: `Bearer ${process.env.TC_KEY}` },',
      '  body: form,',
      '});',
      zip
        ? "await writeFile('Brochure-xml.zip', Buffer.from(await res.arrayBuffer()));"
        : 'const body = await res.json();',
    ].join('\n');
  }
  return [
    'import os',
    'import requests',
    '',
    'with open("Brochure.zip", "rb") as f:',
    '    res = requests.post(',
    `        "${url}",`,
    '        headers={"Authorization": f"Bearer {os.environ[\'TC_KEY\']}"},',
    '        files={"file": f},',
    '        timeout=600,',
    '    )',
    '',
    zip ? 'with open("Brochure-xml.zip", "wb") as out:\n    out.write(res.content)' : 'body = res.json()',
  ].join('\n');
}

export const AUTH_EXAMPLE = 'Authorization: Bearer tc_…';

export const ERROR_EXAMPLE = json({
  error: {
    code: 'rate_limited',
    message: 'Limit of 50 checks per hour reached.',
    request_id: '9b2e4c7a-51d8-4f0e-a3c6-2d7e8f1b0c94',
  },
});
