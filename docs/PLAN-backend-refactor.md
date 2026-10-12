# Plan: Backend checker refactor (readability, safety to build on, correctness)

Scope: the template checker core in `python_backend/src/` (≈4,700 lines; `FrontifyChecker.py` alone is 1,765).
Not in scope: the Flask app (`app/`), auth, analytics, the zip intake (already rewritten in #36).

**Goal:** make adding or changing a check a small, local, well-tested change — without changing what customers
see, except for the bugs listed below, which are fixed deliberately and one at a time.

**Speed is not a goal.** Profiling the 22 end-to-end packages: ~90 ms per package, about half of it rendering PDF
page previews. All 24 checks together are a few milliseconds. Nothing here is justified by performance.

---

## 1. What I verified (and how)

Everything below was confirmed against the code on `main` and, where marked, by running it.

### 1.1 Confirmed bugs

| # | Bug | Where | Evidence | Who sees it |
|---|-----|-------|----------|-------------|
| B1 | **Crash when the IDML has no `MasterSpreads/`.** `masterspreads_parser` stays `None`, then `masterpage_check` and `images_included_check` call methods on it. | `FrontifyChecker.py:379-384`, `:488`, `:929` | Ran a test package with `MasterSpreads/` removed: `AttributeError` at `MASTERPAGE_CHECK`. | Users get a 500 / "failed" run. |
| B2 | **Composer warnings show the wrong "Inherited from".** `get_composer_obj()` returns the grid-alignment property. | `classes/StoryParagraphData.py:131-132` | 331 paragraphs across the test set differ. Independent check on *Full coverage errors Folder*: composer comes from `[No paragraph style]`; the checker shows an empty context. | Users (wrong/missing context). |
| B3 | **Results order is random between runs.** Merged `text_content` goes through `set()`. | `error_handling/ErrorHandling.py:90` | Two runs of unchanged code differ on 12 of 187 packages, all in `par_styles` text order. | Users (list order shifts); makes diff-testing impossible. |
| B4 | **`text_box_data` page fields are wrong in every response.** `SpreadData.page_name` holds the page *Self* and `page_id` holds the page *Name* (swapped), so `text_box_data[*].page_id` is a page name ("1") and `page_name` is always empty. | `classes/SpreadData.py:27-28, 62-63`; used via `StoryData.get_page_id()` | 980 of 998 text-box entries across the test set have a `page_id` that isn't a page; the rest are empty. | API-key users. The web UI only reads `.content`, so it's invisible there. |
| B5 | **Some issues are attributed to the wrong page.** Page IDs come from the *first page of the spread*, while the highlight box uses the item's real page. | `FrontifyChecker.py:1615-1643` (`_build_data_id_to_page_id_mapping`), `SpreadsParser._build_story_id_mappings` | 4 of 2,298 issues with a highlight box disagree (e.g. list says page 2, box is on the facing page). Only affects facing-page spreads. | Users (rare). |
| B7 | **Horizontal flips are reported as rotations.** Flip detection requires `a < 0 < d` *and* an angle other than 180°, but a plain horizontal flip (`-1 0 0 1`) has an angle of exactly 180°, and a flip combined with a 90° turn (`0 -s -s 0`) has `a = 0`. Both fall through to "rotated by …" (a warning) instead of a flip (an error). The page-item check shares the formula. | `FrontifyChecker.py:1073-1104`, `helpers/page_item_transform.py:43-52` | Found by computing matrices by hand (phase 0 spot check). The oracle, which classifies by determinant (`a*d - b*c < 0` = mirrored), disagrees on 21 test packages: 19 frames `-1 0 0 1` and 14 images `0 -4.42 -4.42 0`. | Users: flipped images pass with a warning. |
| B6 | **File order depends on the OS.** All parsers iterate `os.listdir()` unsorted; production (Linux) and Mac can order stories/spreads differently. | `SpreadsParser.py:28`, `StoriesParser.py:25`, `MasterPageParser.py:36`, `SourceFoldersParser.py:27` | Code reading; feeds result order. | Same as B3. |

### 1.2 Latent bugs (code is wrong; no test package triggers it today)

| # | Bug | Where |
|---|-----|-------|
| L1 | Master-page links: `links_obj_list` is **overwritten per master file**, so only the last master's links count. With several masters that hold images, those images get flagged as unused/missing. (22 test packages have several masters; none has images on more than one.) | `parsers/MasterPageParser.py:28` |
| L2 | A `<Link>` that fails to parse is still appended — the previous link again, or a `NameError` for the first one. | `classes/SpreadData.py:142-144` |
| L3 | `Link` guards `grandparent_element is not None` only *after* already calling `.get` on it. | `classes/Link.py:43-46` |
| L4 | Text frames whose story is missing crash `object_style_check` / `auto_size` / `text_columns` / `text_wrap` / `linked_text_frame` (`story.get_page()` on `None`). Every frame in the test set has a story. | `FrontifyChecker.py:1266, 1347, 1376, 1405, 1436` |
| L5 | Style inheritance (`BasedOn`) recursion has no loop guard → `RecursionError` on a cyclic chain. | `classes/PropertyBase.py:30, 46` |
| L6 | `GridAlignment`/`Composer`/`TextWrapMode` compared to the string `'None'`; a genuinely missing value (`None`) is reported as an error. Doesn't occur in the test set because `[No paragraph style]` always defines them. | `FrontifyChecker.py:1375, 1492, 1527` |
| L7 | With no stories, `text_columns_check` skips straight to `LINKED_TEXT_FRAME_CHECK`, so `TEXT_WRAP_CHECK` never runs. Harmless today (no stories ⇒ no text frames), but it shows how fragile the hand-wired chain is. | `FrontifyChecker.py:1341` |

### 1.3 Structural problems (the "hard to build on" part)

1. **Hand-wired chain.** Each check returns the next state. Adding a check touches the `States` enum, the dict in
   `__init__`, the previous check's `return`, and a header comment — and several header comments already disagree
   with the code (e.g. `OVERRIDES_CHECK` says it goes to fonts; it goes to kerning).
2. **One 1,765-line class** does intake, parsing, 24 checks, page mapping, counts and cleanup. Checks can't be
   tested without unzipping a real package.
3. **Repetition.** 56 `add_error/add_warning/add_info/add_custom_error` calls, most spelling out 5–7 named
   arguments; the "Inherited from" context is built identically in 5 checks; `overrides_check` has two ~30-line
   near-duplicate blocks (`:694-728` and `:732-761`); `image_transformation_check` re-implements, line for line,
   the matrix maths in `helpers/page_item_transform.py`; 11 checks open with the same `if not self.stories_exist`
   guard (12 occurrences).
4. **Java-style data classes.** 120 `get_x()` methods; big banner comments that drift.
5. **`'null'` vs `None`.** 31 `'null'` string sentinels mixed with `None`/`''` for "no value".
6. **Results object holds parsers.** `ValidationResult` keeps `stories_parser`/`spreads_parser` and reaches into
   them while building JSON, so reporting depends on parsing internals.
7. **Leftovers.** PyInstaller/desktop path logic writes unzip folders into `src/data/` inside the code tree
   (`FrontifyChecker.py:143-160`); unused `GET_ZIP`/`IDLE` states; commented-out checks; 26 `print()` calls
   (including one per image and one per master-page link) going to production logs; a sleep/retry loop in
   `zip_idml_output_folder`; `FontsParser.add_used_font_family` does a linear scan per text run.

### 1.3a Rules clarified with the product owner

- Kerning and composer are judged on the **paragraph or character style** (through `BasedOn`) only. A value set
  directly on the text is an override, which the overrides check already reports, and the paragraph-style rule
  makes people fix it anyway. So the checker ignoring local `KerningMethod`/`Composer` is correct, not a gap.

### 1.4 What the current tests do and don't protect

- 21 per-check suites (4–5 pass + 4–5 fail packages each) and 2 end-to-end tests over 22 packages.
- **They only assert counts of classifier types** (e.g. "2 × LINKED_TEXT_FRAME"). They don't check *which* item,
  identifier, page, context text, bounds, or anything in the JSON the frontend reads. B2, B4 and B5 all pass today.
- No test data for: `TEXT_WRAP`, `FILL_TINT`, `KERNING` fail cases, missing `MasterSpreads`, multiple masters with
  images, cyclic styles.
- Every per-check test copies the same `setup_instance()` that calls checker internals
  (`unzip_package_state`, `cleanup_data_folder`, `extract_zip_to_data_folder`, `unzip_idml_state`, `parse_xml`)
  — 21 files will need a one-line change when those move.

### 1.5 Constraints the refactor must respect

- **Stage names are stored.** `runs.stopped_at_stage` (analytics DB) stores names like `PARSE_XML`,
  `KERNING_CHECK`, and the frontend labels them (`react-frontend/src/components/Analytics/format.ts:82`). Keep
  every name byte-for-byte.
- **The results JSON is a contract** with the frontend (`react-frontend/src/types.ts`) and API-key users. Shape
  and values must not change except for the listed bug fixes.
- **External API of the checker** used by `app/`: `run_state_machine()`, `last_state`, `results`,
  `zip_idml_output_folder()`, `delete_unzipped_root_path()`, `set_source_file_path()` (`app/utils.py`,
  `app/routes.py:904`). Keep these working throughout.

---

## 2. Testing strategy (built first, used by every phase)

Three layers, each catching something the others can't.

### 2.1 Golden results (regression net) — *does anything change?*

- `testing/golden/`: run every test package (187 today), canonicalise the results JSON (drop `output_folder`;
  replace preview images with a SHA-256), and store one JSON file per package. Measured size: ~5 MB plain JSON
  (27 MB with previews), diffable in PRs. Running all 187 takes ~10 s.
- `pytest -m golden` re-runs and diffs. `python -m testing.golden --update` rewrites them.
- **Rule:** a pure refactor PR must leave goldens untouched. A bug-fix PR updates goldens in the same commit, and
  the PR description explains every changed field. That review is where an unintended change gets caught.
- Prerequisite: B3 and B6 (non-determinism) are fixed first, otherwise goldens flap.

### 2.2 Independent oracle — *is the current behaviour actually right?*

Goldens only prove "unchanged", not "correct". So:

- `testing/oracle/idml_oracle.py`: a deliberately separate, minimal reader that computes check outcomes straight
  from the IDML XML with plain `lxml` (no `src/` imports): text columns, wrap, linked frames, embedded images,
  flips/rotation/skew from `ItemTransform`, bleed, resolved `KerningMethod`/`Composer`/`GridAlignment`/
  `Hyphenation`/`FillTint` through `BasedOn`, fonts used vs. `Document Fonts`, links vs. `Links/`.
- A test runs it across all 187 packages and compares item-by-item (identifier + data_id), not just counts.
- **Pilot already done** for 8 checks on *Full coverage errors Folder*: text columns (`u127`), linked frames
  (`u151`, `u1d5`), embedded image (`u176`), bleed (72 pt all sides), kerning (none) all match the checker
  exactly; composer matches on *which* style but exposed B2 in the context.

### 2.3 Hand-built fixtures + manual spot checks — *edge cases and human judgement*

- `testing/fixtures/idml_builder.py`: builds tiny packages in memory (one spread, a few frames/styles) so each
  edge case is a 10-line test: no `MasterSpreads`, frame without story, cyclic `BasedOn`, missing
  `TextWrapPreference`, images on two masters, facing-page spread (B5), a broken `<Link>`.
- `docs/spot-checks.md`: for at least 6 real packages (2 per category: text, fonts/images, layout), open the XML,
  work out the expected results by hand (style inheritance chains, transform matrices → angles, which page an
  item's bounds fall on), and record the reasoning next to the checker's output. Repeat for any check whose code
  changes meaning, not just shape.

### 2.4 Definition of done for every PR

1. Full backend suite green (372 tests today).
2. Goldens unchanged — or changed only in the fields the PR says it fixes.
3. Oracle comparison green.
4. For behaviour changes: a hand-verified spot check recorded in `docs/spot-checks.md`.

---

## 3. Phases

Each phase is one or more small PRs. Phases 0–1 are worth doing even if nothing else happens.

### Phase 0 — Safety net (no behaviour change except ordering)

1. Fix B3 (order-preserving de-dup instead of `set()`) and B6 (sort every directory listing).
   *These change list order only; verified by the order-insensitive comparison used in #36.*
2. Add golden results (2.1).
3. Add the oracle and its all-packages test (2.2), starting with the 8 piloted checks.
4. Add the fixture builder (2.3) with no new assertions yet.
5. Replace the 21 copies of `setup_instance()` with one shared fixture in `testing/conftest.py`, so later phases
   change one place instead of 21.

### Phase 1 — Bug fixes (each its own commit, test first)

For each: write a failing fixture or oracle test → fix → update goldens → spot check.

| Fix | Golden impact |
|-----|---------------|
| B1 Missing `MasterSpreads` — treat as "no masters" instead of crashing | None (no test package lacks it) |
| B2 Composer inheritance | Composer contexts change in affected packages |
| B4 Un-swap `SpreadData` page fields; `text_box_data` gets real page id + name | Every `text_box_data` entry |
| B5 Page attribution from page geometry (the item's real page), falling back to the spread's first page | 4 items |
| B7 Flip detection by determinant, for images and page items | 21 packages: rotation warnings become flip errors |
| L1–L6 | None expected; each gets a fixture test |

### Phase 2 — Check runner (the main structural change; zero golden changes)

```
src/
  pipeline.py          # intake + parse stages (keep current state names), then run CHECKS in order
  document.py          # ParsedDocument: stories, spreads, masters, fonts, links, preferences, page lookups
  report.py            # Reporter: thin wrapper over ValidationResult with the repeated plumbing
  checks/
    __init__.py        # CHECKS = [Check('MASTERPAGE_CHECK', masterpage), Check('PAR_CHECK', par_style, needs_stories=True), ...]
    text.py            # par style, hyphenation, overrides, kerning, grid alignment, composer, fill tint
    fonts.py           # fonts included, OTF/TTF, variable
    images.py          # included, large, embedded, image transformation, object style (images)
    layout.py          # page-item transform, table, pasted graphics, bleed, auto-size, columns, wrap, linked frames, object style (frames)
```

- A check is `def check(doc: ParsedDocument, report: Reporter) -> None`. The runner sets `last_state` to the
  check's stored name before calling it, so analytics keeps working, and skips `needs_stories` checks when there
  are no stories (removing the 11 guards and fixing L7 for free).
- `FrontifyChecker` stays as a thin façade with the same public methods (1.5), so `app/` doesn't change.
- Move checks **verbatim** first (one module per PR), then tidy. Goldens must not move.
- Order stays exactly as today.

### Phase 3 — Remove repetition (zero golden changes)

- `Reporter` helpers that take the thing being reported (story / frame / link) and fill page, data_id and
  identifier consistently, e.g. `report.error(ValidationError.TEXT_COLUMNS, frame=tf)`.
- One `inherited_context(prop)` helper for the five "Inherited from" checks.
- Merge the two `overrides_check` blocks into one function used for character and paragraph level.
- `image_transformation_check` uses `classify_page_item_transform`. The two have identical branches, thresholds
  and message text (verified), so after B7 is fixed in the shared helper this is a straight swap. Both share one
  limitation to keep in mind (not fixed here): an item that is rotated *and* skewed only reports the rotation.
- `PropertyBase`: memoise resolution per (style, property) and add the loop guard (L5) if not already done.
- `FontsParser`: dict lookup instead of a scan per text run.

### Phase 4 — Data model and housekeeping (incremental; zero golden changes)

- Convert data classes to `@dataclass` with plain attributes; delete getters as call sites move. One class per PR.
- Standardise "no value" on `None` internally; only the JSON layer emits `'null'` where the contract needs it.
- `ValidationResult` receives plain lookups (page names, story texts) instead of holding parsers.
- Replace `print()` with `logging`; drop per-image/per-link prints.
- Unzip into `tempfile.mkdtemp()` instead of `src/data/`; delete the PyInstaller branch, `GET_ZIP`/`IDLE`,
  commented-out checks, stale banner comments, and the sleep/retry loop in `zip_idml_output_folder`.

---

## 4. Decisions for you

1. **Fix user-visible bugs B2, B4 and B5?** I recommend yes. Each changes output, but only from wrong to right.
2. **Commit the golden results to the repo** (~5 MB of JSON)? I recommend yes, so changes show up in PR diffs.
3. **Phase 2 layout** above (one `checks/` package grouped by theme), or one file per check?

## 5. Suggested PR sequence

| PR | Contents | Changes output? |
|----|----------|-----------------|
| 1 | Phase 0.1–0.2: determinism fixes + goldens | Order only |
| 2 | Phase 0.3–0.5: oracle, fixture builder, shared test fixture | No |
| 3 | Phase 1: B1, L1–L6 (crash and latent fixes) | No |
| 4 | Phase 1: B2, B4, B5, B7 (visible fixes) + spot checks | Yes, documented |
| 5 | Phase 2: runner + move all checks (one PR, mechanical move verified by goldens) — **done** | No |
| 9 | Phase 3: de-duplication | No |
| 10 | Phase 4a: logging, dead code — **done** (#51) | No |
| 11 | Phase 4b: attributes instead of trivial getters, B8 fix — **done** | B8 only |
