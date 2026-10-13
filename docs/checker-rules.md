# Checker rules (what the oracle assumes)

The oracle (`python_backend/testing/oracle/`) encodes these rules independently of the checker's code. When the
oracle and the checker disagree, the first question is whether the **rule** is right, not whether the code is.
Rules marked *assumed* are my reading of the code and help articles; please confirm or correct them. What each check
tells the user (title, why, fix) is in [checks.md](checks.md).

| Check | Rule | Severity | Status |
|-------|------|----------|--------|
| Kerning (paragraph) | The paragraph **style's** `KerningMethod` (following `BasedOn`) must be Metrics. Kerning set directly on text is an override, reported by the overrides check, not here. | Error | ✅ Confirmed |
| Kerning (character) | Same, for the character style. | Error | ✅ Confirmed |
| Composer | The paragraph **style's** composer (following `BasedOn`) must be single-line: *HL Single* (Adobe) or *HL Single Optyca* (World-Ready). Reported once per style, saying which style it was inherited from. | Warning | ✅ Style-only confirmed · *once per style assumed* · World-Ready Single-line allowed (2026-10-12) |
| Auto-size | Width-based auto-size (WidthOnly, HeightAndWidth) must have "No Line Breaks" on, because Frontify always behaves that way. Any reference point is fine. | Error | ✅ Confirmed |
| Image transformation | Judge the **end state**. Mirrored (determinant `a·d − b·c` < 0) → flip error. Axes not perpendicular → skew error, **whether or not it's also rotated**. Only rotated (and/or scaled) → no issue. Frame and image inside it are reported separately. Same rule for other page items. | Error | ✅ End-state rule confirmed · rotated + skewed = skew (2026-10-12) · rotation alone is no issue (2026-10-12) · *open: an image flipped inside a frame that's also flipped (they cancel). Today both are reported as flips.* |
| Grid alignment | The paragraph style's `GridAlignment` (following `BasedOn`) must be None. Once per style. | Error | *Assumed* |
| Text columns | A text frame with more than one column. | Error | *Assumed* |
| Text wrap | Any page item whose wrap mode isn't None: text frames, and images, shapes, lines and groups, which is where InDesign usually sets wrap (one check, `TEXT_WRAP`). An item with no wrap setting has none (InDesign's default). | Error | ✅ Confirmed (2026-10-12) |
| Linked text frames | A text frame threaded to a previous or next frame. | Error | *Assumed* |
| Embedded images | A placed image stored inside the document instead of linked. | Error | *Assumed* |
| Document bleed | Any bleed offset other than 0 → one warning for the document. | Warning | *Assumed* |
| Fill tint (character) | A **character style's** fill tint (following `BasedOn`) must be 100% (-1 or unset). Once per style. | Error | ✅ Confirmed (2026-10-12) |
| Superscript / subscript | Per text run, the **effective** `Position` (text, then character style, then paragraph range, then paragraph style, each following `BasedOn`) must be Normal. | Error | ✅ Confirmed (2026-10-12) |
| Baseline shift | Same resolution; `BaselineShift` must be 0. | Warning | ✅ Confirmed (2026-10-12) |
| Fonts included | Every style the text uses (effective `AppliedFont` + `FontStyle`, including character styles) needs a file in Document Fonts, matched on PostScript name. A family with no file is reported without detail; otherwise the missing styles are named. Variable fonts and Adobe Fonts styles are left to their own checks. | Error | ✅ Confirmed (2026-10-12) |
| Adobe Fonts | A style the text uses whose Fonts.xml entry has a real `TypekitID` (not the empty `$ID/` InDesign writes for desktop fonts) and whose file isn't in Document Fonts. A packaged Adobe Font is fine. | Error | ✅ Confirmed (2026-10-12) |

Not yet covered by the oracle: paragraph style missing, overrides, hyphenation, fill tint, fonts (included,
OTF/TTF, variable), images included/unused, large images, object styles, auto-size, tables, pasted graphics,
master page items.

---

## Basis in Frontify's code

*Checking or adding rules against Frontify's code? Start with [frontify-rule-checks.md](frontify-rule-checks.md).*

**Philosophy:** the checker flags anything in the InDesign file that won't look or behave the same once imported
into Frontify, so the designer can change the InDesign file to match what Frontify will do. When Frontify always
behaves one way (e.g. it never wraps width-auto-sized text, or always renders Metrics kerning), the InDesign file
should be set up that way too. A rule is right when the InDesign setting it flags would make the two differ — not
only when Frontify fails outright.

What Frontify's InDesign import actually does with each thing we check, read from the code (not from Frontify's
own import validator, which is incomplete and not the reference). Read at `app-server` `f3c6ae0a` and `web-app`
`241fbfce` (both 2026-10-01); paths are relative to `app-server/application/` unless they start with `web-app/`.
The importer lives in `utility/Idml/` (IDML → template JSON); `module/IntermediateJson/` holds the operations on
that JSON afterwards (e.g. resizing).

**Verdicts:** *Supported* = carried over; *Partial* = carried over with losses; *Dropped* = read or ignored, never
reaches the template (no error, no warning). "Our rule" is the checker's current behaviour.

### Transforms

| | Frontify | Our rule | Fit |
|-|----------|----------|-----|
| Rotation | **Supported.** `utility/Idml/PageItem.php:590-631` decomposes the matrix; rotation becomes CSS `rotate()`. Every layout operation afterwards understands rotation only: `module/IntermediateJson/Core/Domain/Resize/Write/ItemGeometry.php:179-207` reads `rotate` and nothing else; `BoxMapper.php` "the renderer applies the rotation itself". Position is corrected for it (`PageItem.php:608-621`), for groups too (`Group.php:98-118`) and images inside frames (`Rectangle.php:80-88`). | No issue (since 2026-10-12) | ✅ carried over faithfully |
| Flip (mirror) | **Partial, fragile.** There is no flip concept: a mirror only comes out of the decomposition as a 180° rotation plus a negative `scaleY` (`Transformation.php:52-62`), then hand-tuned position fixes ("Correct upside-down elements", `PageItem.php:617-620`). Resizing ignores it. | Error | ✅ |
| Skew | **Partial, fragile.** Emitted as CSS `skew()` with position corrections (`PageItem.php:602-606`); when the item is also rotated, the y-correction for the rotation is skipped (`PageItem.php:614-616`, "Don't apply y-translation if skewed"), so rotated + skewed items are mispositioned. Invisible to resize/layout. | Error (rotated or not) | ✅ |
| Scale | Emitted as CSS `scale()` (`PageItem.php:627-628, 634-640`); invisible to resize/layout. | Not checked | ⚠️ gap |

### Text frames

| | Frontify | Our rule | Fit |
|-|----------|----------|-----|
| Linked (threaded) frames | **Dropped, and wrong.** `PreviousTextFrame`/`NextTextFrame` are read (`PageItem.php:134-135`) and never used again. Each frame builds its text from its whole story (`TextFrame.php:124-130`), so a threaded story is likely repeated in every frame (from the code, not tested). | Error | ✅ |
| Text wrap | **Dropped.** `TextWrap*` is never read anywhere in the import (0 references). Text won't flow around objects. Wrap is set on the obstacle (image, shape, group), so every item is checked, not only text frames. | Error | ✅ |
| Text columns | **Partial.** Count and gutter become CSS `columnCount`/`columnGap` (`PageItem.php:498-501`); the browser balances columns, not InDesign. Fixed/max column width are read and dropped (`TextFrame.php:34-35`). | Error | ✅ columns won't break the same way |
| Auto-size: type | **Supported.** WidthOnly / HeightOnly / HeightAndWidth mapped (`PageItem.php:510-528`). | — | ✅ |
| Auto-size: reference point | **Supported, all nine** (`PageItem.php:530-568`), including the centre ones; the editor positions them (`web-app/application/client/Feature/Publishing/Component/Canvas/presentations/helpers/itemStyles/autoSizingReference.ts:14-50`). When the frame doesn't set one (it inherits from its object style), Frontify assumes `CenterPoint` — the same as InDesign's `[Normal Text Frame]`. | Not checked (since 2026-10-12) | ✅ |
| Auto-size: "No Line Breaks" | **Ignored** (`TextFrame.php:46` is its only reference): width-based modes are always no-wrap in Frontify. If it's off in InDesign, InDesign wraps and Frontify doesn't. | Error when off | ✅ designer should match Frontify (on) |
| Object styles | **Partial.** Only the style's stroke colour is used (`PageItem.php:781-783`); fill, insets, effects and fitting from the style are dropped (`Styles.php:482-509`). | Error | ✅ (confirmed) |
| Tables | **Dropped.** Only `Content` and `Br` are kept from a text run (`Story.php:325-340`); the table and its cell text vanish. | Error | ✅ |

### Text styles

| | Frontify | Our rule | Fit |
|-|----------|----------|-----|
| No paragraph style | **Supported.** `[No paragraph style]` / `[Basic Paragraph]` are styles like any other; nothing needs a named style to render or edit (`TextFrame.php:180-183`). | Error | ➖ our editing rule, not a technical limit |
| Style inheritance | `BasedOn` resolved at load, child wins (`Styles.php:544-556`) — same model as the checker. | — | ✅ |
| Overrides | **Supported.** Range attributes are merged over the style (`TextFrame.php:183, 196-203`); some `<Properties>` overrides aren't read. | Warning | ✅ |
| Kerning: Optical | **Rendered as Metrics.** Optical and Metrics both become CSS `font-kerning: normal` (`PageItem.php:279-281`), so Optical in InDesign won't match Frontify. | Error | ✅ designer should use Metrics |
| Kerning: manual value | **Dropped.** `KerningValue` is never rendered (only read, `Styles.php:161-163`). | Not checked | ⚠️ gap |
| Superscript / subscript | **Dropped.** `Position` is read (`Styles.php:214-216, 381-383`) and never rendered (no case in `PageItem::getStyle`); text shows full size on the baseline. | Error | ✅ |
| Baseline shift | **Dropped.** 0 references to `BaselineShift`. | Warning | ✅ |
| Grid alignment | **Dropped.** Read (`Styles.php:333-337`) and never used; line spacing won't snap to a grid. | Error | ✅ (looks different) |
| Composer | **No effect.** Stored but never rendered (the browser breaks lines); on export edited text gets a single-line composer: `HL Single`, or `HL Single Optyca` for World-Ready composers (`Idml.php:401-408`). | Warning unless single-line | ✅ (line breaks may differ) |
| Hyphenation | **Supported, differently.** Becomes CSS `hyphens: auto` with limits (`PageItem.php:372-391`); the browser hyphenates, not InDesign, so line breaks differ. | Warning | ✅ |
| Fill tint on text | **Dropped.** Text colour ignores `FillTint` in paragraph and character styles (`Styles.php:167-169, 297-299`); tint is applied to frame backgrounds only (`PageItem.php:720`). Tint **swatches** work (`Graphic.php:201-222`). | Error (paragraph and character styles) | ✅ |

### Images

| | Frontify | Our rule | Fit |
|-|----------|----------|-----|
| Embedded images | **Dropped.** `Shape.php:323-329` returns nothing for `StoredState="Embedded"`: an empty image frame. | Error | ✅ |
| Pasted graphics | **Dropped.** Inline `<Contents>` is never read; same empty frame (`Shape.php:280-294`). | Error | ✅ |
| Missing linked file | **Dropped.** Links are matched by file name only (`Idml.php:93-95`); no match → no image, no error. | Error | ✅ |
| Unused files in Links | Uploaded anyway (`server/Service/Publishing/Importer/InDesignPublishingImporter.php:48-67`); harmless clutter. | Warning | ✅ |
| Large images | No size limit or downscaling on import; only the `.idml` has a 50 MB limit. | Info (> 10 MB) | ➖ our choice |

### Fonts

| | Frontify | Our rule | Fit |
|-|----------|----------|-----|
| Fonts in the package | Read only from a folder named exactly **`Document fonts`** and only if listed in InDesign's **`AdobeFnt*.lst`** index (`server/Helper/Publishing/File/InDesignImportFontFileReader.php:17-19, 40-49`), keyed by PostScript name (`FontName`). Text gets the PostScript name of the face matching its `FontStyle` (`PageItem.php:246-255`). | Error when a used style has no file (by PostScript name) | ⚠️ gap: we don't check the index or the exact folder name |
| Adobe Fonts | The `TypekitID` is copied into the template (`PageItem.php:253`) but nothing reads it: Frontify only loads fonts from the package. InDesign packages Adobe Fonts in some cases (e.g. Montserrat in the Harbour club fixtures, listed in `AdobeFnt23.lst`), and then they work. | Error when not packaged | ✅ |
| File types | Accepts `ttf, ttc, otf, woff, woff2, eot, svg` (same file, line 17); others (Type 1, `.dfont`) silently skipped. `.ttc` is accepted, but nothing picks a face inside it. | Error unless `.otf`/`.ttf` | ✅ (stricter for woff/eot/svg, which InDesign packages don't contain) |
| Variable fonts | **Not handled** (0 references to design axes / `fvar`). | Error | ✅ |

### Document

| | Frontify | Our rule | Fit |
|-|----------|----------|-----|
| Master page items | Imported into every spread (`utility/Idml/Renderer/JsonRenderer.php:59-66`). They're flagged `fromMaster`, but nothing reads the flag, so they're editable; an edit is written back to the **master** on export (`utility/Idml/Idml.php:218-222`), changing every page that uses it. | Error | ✅ |
| Document bleed | **Dropped.** Never read from the IDML (0 references); bleed only exists as an export option the user picks. | Warning | ✅ |

### Decisions (2026-10-12)

1. **Manual kerning values** — no separate check: kerning set on text is an override, and the paragraph-style and
   override rules already flag it.
2. **Font index / folder name** — worth a check; to be specified (see below).
3. **Auto-size reference points** — no longer errors (HeightOnly/WidthOnly "cannot autosize from center" and
   HeightAndWidth "must auto size from corners" removed): Frontify supports every reference point. Only "No Line
   Breaks" off (WidthOnly / HeightAndWidth) and unknown auto-size types remain errors.
4. **Scale on items** — not checked for now.

### Decisions (2026-10-12, from [rules-review-2026-10-12.md](rules-review-2026-10-12.md))

5. **Text wrap** — any item with wrap is an error, without checking whether it overlaps text.
6. **Superscript/subscript** — error; **baseline shift** — warning; both per text run on the effective value.
7. **Adobe Fonts** — an error only when the style's file isn't packaged; reported instead of "font missing",
   per style (a family can mix Adobe and desktop styles). The copy says Adobe Fonts aren't supported and a
   desktop version is needed.
8. **Rotation** — no issue: Frontify carries it over. The rotation warnings are retired; flips and skews are one
   check, `TRANSFORMATION`. Older analytics rows still hold the retired warnings, under their old names
   (`IMAGE_TRANSFORMATION_IMAGE`, `IMAGE_TRANSFORMATION_CONTAINER`, `PAGE_ITEM_TRANSFORMATION` with severity warning).

### Proposed: font index check (not built)

Frontify only loads fonts from a folder named exactly `Document fonts` that are listed in InDesign's
`AdobeFnt*.lst` index (`InDesignImportFontFileReader.php:17-19, 40-49`); anything else is silently ignored, so the
template falls back to another font even though the files are in the package. To be agreed: which cases to flag
(folder named differently, e.g. `Document Fonts` on a case-sensitive server; no `.lst` index; a font file missing
from the index) and the severity.

### Possible future checks: story content Frontify drops (not built)

Frontify's IDML import reads a story's text only from `Content` and `Br` elements that sit directly inside a
`CharacterStyleRange`. Paragraph and character ranges may be wrapped in `XMLElement`, but nothing else is looked
through (`app-server/application/utility/Idml/Story.php:293-365`). Page items are read only as direct children of
a spread (`Spread.php:60-69`). Everything else in a story is dropped silently, so a template can lose content that
the checker doesn't mention today. Found while planning PR 0.3 of the v2 refactor (2026-10-13), from reading the
code; worth confirming with a test import.

The checker keeps checking this content as text, as planned: the coverage fixes B1–B4 in
[PLAN-v2-refactor.md](PLAN-v2-refactor.md). Notes and pending deletions are skipped; footnotes and table cells are
checked. These checks would be added on top of that:

| Content | In Frontify | Possible check | Why |
|---------|-------------|----------------|-----|
| Hyperlink text (`HyperlinkTextSource`) | Text disappears | Error: link text is lost; remove the hyperlink | The words are missing from the template. |
| Tracked changes not yet accepted (`Change`) | Inserted and deleted text both disappear | Error: accept or reject all changes | Inserted text is missing from the template. |
| Footnotes (`Footnote`) | Disappear | Error or warning | Footnote text is missing. |
| Inline and anchored objects (images, frames, groups in a story) | Not imported | Error: unanchor them | The image or frame is missing; an anchored text frame's text is too. |
| Table cells | Disappear | Already covered: tables are an error | — |
| Notes (`Note`) | Disappear | None | Editorial only; never printed. |
| Special characters (`<?ACE n?>`: page number, tab, indent to here…) | Become nothing; the rest of the text is kept | Maybe info, for auto page numbers | A page number marker shows nothing. |
| `XMLElement` inside a character range (tagged run) | Text disappears | Error, if it occurs in real templates | Only tags around paragraphs and runs are read. |

To be agreed: which of these to build, their severity and copy.
