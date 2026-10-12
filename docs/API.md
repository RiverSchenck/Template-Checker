# Template Checker API

The same reference, with examples in cURL, JavaScript and Python, is in the app under **API keys > Docs**.

Base URL: `https://template-checker-test.fly.dev` (production backend).

## Authentication

Send an API key (create one on the **API keys** page) or a signed-in session token as a bearer token:

```
Authorization: Bearer tc_…
```

Keys act on behalf of the user who created them and can only call the check endpoints (`/run`, `/summary`,
`/run-and-download-xml`).

## Limits

Per user, across the web app and API keys together:

- **One check at a time.** A second request while one is running gets `429` with code `check_in_progress`.
- **50 checks per rolling hour.** Over the limit gets `429` with code `rate_limited` and a `Retry-After` header
  (seconds).
- **Uploads up to 200 MB.** Larger gets `413` with code `file_too_large`.

## Request IDs

Every response has an `X-Request-ID` header. Send your own (letters, digits, `.` `_` `:` `-`, up to 128
characters) to correlate with your logs; otherwise one is generated. Include it when reporting a problem: it's in
the server logs for that request.

---

## `POST /summary`

Checks a packaged InDesign template and returns a message for the customer: what to change in the InDesign file,
why, and where. It's written to be reviewed by support and pasted into an Intercom reply.

### Request

`multipart/form-data` with the package (InDesign: **File > Package**, then zip the folder) in the `file` field.

```bash
curl -X POST https://template-checker-test.fly.dev/summary \
  -H "Authorization: Bearer tc_…" \
  -F "file=@Brochure.zip"
```

### Response `200`

```json
{
  "summary_version": "2026-10-12",
  "run_id": "6f1c2b9e-…",
  "template_name": "Brochure",
  "counts": { "blockers": 4, "warnings": 3, "infos": 0 },
  "html": "<p>We checked “Brochure” and found 4 issues…</p><p><strong>Likely causing the problems</strong></p>…",
  "text": "We checked “Brochure” and found 4 issues…\n\nLikely causing the problems\n\n1. Text frame has no paragraph style\n…"
}
```

| Field | Meaning |
|---|---|
| `summary_version` | Version of the summary wording. Changes whenever the copy or structure changes. |
| `run_id` | The check's id in Template Checker analytics. `null` if analytics was unavailable; the summary is still valid. |
| `template_name` | The template's name, without the file extension. |
| `counts` | Distinct issues by severity: `blockers` (likely causing the problems), `warnings` (may change how it looks), `infos` (worth a check). |
| `html` | The message as HTML. Uses only `<p>`, `<br>`, `<strong>`, `<ul>`, `<li>` and `<a>`, which Intercom's composer keeps when pasted. |
| `text` | The same message as plain text, with links written out (`Learn more: https://…`). |

Responses are sent with `Cache-Control: no-store`.

### Showing and copying it

Show `html` to the person reviewing it, so they see exactly what the customer will get. When they copy, put both
versions on the clipboard; Intercom uses the HTML, anything else falls back to the text. This must run inside the
click handler (browsers only allow clipboard writes from a user action):

```js
await navigator.clipboard.write([
  new ClipboardItem({
    'text/html': new Blob([summary.html], { type: 'text/html' }),
    'text/plain': new Blob([summary.text], { type: 'text/plain' }),
  }),
]);
```

`html` is built by the server from escaped text; it's safe to insert as HTML in your own page.

### Errors

See [Errors](#errors) below; every endpoint answers them the same way.

---

## `POST /run`

Same request as `/summary`. Returns the full check results under `content.results`, including two fields the web app
uses:

- `customer_summary`: the summary as above (`summary_version`, `counts`, `html`, `text`), plus `sections`, the
  message line by line (`{key, title, problem_id, lines: [{kind, text, href?}]}`), which the web app's review view is
  built from. `null` if the summary couldn't be written; the results are still returned.
- `check_guides`: the plain-language copy for each check that ran or found something, as
  `{severity: {check key: {title, why, fix, subject}}}`.

## `POST /run-and-download-xml`

Same request. Runs the same check, then returns the template's generated XML as a ZIP download
(`Content-Type: application/zip`) instead of the results.

---

## Errors

Every error from the check endpoints (`/summary`, `/run`, `/run-and-download-xml`) has the same shape:

```json
{ "error": { "code": "template_not_checkable", "message": "The file couldn't be checked: …", "request_id": "…" } }
```

Branch on `code`; `message` is written for people and may change. `request_id` matches the `X-Request-ID` header.
4xx means something to fix on your side, 5xx means ours.

| Status | `code` | When |
|---|---|---|
| 400 | `missing_file` | No `file` field, or it's empty. |
| 400 | `unsupported_file_type` | The file isn't a `.zip` (`/summary` only). |
| 401 | `unauthorized` | Missing, invalid, expired or revoked token or key. |
| 403 | `access_denied` | Signed in, but not an approved Template Checker user. |
| 413 | `file_too_large` | Upload over 200 MB. |
| 422 | `template_not_checkable` | `/summary` only: the package couldn't be checked (not a valid ZIP, no `.idml` file, password-protected…). `message` says why; pass it on to the customer. `/run` returns 200 with the reason in the results instead. |
| 429 | `check_in_progress` | You already have a check running. |
| 429 | `rate_limited` | Hourly limit reached; see `Retry-After`. |
| 500 | `upload_failed` | The upload couldn't be stored. Retry. |
| 500 | `check_failed` | The checker crashed on this file. Retrying won't help; report it with the request ID. |
| 500 | `summary_failed` | `/summary` only: the check ran but the summary couldn't be written. |
| 500 | `export_failed` | `/run-and-download-xml` only: the XML export couldn't be created. |

---

## For maintainers: changing the summary

The summary and the per-check copy are written in one place: `python_backend/app/customer_summary/`
(`check_guides.py` for each check's title, why and fix steps; `summary.py` for the message). The web app shows what
the backend sends and has no copy of its own.

Expected summaries for every golden checker result, plus hand-built edge cases (`testing/golden/summary_cases/`), are
stored in `testing/golden/summaries/`. After changing the wording, or when the checker's golden results change:

1. `UPDATE_SUMMARY_GOLDENS=1 pytest testing/unit_tests/customer_summary/test_summary_goldens.py`
2. Review the diff in `testing/golden/summaries/`: it's exactly what customers will see differently.
3. Bump `SUMMARY_VERSION` in `app/customer_summary/payload.py`.
