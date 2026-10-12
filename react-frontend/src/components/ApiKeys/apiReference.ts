/**
 * Everything the API docs tab says, as data. Keep it in step with the backend (python_backend/app/routes.py,
 * app/errors.py) and docs/API.md.
 */

export type ErrorTone = 'amber' | 'red';

export type ApiErrorDoc = {
  status: number;
  code: string;
  /** When it happens. */
  when: string;
  /** What the caller should do about it. */
  fix: string;
};

export const ERRORS: ApiErrorDoc[] = [
  {
    status: 400,
    code: 'missing_file',
    when: 'No file in the `file` field, or it’s empty.',
    fix: 'Attach the zipped package as `file`. We can’t check thin air.',
  },
  {
    status: 400,
    code: 'unsupported_file_type',
    when: 'The upload isn’t a .zip (only /summary is strict about this).',
    fix: 'Package it first: File > Package in InDesign, then zip the folder.',
  },
  {
    status: 401,
    code: 'unauthorized',
    when: 'Missing, invalid, expired or revoked key.',
    fix: 'Send `Authorization: Bearer tc_…`. Expired or revoked keys need replacing.',
  },
  {
    status: 403,
    code: 'access_denied',
    when: 'Signed in, but not an approved Template Checker user.',
    fix: 'Request access from the sign-in page.',
  },
  {
    status: 413,
    code: 'file_too_large',
    when: 'The upload is over 200 MB.',
    fix: 'Slim it down. Unused images in the Links folder are the usual suspects.',
  },
  {
    status: 422,
    code: 'template_not_checkable',
    when: 'The package couldn’t be checked: not a valid ZIP, no .idml file, password-protected…',
    fix: '`message` says why, in words you can pass straight to the customer.',
  },
  {
    status: 429,
    code: 'check_in_progress',
    when: 'You already have a check running.',
    fix: 'One at a time, please. Retry when the other one finishes.',
  },
  {
    status: 429,
    code: 'rate_limited',
    when: 'More than 50 checks in the last hour.',
    fix: 'Wait the number of seconds in the `Retry-After` header.',
  },
  {
    status: 500,
    code: 'upload_failed',
    when: 'The upload couldn’t be stored on our side.',
    fix: 'Retry. If it keeps happening, send us the request ID.',
  },
  {
    status: 500,
    code: 'check_failed',
    when: 'The checker crashed on this file.',
    fix: 'Retrying won’t help. Send us the request ID and we’ll take a look.',
  },
  {
    status: 500,
    code: 'summary_failed',
    when: 'The check ran, but the summary couldn’t be written.',
    fix: 'Send us the request ID. /run still returns the results.',
  },
  {
    status: 500,
    code: 'export_failed',
    when: 'The XML export couldn’t be created.',
    fix: 'Retry. If it keeps happening, send us the request ID.',
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
  summary: string;
  description: string;
  /** Example response body, or a description of a non-JSON body. */
  response: { contentType: string; example: string };
  fields: ResponseField[];
  /** Error codes this endpoint can return, in ERRORS order. */
  errors: string[];
  /** For the curl/JavaScript/Python examples. */
  output: 'json' | 'zip';
};

const COMMON_ERRORS = [
  'missing_file',
  'unauthorized',
  'access_denied',
  'file_too_large',
  'check_in_progress',
  'rate_limited',
  'upload_failed',
  'check_failed',
];

export const ENDPOINTS: EndpointDoc[] = [
  {
    id: 'summary',
    method: 'POST',
    path: '/summary',
    name: 'Customer summary',
    summary: 'Check a template and get a message for the customer.',
    description:
      'What to change in the InDesign file, why, and where, written to be reviewed by support and pasted into an Intercom reply. Show `html` to the person reviewing it; copy both `html` and `text` to the clipboard so Intercom keeps the formatting.',
    output: 'json',
    response: {
      contentType: 'application/json',
      example: JSON.stringify(
        {
          run_id: '6f1c2b9e-0d4a-4c1e-9a51-3b2f7c8d9e10',
          template_name: 'Brochure',
          summary_version: '2026-10-12',
          counts: { blockers: 4, warnings: 3, infos: 0 },
          html: '<p>We checked “Brochure” and found 4 issues…</p><p><strong>1. Font missing from the package</strong>…',
          text: 'We checked “Brochure” and found 4 issues…\n\n1. Font missing from the package\n…',
        },
        null,
        2,
      ),
    },
    fields: [
      {
        name: 'run_id',
        type: 'string | null',
        description:
          'The check’s id in Template Checker. Null if analytics was unavailable; the summary is still valid.',
      },
      {
        name: 'template_name',
        type: 'string',
        description: 'The template’s name, without the file extension.',
      },
      {
        name: 'summary_version',
        type: 'string',
        description: 'Version of the summary wording. Changes whenever the copy does.',
      },
      {
        name: 'counts',
        type: 'object',
        description: 'Distinct issues: `blockers`, `warnings` and `infos`.',
      },
      {
        name: 'html',
        type: 'string',
        description:
          'The message as HTML. Only <p>, <br>, <strong>, <ul>, <li> and <a>, which Intercom keeps when pasted.',
      },
      {
        name: 'text',
        type: 'string',
        description: 'The same message as plain text, with links written out.',
      },
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
    path: '/run',
    name: 'Check results',
    summary: 'Check a template and get every result as JSON.',
    description:
      'The full report the web app is built from: every issue with its page, frame and context, plus `check_guides` (plain-language copy per check) and `customer_summary`. A package that couldn’t be checked still returns 200, with the reason in the results.',
    output: 'json',
    response: {
      contentType: 'application/json',
      example: JSON.stringify(
        {
          type: 'data',
          content: {
            results: {
              template_name: 'Brochure.zip',
              fonts: {
                details: {
                  'Minion Pro': { errors: ['…'], warnings: [], infos: [] },
                },
                total_count: 3,
              },
              checks: ['…'],
              check_guides: {
                errors: {
                  FONTS_INCLUDED: {
                    title: 'Font missing from the package',
                    '…': '…',
                  },
                },
              },
              customer_summary: {
                summary_version: '2026-10-12',
                html: '…',
                text: '…',
                sections: ['…'],
              },
            },
          },
        },
        null,
        2,
      ),
    },
    fields: [
      {
        name: 'content.results',
        type: 'object',
        description:
          'Issues grouped by category (`par_styles`, `char_styles`, `text_boxes`, `fonts`, `images`, `general`), then by severity.',
      },
      {
        name: 'results.checks',
        type: 'array',
        description: 'Every check that ran, with its label and help article.',
      },
      {
        name: 'results.check_guides',
        type: 'object',
        description: 'Plain-language title, why and fix steps per check.',
      },
      {
        name: 'results.customer_summary',
        type: 'object | null',
        description: 'The same summary as /summary, plus line-by-line `sections`.',
      },
    ],
    errors: COMMON_ERRORS,
  },
  {
    id: 'run-and-download-xml',
    method: 'POST',
    path: '/run-and-download-xml',
    name: 'XML export',
    summary: 'Check a template and download its XML.',
    description:
      'Runs the same check, then returns the template’s generated XML as a ZIP download instead of the results.',
    output: 'zip',
    response: {
      contentType: 'application/zip',
      example:
        'Content-Type: application/zip\nContent-Disposition: attachment; filename="Brochure.zip"\n\n<binary ZIP>',
    },
    fields: [],
    errors: [...COMMON_ERRORS, 'export_failed'],
  },
];

export const LIMITS = [
  {
    value: '50',
    unit: 'checks / hour',
    detail: 'Per user, web app and keys together',
  },
  {
    value: '1',
    unit: 'at a time',
    detail: 'Per user. A second one gets a 429',
  },
  { value: '200', unit: 'MB per upload', detail: 'Bigger gets a 413' },
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
  if (language === 'curl') {
    return [
      `curl -X POST ${url} \\`,
      '  -H "Authorization: Bearer $TEMPLATE_CHECKER_KEY" \\',
      `  -F "file=@Brochure.zip"${endpoint.output === 'zip' ? ' \\\n  -o Brochure-xml.zip' : ''}`,
    ].join('\n');
  }
  if (language === 'javascript') {
    return [
      'const form = new FormData();',
      "form.append('file', file); // a File or Blob of the zipped package",
      '',
      `const res = await fetch('${url}', {`,
      "  method: 'POST',",
      '  headers: { Authorization: `Bearer ${process.env.TEMPLATE_CHECKER_KEY}` },',
      '  body: form,',
      '});',
      'if (!res.ok) {',
      '  const { error } = await res.json();',
      '  throw new Error(`${error.code}: ${error.message} (request ${error.request_id})`);',
      '}',
      endpoint.output === 'zip'
        ? 'const zip = await res.blob();'
        : endpoint.id === 'summary'
          ? 'const { html, text } = await res.json();'
          : 'const { content } = await res.json();',
    ].join('\n');
  }
  return [
    'import os',
    'import requests',
    '',
    `with open("Brochure.zip", "rb") as package:`,
    '    res = requests.post(',
    `        "${url}",`,
    '        headers={"Authorization": f"Bearer {os.environ[\'TEMPLATE_CHECKER_KEY\']}"},',
    '        files={"file": package},',
    '        timeout=600,',
    '    )',
    'if not res.ok:',
    '    error = res.json()["error"]',
    "    raise RuntimeError(f\"{error['code']}: {error['message']} (request {error['request_id']})\")",
    endpoint.output === 'zip'
      ? 'open("Brochure-xml.zip", "wb").write(res.content)'
      : endpoint.id === 'summary'
        ? 'summary = res.json()  # summary["html"], summary["text"]'
        : 'results = res.json()["content"]["results"]',
  ].join('\n');
}

export const ERROR_EXAMPLE = JSON.stringify(
  {
    error: {
      code: 'template_not_checkable',
      message:
        'The file couldn’t be checked: The file is not a valid ZIP archive. Please zip the package folder again and re-upload.',
      request_id: '9b2e4c7a1f0d4e8b8c3a5d6f7e8a9b0c',
    },
  },
  null,
  2,
);

export const CLIPBOARD_EXAMPLE = `await navigator.clipboard.write([
  new ClipboardItem({
    'text/html': new Blob([summary.html], { type: 'text/html' }),
    'text/plain': new Blob([summary.text], { type: 'text/plain' }),
  }),
]);`;
