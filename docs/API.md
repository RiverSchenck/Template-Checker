# Template Checker API

The same reference, with examples in cURL, JavaScript and Python, is in the app under **API keys > Docs**.

Base URL: `https://template-checker-test.fly.dev` (production backend).

## Authentication

Send an API key (create one on the **API keys** page) or a signed-in session token as a bearer token:

```
Authorization: Bearer tc_…
```

Keys act on behalf of the user who created them and can only call the check endpoints (`/v1/checks`,
`/v1/checks/summary`, `/v1/checks/xml`).

## Limits

Per user, across the web app and API keys together:

- **One check at a time.** A second request while one is running gets `429` with code `check_in_progress`.
- **50 checks per rolling hour.** Over the limit gets `429` with code `rate_limited` and a `Retry-After` header
  (seconds).
- **Uploads up to 200 MB.** Larger gets `413` with code `file_too_large`.

## Versions

The public API lives under `/v1`. The paths from before it still work, but every response on them carries
`Deprecation: @1791763200` (2026-10-12) and `Link: <new path>; rel="successor-version"`:

| Old path | Use instead |
|---|---|
| `POST /run` | `POST /v1/checks` (note the new response shape below) |
| `POST /summary` | `POST /v1/checks/summary` |
| `POST /run-and-download-xml` | `POST /v1/checks/xml` |
| `GET /test` | `GET /health` |

`GET /health` needs no auth and returns `{"status": "ok", "version": "…"}`.

## Request IDs

Every response has an `X-Request-ID` header. Send your own (letters, digits, `.` `_` `:` `-`, up to 128
characters) to correlate with your logs; otherwise one is generated. Include it when reporting a problem: it's in
the server logs for that request.

---

## `POST /v1/checks/summary`

Checks a packaged InDesign template and returns a message for the customer: what to change in the InDesign file,
why, and where. It's written to be reviewed and then sent to the customer, for example pasted into a help desk reply.

### Request

`multipart/form-data` with the package (InDesign: **File > Package**, then zip the folder) in the `file` field.

```bash
curl -X POST https://template-checker-test.fly.dev/v1/checks/summary \
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
| `html` | The message as HTML. Uses only `<p>`, `<br>`, `<strong>`, `<ul>`, `<li>` and `<a>`, which most rich-text editors keep when pasted. |
| `text` | The same message as plain text, with links written out (`Learn more: https://…`). |

Responses are sent with `Cache-Control: no-store`.

### Showing and copying it

Show `html` to the person reviewing it, so they see exactly what the customer will get. When they copy, put both
versions on the clipboard; rich-text editors use the HTML, anything else falls back to the text. This must run inside the
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

## `POST /v1/checks`

Same request as `/v1/checks/summary`. Returns `{run_id, status, results, customer_summary}`: `status` is `completed`,
or `rejected` when the package couldn't be checked (the reason is in `results`; still a 200).

`results` is results v2; its JSON Schema is [`schema/results-v2.json`](../schema/results-v2.json):

- `schema_version`: `2`.
- `issues`: every issue, in the order found: `{check, severity, subject, location, facts, text, detail}`.
  - `check` is a key from `checks`; `severity` is `error`, `warning` or `info`.
  - `subject` is what to fix: `{kind, id, name}`, where `kind` is `paragraph_style`, `character_style`, `text_frame`,
    `image`, `image_frame`, `font`, `page_item` or `document`.
  - `location` is where it is: `{page_id, page_name, spread_id, item_id, bounds}`, any of them `null`.
  - `facts` holds the check's structured data (e.g. `{size_mb}` for a large image). `detail` is short display text:
    show it, don't parse it.
- `checks`: every check, with its wording: `{key, severity, subject_kinds, title, why, fix, help_article, is_check}`.
  `fix` lists the steps in InDesign per subject kind. `is_check` is false for package and parsing failures.
- `pages`: the pages in document order, with size (points), `preview` and frame outlines.
- `text_boxes`: the text of each text frame an issue is about, by subject id.
- `subjects_checked`: how many of each kind the document has, e.g. `{"paragraph_style": 12}`.

`customer_summary` is the summary as above (`summary_version`, `counts`, `html`, `text`), plus `sections`, the
message line by line (`{key, title, problem_id, lines: [{kind, text, href?}]}`), which the web app's review view is
built from. `null` if the summary couldn't be written; the results are still returned.

Page previews (`results.pages[].preview`, a base64 JPEG per page) are left out unless you ask with `?previews=1`
(`POST /v1/checks?previews=1`): rendering them is most of a check's time. Without it, `preview` is `null`; the page
sizes and frame outlines are always there.

## `POST /v1/checks/xml`

Same request. Runs the same check, then returns the template's generated XML as a ZIP download
(`Content-Type: application/zip`) instead of the results.

---

## Errors

Every error, from every endpoint, has the same shape:

```json
{ "error": { "code": "template_not_checkable", "message": "The file couldn't be checked: …", "request_id": "…" } }
```

Branch on `code`; `message` is written for people and may change. `request_id` matches the `X-Request-ID` header.
4xx means something to fix on your side, 5xx means ours.

| Status | `code` | When |
|---|---|---|
| 400 | `missing_file` | No `file` field, or it's empty. |
| 400 | `unsupported_file_type` | The file isn't a `.zip` (`/v1/checks/summary` only). |
| 401 | `unauthorized` | Missing, invalid, expired or revoked token or key. |
| 403 | `access_denied` | Signed in, but not an approved Template Checker user. |
| 413 | `file_too_large` | Upload over 200 MB. |
| 422 | `template_not_checkable` | `/v1/checks/summary` and `/v1/checks/xml`: the package couldn't be checked (not a valid ZIP, no `.idml` file, password-protected, damaged `.idml`…). `message` says why; pass it on to the customer. `/v1/checks` returns 200 with `status: "rejected"` instead. |
| 429 | `check_in_progress` | You already have a check running. |
| 429 | `rate_limited` | Hourly limit reached; see `Retry-After`. |
| 500 | `upload_failed` | The upload couldn't be stored. Retry. |
| 500 | `check_failed` | The checker crashed on this file. Retrying won't help; report it with the request ID. |
| 500 | `summary_failed` | `/v1/checks/summary` only: the check ran but the summary couldn't be written. |
| 500 | `export_failed` | `/v1/checks/xml` only: the XML export couldn't be created. |

---

The web app's own endpoints (admin, API keys, analytics, feedback) use the same shape with these general codes:
`invalid_request` (400), `forbidden` (403), `not_found` (404), `conflict` (409, e.g. already approved, or removing
yourself), `service_unavailable` (503) and `internal_error` (500).

---

## For maintainers: changing the summary

Each check's title, why and fix steps are written once, in the catalogue (`python_backend/src/results/catalogue.py`);
the summary's own sentences are in `python_backend/app/customer_summary/summary.py`. The web app shows what the
backend sends and has no copy of its own.

Expected summaries for every golden checker result, plus hand-built edge cases (`testing/golden/summary_cases/`), are
stored in `testing/golden/summaries/`. After changing the wording, or when the checker's golden results change:

1. `UPDATE_SUMMARY_GOLDENS=1 pytest testing/unit_tests/customer_summary/test_summary_goldens.py`
2. Review the diff in `testing/golden/summaries/`: it's exactly what customers will see differently.
3. Bump `SUMMARY_VERSION` in `app/customer_summary/payload.py`.
