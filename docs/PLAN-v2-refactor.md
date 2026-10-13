# Plan: v2 refactor — document model, pipeline, results format, tests

Status: **approved by River 2026-10-13** (decisions in §3 confirmed, with D3 decided pair by pair). Written
against `main` at `8fb8d2e` (after #63), from three audits of the backend (document model, pipeline, consumers +
tests). Every finding below was checked against that commit. Open question for later: whether Note/Footnote text
is checked (see PR 2.3).

This file is the brief for the agent doing the work. Read §0 and §3 before touching anything.

---

## 0. How to work (rules for the executing agent)

1. **One PR at a time, branched from the latest `main`, in its own git worktree** (`.claude/worktrees/<name>`).
   Never stack PRs; never switch branches in the main checkout (another session may be using it). Wait for River to
   merge before starting the next PR.
2. **Every PR states its expected golden diff before the code is written**, and proves it after:
   - *Refactor PRs* (no behaviour change): `python -m testing.golden` reports **0 changed**, summary goldens unchanged.
   - *Behaviour PRs*: write the expected change first (which packages, which issues appear/disappear and why), run
     the issue-diff (see §6.4) and show that the actual diff is exactly that. Then verify each changed item against
     the package's own files (Styles.xml, stories, fonts…) with code that doesn't share the checker's logic.
3. **Existing tests are River's.** Change one only when this plan lists the change, or after showing River the
   failure and the evidence. List every changed expectation in the PR description with its reason. Approval of this
   plan approves the test changes listed in it — nothing else.
4. **No bloat.** No new layer, class or dependency unless it removes more code or confusion than it adds. No
   speculative abstraction (no plugin systems, no DI containers, no async). Performance work only where §2.4's
   measurements say it matters.
5. **Copy style**: plain, sentence-case UI text; the checker philosophy is in `docs/frontify-rule-checks.md` (flag
   InDesign settings that differ from Frontify's behaviour). Adobe Fonts copy: "not supported, use a desktop
   version" (rule: only flag when not packaged).
6. **Local backend runs log to production Supabase.** Tests must be hermetic (Phase 0 enforces it); don't run the
   app against real data without River.
7. Commit messages and PR bodies end with the attribution lines from the session's instructions. No auto-merge.
8. Run tests with the repo venv: `cd python_backend && venv/bin/python -m pytest -q -p no:cacheprovider`. In a
   worktree, create the empty `testing/unit_tests/kerning_check/fail_data/` first (git doesn't track empty dirs)
   until PR 0.2 fixes it.

---

## 1. Goals, non-goals, principles

**Goals**
- A document model checks can read without knowing how IDML is parsed; every XML file parsed once; style values
  resolved once.
- Correct text and object coverage: hyperlinks, tagged text, tracked changes, special characters, inline/anchored
  objects, notes/footnotes/table cells.
- A small, explicit pipeline: intake → load → check → serialize, with clean temp-file handling and honest
  rejected/failed outcomes.
- **Results format v2**: a flat list of issues with a typed subject, a location and structured facts; one catalogue
  of checks with the only copy of the wording. Consumers stop re-grouping nested JSON and regex-parsing prose.
- Tests that pin specifics (subject, page, facts), not counts; hermetic; run in CI on every PR; deploys gated on them.

**Non-goals**
- No new framework, no async/job queue, no microservices. Requests stay synchronous.
- No rule changes beyond the bugs listed here (rules live in `docs/checker-rules.md`).
- No git-history rewrite (the 930 MB pack stays; see [D8]).
- API stays at `/v1` (no external users yet — River, 2026-10-12); the response changes in place, with a
  `schema_version`.

**Principles**
- Data in, data out: parsers produce immutable dataclasses; derived facts are computed once in the loader; nothing
  is patched onto objects after construction.
- "No value" is `None` everywhere inside; only the JSON layer decides how to write it.
- One source of truth per fact: one catalogue for copy, one place for page attribution, one hardened XML parser.

---

## 2. Current state (verified at `8fb8d2e`)

### 2.1 Bugs
| # | Bug | Where |
|---|-----|-------|
| B1 | Runs inside `HyperlinkTextSource`, `XMLElement`, `Change` are dropped (runs found as direct children only; paragraphs at any depth). | `classes/StoryData.py:28,35` |
| B2 | Text nested in runs or after a processing instruction (`<?ACE n?>`, special characters) is lost (`.text` of direct `Content` only). False EMPTY_TEXT_FRAME, missed checks. | `classes/StoryCharacterData.py:34-36` |
| B3 | Inline/anchored objects in stories (Rectangle/TextFrame/Group/Image/Link inside story XML) are never parsed: their images are reported "unused", no frame/image checks run on them. | stories vs `SpreadData` |
| B4 | Note/Footnote/Cell paragraph ranges are flattened into body text; note text is checked as body text; style grouping changes. | `StoryData.py:28` |
| B5 | Flipped/skewed Oval and Polygon image frames are reported twice (image check + page-item check). | `classes/SpreadData.py:118` |
| B6 | Run `Properties` overrides are read inside the attribute loop: re-run per attribute, skipped when the run has no attributes. | `StoryCharacterData.py:43-51` |
| B7 | `PropertyBase` decides style kind by substring (`"ParagraphStyle" in id`) and raises on a `None` style id. | `classes/PropertyBase.py:15` |
| B8 | A text frame missing `PreviousTextFrame`/`NextTextFrame` counts as linked. | `classes/TextFrame.py:25` |
| B9 | XML export of a rejected upload returns 500 `export_failed` instead of 422 with the reason. | `app/routes.py:997-1001` |
| B10 | Corrupt XML inside a valid IDML, or an exception in any check, ends as 500/"failed" with no results. Missing-file rejections show developer text ("Fonts.XML does not exist"). Server faults (mkdir, catch-all unzip) are reported as user "rejected". | `classes/FrontifyChecker.py` intake |
| B11 | `.zip` check is case-sensitive in the checker, case-insensitive in the route. | `FrontifyChecker.py:~103` vs `routes.py:~900` |
| B12 | Kerning has no working per-check test: its file runs `VARIABLE_FONT_CHECK`, `fail_data/` is empty and untracked (fresh clone errors at collection), `test_zip_check_pass` defined twice. | `testing/unit_tests/kerning_check/` |

### 2.2 Security
| # | Issue | Where |
|---|-------|-------|
| S1 | XML parsed with `huge_tree=True` (libxml2 limits off) and entity resolution on; no shared hardened parser ("billion laughs" in a Spread). | `parsers/SpreadsParser.py:22`, `helpers/page_geometry.py:81`, every other `ET.parse` |
| S2 | `designmap.xml` `src` paths joined unvalidated (can read outside the run folder). | `helpers/page_geometry.py:~74` |
| S3 | Response includes `output_folder`, a server filesystem path. | `results/serialize.py:29` |
| S4 | Temp data lives in `src/data` inside the code tree, uploads in a CWD-relative `uploads/`, XML zips in system tmp; nothing sweeps runs killed by timeout/OOM (81 MB of orphans locally). | `FrontifyChecker.py:29`, `app/utils.py:25` |
| S5 | One auth test reaches the real Supabase from `.env` (suite not hermetic). | `testing/unit_tests/auth_check/test_auth_check.py:6-17` |

### 2.3 Structure
- `ParsedDocument` is a bag of parsers; checks reach into `spreads_parser.spreads_obj_list`,
  `stories_parser.stories_data_list`, etc. Objects are patched after construction (`parent_story_obj`,
  `parent_text_frame_id`, `parent_link_data_id`, font "used" sets filled during story parsing).
- Styles.xml parsed twice; every spread parsed twice (SpreadsParser + PageGeometryIndex); ~9 tree passes per spread;
  7 uncached BasedOn walks per paragraph range, more per run; linear font lookups.
- Spread order: SpreadsParser uses file-name order, PageGeometryIndex designmap order.
- `FrontifyChecker` (~470 lines): `parse_xml` is a 135-line god method; vestigial states (`EXIT`,
  `current_state`, the `UNZIP_IDML` hand-off via `idml_problem`); dead methods; `run_check` ignores `self.checks`.
- Dead code: `find_char_property`, `find_property`, `find_override`, `all_properties`, `geometric_bounds` ×2,
  `link_id`, `image_extension`, `UsedFontFamily.is_adobe_font`, `font_error`, `fonts`/`font_type`,
  MetadataParser's JPEG writes and unused Preview fields, ~50 lines of commented-out code.
- Results JSON is nested (section → identifier → severity → items); 10+ consumers re-walk it.
  `customer_summary/report.py` is a Python copy of the frontend's `buildReport.ts`. `identifier` means a style name,
  story id, frame id, font, file name or `"Tag:Self"` depending on section; the frontend splits on `_par_`.
- Five regexes parse check prose back into data (`app/customer_summary/summary.py:49,63,113,119,125`).
- Copy in 5–6 places (classifier `message`, `check_guides.py`, frontend constants, analytics sample data, docs);
  the report shows the guide *and* the classifier message side by side (`ProblemList.tsx:172-181`).
- Checks split only by which report section they're listed in (same rule, same fix): `TEXT_WRAP`/
  `TEXT_WRAP_ITEM`, `OBJECT_STYLE_TEXT`/`OBJECT_STYLE_IMAGE`, `IMAGE_TRANSFORMATION_IMAGE`/`_CONTAINER`/
  `PAGE_ITEM_TRANSFORMATION`, `PARAGRAPH_STYLE`/`PARAGRAPH_STYLE_TEXT_BOX` (merged per D3). Pairs whose fix lives
  in a different place stay separate: `KERNING`/`KERNING_CHAR` and `FILL_TINT`/`FILL_TINT_CHAR` (paragraph style
  vs character style options).
- Frontend "classic view" (~1,150 lines) still reachable via a toggle; `chart-area-interactive.tsx` unused.

### 2.4 Performance (measured on the largest test packages)
Totals 28–417 ms per package. Checks: < 1 ms total. Time goes to: PDF preview rendering (up to ~220 ms, also for
endpoints that discard previews), parsing spreads twice (~75 ms each on RollUp_Bad), unzip I/O. Previews are
~225 KB of base64 per page in the JSON. **Only these are worth optimising.**

### 2.5 Tests today
973 backend tests (~29 s): 187 result goldens, 194 summary goldens, oracle (11 rules), 117 PackageBuilder tests,
21 copy-pasted per-check files asserting classifier *counts* (unknown zips are skipped, not failed), 22 e2e
count tests, app/auth/analytics tests. Frontend: vitest, 34 tests, no `typecheck` script. **No CI** — the two
workflows only deploy. Corpus: 187 zips, 1.5 GB, 77 byte-identical duplicates.

---

## 3. Decisions (confirmed by River 2026-10-13)

| # | Decision | Default |
|---|----------|---------|
| D1 | Results format v2 shape | As in §4.3. |
| D2 | Single source of copy | The **catalogue** (§4.4): title/why/fix from `check_guides.py` win; classifier `message` is dropped. Help links kept. |
| D3 | Merge split checks | Rule: **merge when the fix is the same and only the item kind differs; keep separate when the fix lives somewhere else.** Mapping in §3.1. |
| D4 | Analytics history | One-time data migration rewriting old `validation_type`/`category` values to the new keys using §3.1 (backup first). Old retired keys (rotation warnings) stay as-is. |
| D5 | Classic view | Delete it (and `chart-area-interactive.tsx`). |
| D6 | Previews | Rendered only for the web app's `/run`; skipped for `/summary`, `/v1/checks/xml` and `/v1/checks` unless `?previews=1`. Still inline base64 in v2. |
| D7 | Contract definition | Pydantic models (already a dependency) define v2; a JSON Schema is generated from them and committed; TypeScript types generated from the schema (`json-schema-to-typescript`, dev dependency). |
| D8 | Test corpus | Deduplicate zips into `testing/packages/` (content-addressed names kept readable); no history rewrite or LFS now. |
| D9 | Package names | `src/model/` (document model), `src/pipeline/` (intake, load, run, workspace, previews), `src/checks/`, `src/results/`. |
| D10 | Analytics stage names | Kept exactly (`UNZIP_PACKAGE`, `UNZIP_IDML`, `PARSE_XML`, every `*_CHECK`, `OTHER_CHECKS`, `RESULTS`), pinned by a test. `EXIT` removed. |

### 3.1 Check keys in v2 (D3)

| v2 check | From (v1) | Subject kind(s) | Why |
|----------|-----------|-----------------|-----|
| `KERNING` | `KERNING` | paragraph_style | Fixed in Paragraph Style Options. |
| `KERNING_CHAR` | `KERNING_CHAR` | character_style | Fixed in Character Style Options — a different issue. |
| `FILL_TINT` | `FILL_TINT` | paragraph_style | Paragraph style. (Drop the "(Beta)" label.) |
| `FILL_TINT_CHAR` | `FILL_TINT_CHAR` | character_style | Character style; its own tip (tint swatch). |
| `TEXT_WRAP` | `TEXT_WRAP` + `TEXT_WRAP_ITEM` | text_frame, image, page_item | Same fix (Text Wrap panel → No Text Wrap). |
| `OBJECT_STYLE` | `OBJECT_STYLE_TEXT` + `OBJECT_STYLE_IMAGE` | text_frame, image | Same steps; the fix names [Basic Text Frame] or [Basic Graphics Frame] by kind. |
| `TRANSFORMATION` | `IMAGE_TRANSFORMATION_IMAGE` + `IMAGE_TRANSFORMATION_CONTAINER` + `PAGE_ITEM_TRANSFORMATION` | image, image_frame, page_item | Clear Transformations on the flipped/skewed thing; the guide covers double-clicking into a frame for the image. Facts: `{kind: flip|skew, rotation_deg}`. |
| `PARAGRAPH_STYLE` | `PARAGRAPH_STYLE` + `PARAGRAPH_STYLE_TEXT_BOX` | text_frame | Same fix; `facts.whole_frame` says whether the whole frame is unstyled. |

Every other check keeps its key. Subject kinds therefore include `image_frame` (§4.3).

---

## 4. Target architecture

### 4.1 Layout
```
python_backend/src/
  model/            # IDML -> Document (pure data, no I/O except in load)
    xml.py          one hardened parser (no entities, no network, huge_tree only where needed, bounded)
    styles.py       StyleSheet: Style(kind, id, name, based_on, props); resolve(style, prop) memoized
    text.py         Story / Paragraph / Run; one recursive story walker (fixes B1-B4)
    layout.py       Spread, Page, PageItem, TextFrame, GraphicFrame (spreads and masters, same code)
    assets.py       Link, PackagedImage, PackagedFont, FontCatalog (Fonts.xml)
    document.py     Document (frozen): everything above + indexes built once
    subject.py      Subject(kind, id, name) factories
    load.py         load_document(intake) -> Document  (the only I/O; validates required files first)
  pipeline/
    workspace.py    run_workspace() context manager (tempfile under WORK_DIR), sweep_stale()
    intake.py       open_package(upload, ws) -> Intake | raises Rejected(stage, reason)
    previews.py     page_previews(doc, intake) (XMP thumbnails in memory + package PDF)
    run.py          run(upload, ws, *, previews) -> RunOutcome(status, stage, results, xml_dir)
  checks/           CHECKS registry (unchanged idea); checks read Document, report(subject, facts)
  results/          catalogue.py (checks + copy), issue.py, results.py, serialize.py (v2), layout.py (deleted
                    once Document provides pages/positions)
```
`classes/`, `parsers/`, `document.py` (old), `FrontifyChecker.py` are deleted by the end. `States` moves to
`checks/stages.py`.

### 4.2 Document model (what checks see)
- `doc.styles.resolve(style_id, prop) -> Resolved(value, source)`; `Run.effective(prop)` /
  `Paragraph.effective(prop)` (text → character style → paragraph range → paragraph style), all memoized.
- `doc.stories` → `Story(id, frame_ids, page_id, paragraphs)`; `Paragraph(style, local, overrides, runs, text,
  container='body'|'table'|'note'|'footnote')`; `Run(style, local, overrides, text, has_table, anchored_items)`.
- `doc.text_frames()`, `doc.graphic_frames()`, `doc.page_items()`, `doc.masters`, `doc.links`,
  `doc.packaged_images`, `doc.packaged_fonts`, `doc.font_catalog`, `doc.used_faces`, `doc.bleed`.
- `doc.page_of(item_id)` — **one** page attribution (geometry first, then spread's first page).
- `doc.text_of(story_or_frame_id)`, `doc.totals` (for section counts/analytics).
- Style display names are kept (`Name`), so subjects show "Headings: H1", not `Headings%3aH1`.

### 4.3 Results format v2 (D1)
```jsonc
{
  "schema_version": 2,
  "template_name": "Flyer.zip",
  "issues": [
    {
      "check": "KERNING",                    // catalogue key
      "severity": "error",                   // error | warning | info
      "subject": {"kind": "paragraph_style", "id": "ParagraphStyle/Body", "name": "Body"},
      "location": {"page_id": "u123", "page_name": "2", "spread_id": "u10", "item_id": "u4f2",
                   "bounds": {"page_id": "u123", "x": 10, "y": 20, "width": 100, "height": 40, "kind": "TextFrame"}},
      "facts": {"value": "Optical", "inherited_from": "ParagraphStyle/[No paragraph style]"},
      "text": ["Hello world"],               // the text it's about, when relevant
      "detail": "Kerning is Optical"         // short display prose (never parsed)
    }
  ],
  "subjects_checked": {"paragraph_style": 12, "character_style": 4, "text_frame": 9, "font": 3, "image": 6},
  "pages": [{"id": "u123", "name": "2", "index": 1, "spread_id": "u10", "width": 612, "height": 792,
             "preview": "<base64>|null", "frames": [...]}],
  "text_boxes": {"<story or frame id>": {"content": "...", "page_id": "u123"}},
  "checks": [ /* catalogue entries, §4.4 */ ]
}
```
- Subject kinds: `paragraph_style`, `character_style`, `text_frame`, `story`, `image`, `image_frame`, `font`,
  `page_item`, `document`. The frontend's `SUBJECT_LABELS` and `check_guides` subject kinds map onto these.
- `facts` per check are defined in the catalogue (typed in the pydantic model), e.g. AUTO_SIZE
  `{auto_size, no_line_breaks}`, LARGE_IMAGE `{size_mb}`, MASTERPAGE `{elements: {kind: count}}`, DOCUMENT_BLEED
  `{bleed: {top, bottom, inside, outside}}` (pt, may be negative), PARAGRAPH_STYLE `{whole_frame, whitespace_only}`,
  OVERRIDE `{overrides: {...}}`, FONTS_INCLUDED `{missing_styles: [...]}`, TRANSFORMATION `{kind: flip|skew,
  rotation_deg}`.
- Removed: `output_folder` (S3), `validation_classifiers`, `text_box_data`, `spread_to_pages`, the six section
  keys, `total_count` (→ `subjects_checked`), `page_layouts` (→ `pages`).
- `/v1/checks` keeps wrapping it as `{run_id, status, results}`; `check_guides` disappears (the catalogue is in
  `results.checks`); `customer_summary` stays.

### 4.4 Catalogue (D2)
`src/results/catalogue.py` — one entry per check, the only copy of its wording:
`key, severity, subject_kinds, title, why, fix[] (may vary by subject kind), help_article, facts model, is_check`.
Keys per §3.1. Built from today's
`classifiers.py` + `app/customer_summary/check_guides.py` (guides win). The Analytics page (`describe_issue`), the
report, the summary and the API docs all read it.

---

## 5. Phases and PRs

Each PR: **scope · steps · expected golden diff · tests · done when**. Sizes: S (< 300 lines), M, L.

### Phase 0 — Safety net first (no behaviour change)

**PR 0.1 CI + hermetic tests (S).**
- `.github/workflows/test.yml` on PRs and pushes: backend pytest (venv from requirements), frontend
  `npm ci && vitest run && tsc --noEmit && eslint .`. Deploy workflows run only after it passes (`needs`/
  `workflow_run`). Cache pip/npm; checkout without LFS (corpus is plain git).
- `testing/conftest.py`: autouse fixture that blanks `SUPABASE_URL`/`SUPABASE_KEY` and makes
  `get_supabase_client` raise unless a test patches it (fixes S5; fix `test_auth_check.py` fixture to patch
  `is_admin`).
- `react-frontend/package.json`: `"typecheck": "tsc --noEmit"`, `"test:ci": "vitest run"`.
- Golden diff: none. Done when CI is green on the PR and a deliberately failing commit blocks deploy (show it).

**PR 0.2 Fix the kerning test (S).** Real kerning fail packages (build with `PackageBuilder` or a tracked zip),
correct state, remove the shadowed `test_zip_check_pass` in all 18 files, rename `hyphenation_check`'s
`test_masterpage_*`. Unknown zips **fail** instead of skip. Golden diff: none. *Lists every changed test.*

**PR 0.3 Fixtures that lock in the coverage bugs (S).** PackageBuilder support for story-level
`HyperlinkTextSource`, `XMLElement`, `Change`, `<?ACE?>` PIs, inline image (Rectangle+Image+Link inside a run),
anchored TextFrame, Note, Footnote, Table cells. Tests asserting the **correct** behaviour, marked
`xfail(strict=True, reason="B1…B4, fixed in PR 2.3")`. Golden diff: none.

**PR 0.4 Issue projection harness (S).** `testing/golden/projection.py`: projects a results JSON (v1 now, v2
later) into a canonical set of `(severity, check_family, subject_id, item_id, page_id, normalized facts/detail)`.
Used by every behaviour PR's issue-diff and by the v2 switch (PR 5.3). Golden diff: none.

### Phase 1 — Quick fixes (behaviour, small, independent)

**PR 1.1 XML hardening + path containment (S).** `model/xml.py` (or `helpers/xml.py` until Phase 2): one
`parse(path, *, large=False)` with `resolve_entities=False, no_network=True`, `huge_tree` only for spreads/stories
/masters (needed for pasted graphics) with an explicit size cap; designmap `src` contained to the IDML folder
(S1, S2). Tests: billion-laughs spread rejected cleanly; `../` src ignored. Golden diff: none.

**PR 1.2 Honest outcomes (S).** B9 (XML export of a rejected upload → 422 with reason), B10 (corrupt XML →
`rejected` "The .idml file is damaged — export it again from InDesign"; check exceptions → `failed` with stage;
server faults → `failed`, not `rejected`; plain-language messages for missing Spreads/Fonts/Styles/Preferences),
B11 (case-insensitive `.zip`). Golden diff: wording of the four missing-file rejections only (no golden package
hits them — confirm 0).

### Phase 2 — Document model (`src/model/`)

Order: build the new model **beside** the old one, prove parity, switch checks over, delete the old classes.

**PR 2.1 Styles (M).** `model/styles.py`: parse Styles.xml once (paragraph, character, object styles), keep
`Name`, `resolve()` memoized, cycle-safe, `$ID/` handled once, `None` for no value (fixes B7). Parity test: for
every package and every (style, property) the checks use, `resolve` == old `PropertyBase`. Golden diff: none.

**PR 2.2 Layout + assets (M).** `model/layout.py`, `model/assets.py`: spreads and masters through one code path,
designmap order, single tree pass per spread; geometry built from the same trees (no second parse). Links with
their frame; packaged images/fonts; FontCatalog with faces (dict lookups). Parity tests against SpreadData /
PageGeometryIndex / SourceFoldersParser outputs. Golden diff: none (spread order: confirm no output depends on it;
if it does, document the diff).

**PR 2.3 Text + the coverage fixes (L, behaviour).** `model/text.py`: one recursive walker — descends
`HyperlinkTextSource`/`XMLElement`/`Change`; text via `itertext` incl. PI tails; `Br` → `\n`; records
`container` for Cell/Note/Footnote instead of flattening; collects anchored/inline items; run `Properties`
read correctly (B6). PR 0.3 xfails flip to passing. **Expected golden diff: none on the current corpus** (the
audit found no hyperlinks/notes/anchored objects in it, only table cells — confirm table-cell grouping is
unchanged; if not, document each change). Decide with River: are Note/Footnote paragraphs checked? Default: notes
skipped (editorial), footnotes and table cells checked as text but grouped separately.
*Done (2026-10-13):* B1, B2, B4, B6 fixed by feeding the old story classes from the walker; notes skipped, pending
deletions skipped, footnotes and table cells checked (River). Table cells stay in the same v1 paragraph groups:
grouping them separately turned "whole frame unstyled" errors into per-range errors in 12 packages, a rule change;
v2 keeps `container` instead. `Br` → `\n` in its own commit (text-only diff in 39 result goldens and 21 customer summaries: words no longer run
together; messages show a line break as a space). **B3 moved to PR 2.4**
(River): the walker collects items placed in text, but image/frame checks only see them once they read `Document`.

**PR 2.4 Document + loader; checks read the model (L, refactor).** `model/document.py`, `model/subject.py`,
`model/load.py`: indexes (item → page, frame ↔ story, link ↔ image, used faces, totals) computed once; no
post-construction mutation. Port every check to `Document` (iterators replace the repeated spread/story loops;
one `inherited()` builder; `at_item` replaces copied location blocks). Old parsers kept only for the parity test.
Golden diff: **0**. Fixes B5 and B8 in a **separate follow-up commit** in the same PR with its own expected diff
(B5: one fewer duplicate transform issue per affected Oval/Polygon frame; B8: none in corpus).
Also fixes **B3** (moved from PR 2.3): `Document` includes page items and links placed in stories, so image and frame
checks see them; the three PR 0.3 B3 xfails flip to passing (expected diff: none in the corpus, which has none).
*Done (2026-10-13), five commits:* Document + loader with golden diff 0 (spreads kept in file-name order);
designmap order (24 goldens: 22 order-only, 2 where an image placed on several spreads is reported at its last
placement in document order); B5, B8 and B3 (no corpus diff; each proved with built packages). `model/subject.py`
is left to PR 5.2, where v2 needs it.

**PR 2.5 Delete the old model (M).** Remove `classes/` (except what moved), `parsers/`, old `document.py`,
`PropertyBase`, MetadataParser disk writes (S4-adjacent), dead code from §2.3; move `States` to
`checks/stages.py` with explicit string values + a test pinning the names (D10). Golden diff: 0.
*Done (2026-10-13):* also removed `EXIT` (D10; intake returns None). `FrontifyChecker` stays in `classes/` until PR 3.2.
XMP thumbnails are read in memory (`helpers/pdf_previews.xmp_thumbnails`); PR 3.2 moves them to `pipeline/previews.py`.

### Phase 3 — Pipeline

**PR 3.1 Workspace + intake (M).** `pipeline/workspace.py` (one temp dir per run under `WORK_DIR` env var,
default system temp; upload, unzip and XML zip all inside it; `sweep_stale(1h)` at app start), `pipeline/intake.py`
(`open_package` raising `Rejected(stage, reason)`; no empty-folder creation; package PDF taken from the package
listing). Fixes S4. Golden diff: 0.
*Done (2026-10-13):* intake in two steps (`unpack_package`, `unpack_idml`) so the stages stay exact; the package PDF is
chosen from the extracted package folder, which holds only the package's own PDFs. `FrontifyChecker` calls the intake
until PR 3.2.

**PR 3.2 Runner; previews opt-in (M).** `pipeline/run.py` with a stage tracker (analytics names unchanged),
`pipeline/previews.py` (XMP in memory, PDF render) called only when asked (D6). `app/` uses
`with run_workspace()`; per-endpoint `previews`. `FrontifyChecker` becomes a thin facade for tests, then is deleted
when `testing/checker_setup.py` / `checker_run.py` move to `run()`. Golden diff: 0 (goldens run with previews on).
Measure before/after on the 5 largest packages; record in the PR.
*Done (2026-10-13):* the web app calls `/v1/checks` (not `/run`), so it asks with `?previews=1`; `/run` keeps
previews, `/v1/checks` without the parameter, `/v1/checks/summary` and `/v1/checks/xml` skip them. `FrontifyChecker`
is a thin wrapper over the pipeline for the app and the tests (River): it goes in PR 6.1 with `checker_setup.py`.

### Phase 4 — Checks emit structured facts (additive to v1)

**PR 4.1 Facts (M).** Each check fills `facts` (stored in v1's `context_details` for now): the list in §4.3.
`customer_summary/summary.py` reads facts; its five regexes are deleted; `oracle/compare.py` stops matching
'flip'/'skew' substrings. Golden diff: `context_details` gains fields; **summary goldens unchanged** (that is the
proof). `context` prose unchanged.
*Done (2026-10-13):* MASTERPAGE `elements` is a list of `{kind, count}` in the order found (JSON objects lose key
order: goldens and Flask sort them); FONTS_INCLUDED/ADOBE_FONT also say `whole_family`; TRANSFORMATION's `rotation_deg`
is `None` for a flip. Two summary unit tests and `summary_cases/rounding.json` gained the facts in their inputs (River).

### Phase 5 — Results v2

**PR 5.1 Catalogue (M).** `results/catalogue.py` from classifiers + guides (D2), with the merged keys from §3.1
(merged guides' wording drafted in the PR for River). `describe_issue`, check guides payload and API docs read it. Copy differences between guide
and classifier message listed in the PR for River. Golden diff: `checks`/`validation_classifiers` copy only.
*Done (2026-10-13):* merged wording approved by River; the split v1 keys keep their own titles until PR 5.2 merges
them (no summary lists a title twice). `check_guides.py` is a v1 view of the catalogue until PR 5.5. Summary goldens
change only in the approved merged why/fix lines.

**PR 5.2 v2 serializer + contract (L).** Pydantic models for §4.3; `results/serialize.py` emits v2;
committed `schema/results-v2.json`; test: every golden validates. Projection test (PR 0.4): projection of each
**old** golden == projection of the **new** output, modulo the documented key merges (D3) — for all 187 packages.
Then regenerate goldens once in v2. Customer summary and analytics read v2 (analytics `_issues` becomes a
loop over `issues`; `first_error_message` reads `issues`). Summary goldens unchanged.
*Done (2026-10-13):* checks report a `Subject` (`model/subject.py`); `results/models.py` (pydantic) is the contract,
`schema/results-v2.json` is generated from it, each catalogue entry names its facts model (`results/facts.py`). With
River: the web API keeps sending v1 until PR 5.3 (the deployed app reads v1), so `results_json` (v1) stays until then,
with `_V1_TITLES`; analytics reads v2 but keeps writing v1 `validation_type`/`category` (`catalogue.v1_name`) until
PR 5.4 (`validations.category` has a CHECK on the six v1 sections); `identifier` stores the subject. Text-frame
subjects are the frame (the story when it's in no frame); style subjects show InDesign's name ("body copy:body text");
`inheritedFrom` is `inherited_from`. Projection, v1 goldens -> v2: +141 -141, all override warnings in stories in no
frame (v1 subject "null", v2 the story). Summary: 102 goldens change (merged titles; 20 merges, with per-kind steps
led by "Text frames:", "Images:", "Image frames:"; text frames named by their text; style names); summary sections of
merged checks don't link to the web app's v1 problems until PR 5.3.

**PR 5.3 Frontend on v2 (L).** Generated TS types from the schema; `buildReport.ts` becomes a thin grouping
(check → subject.id), no `_par_` splitting, no `text_box_data` lookups; `PageViewer`/`PageCanvas` read
`pages` + `location.bounds`; `ValidationCount`, `FileUpload` updated; delete the classic view and dead component
(D5); fixtures generated from goldens by a script (`npm run fixtures`). Tests: adapter/grouping, `placeOnPage`,
one ReportView render on a generated fixture. Visual check in the browser (screenshots in the PR) — River signs off.

**PR 5.4 Analytics migration (S, data).** Supabase migration `011_results_v2.sql`: backup table, rewrite old
`validation_type` → new keys and `category` → subject kind per D4 (mapping in the migration), update the CHECK
constraint and RPCs that group by category. Run on staging/copy first; River runs it in production.

**PR 5.5 Delete v1 leftovers (S).** `results/layout.py`, `classifiers.py` remnants, `validation_classifiers`,
`check_guides.py` (moved into the catalogue), old docs; update `docs/API.md`, `apiReference.ts`,
`validation-classifier-reference.md` → `docs/checks.md` generated from the catalogue.

### Phase 6 — Tests consolidation

**PR 6.1 Table-driven package tests (M).** Replace the 21 per-check files + e2e count tests with
`testing/test_packages.py`: a data table (`testing/packages/expected.yaml` or `.py`) mapping package → expected
issues as (check, subject name, page, key facts). Unknown packages fail. Delete `format_counter_diff` copies and
`checker_setup.py`. Every deleted test is covered by goldens + table + PackageBuilder tests (show the mapping).

**PR 6.2 Corpus dedupe (S).** Move unique zips to `testing/packages/` (77 duplicates removed, ~400 MB working tree,
~40% golden time); goldens keyed by package; update references. Golden diff: file moves only.

---

## 6. Testing strategy (end state)

1. **Contract**: pydantic v2 models → JSON Schema → TS types; every golden validates; frontend fixtures generated.
2. **Rules**: PackageBuilder tests per check (specific subject, page, facts) — the main place rules are tested,
   including the coverage cases from PR 0.3.
3. **Corpus**: result goldens (v2), summary goldens (+ `sections`), oracle (independent IDML reader; keep it
   independent of `src/`), the package table.
4. **App/API**: endpoint, auth, rate-limit, analytics, feedback — hermetic.
5. **Frontend**: grouping adapter, page placement, one render test, typecheck, lint.
6. **Issue-diff tool** (`testing/golden/projection.py` + a CLI that prints added/removed issues per package) —
   the standard evidence for every behaviour PR.

CI runs all of it on every PR (~35 s backend + ~10 s frontend). Deploys need green CI.

---

## 7. Risks and how they're handled
| Risk | Mitigation |
|------|------------|
| Text walker changes grouping in edge cases | PR 0.3 fixtures first; PR 2.3 golden diff must be 0 on the corpus or documented item by item. |
| v2 switch breaks the frontend silently | Generated types + generated fixtures + typecheck in CI + visual sign-off. |
| Analytics history split by renamed keys | D4 migration with backup; mapping reviewed by River. |
| Big PRs hard to review | L PRs are split into refactor commits (0 diff) and behaviour commits (documented diff). |
| Another session in the main checkout | Worktrees only (§0.1). |
| Copy regressions | Catalogue PR lists every wording change for River. |

## 8. Done when
- `src/classes/`, `src/parsers/`, `FrontifyChecker.py`, `classifiers.py`, `check_guides.py`, the classic view,
  the 21 per-check test files and the context regexes are gone.
- B1–B12 and S1–S5 fixed, each with a test.
- Results v2 with schema; frontend, summary and analytics on it; analytics history migrated.
- CI gates deploys; suite hermetic; per-check behaviour asserted by specifics.
- `docs/checker-rules.md`, `docs/API.md`, `docs/checks.md` current.
