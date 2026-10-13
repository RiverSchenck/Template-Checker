# Rules review against Frontify's conversion code (2026-10-12)

Follows [frontify-rule-checks.md](frontify-rule-checks.md): an issue exists so the user sees the same thing in
InDesign as in Frontify, so whatever Frontify forces, drops or assumes is what InDesign must match. Decisions in
[checker-rules.md](checker-rules.md) (manual kerning, font index, reference points, scale) are taken as given.

**Frontify read at:** `app-server` **`f3c6ae0a`** and `web-app` **`241fbfce`** (both 2026-10-01, clean working
trees). Frontify paths are relative to `app-server/application/` unless they start with `web-app/`, which means
`web-app/application/client/Feature/Publishing/`. Checker paths are relative to `python_backend/src/`.

**Method.** I read every file in `utility/Idml/`, the package importer and font reader, and the web-app text
renderer where a claim depends on it. Checker behaviour was read from `checks/`, `classes/` and `parsers/`. "0
references" means `grep` over `utility/Idml` and `module/IntermediateJson` finds the IDML attribute nowhere. Where a
claim rests on how InDesign writes IDML rather than on Frontify's code, it says so. No package was imported into
Frontify, so nothing here is tested end to end.

**Frequency.** The ranking in Part 2 uses my judgement of what appears in brand templates. The local IDMLs (in
`src/data/` and the fixture packs) are test or broken templates, not real ones, so they weren't used to count
anything.

---

## Summary

| Check | Verdict | Main finding |
|-------|---------|--------------|
| Text wrap | **Too loose (wrong object)** | Wrap is set on the *obstacle* (usually an image or shape), but only text frames are checked. Frontify drops wrap on everything. |
| Page item / image transformation | **Too loose** | Rotated **and** skewed items are reported as rotation (warning) only; Frontify mispositions them. |
| Fill tint | **Too loose** | Character styles aren't checked; Frontify drops their tint too. |
| Fonts included | **Too loose** | Fonts applied only through a character style aren't counted as used. Comparison is per family, while Frontify matches per face. |
| Object styles | **Too loose** | Edited default styles (`[Normal Text Frame]`, `[Normal Graphics Frame]`) pass, though Frontify ignores them like any other object style. |
| Composer | **Slightly too strict** | World-Ready Single-line (`HL Single Optyca`) is flagged, but Frontify keeps it unchanged. |
| Pasted graphics | **Slightly too loose** | Only rectangles are checked, and SVG content is ignored. |
| Master page items | Right | Basis in `checker-rules.md` needs a correction: master items *are* editable, and an edit changes every page. |
| Kerning, grid alignment, hyphenation, auto-size, columns, linked frames, tables, embedded images, OTF/TTF, variable fonts, bleed, images included/unused, large images, paragraph style, overrides | Right | — |

New checks proposed (Part 2), ranked by frequency × impact:
1. Superscript, subscript and baseline shift
2. Effects and partial transparency (drop shadow, glow, feather, fill/stroke/text opacity)
3. Tabs and tab stops
4. Stroke type, tint, arrowheads and alignment
5. Inline/anchored objects and hyperlinks
6. Paragraph rules and borders
7. Numbered and bulleted list formatting
8. Horizontal/vertical text scale
9. Small caps
10. CMYK and Lab swatches (colour conversion)

---

## Part 1 — Existing checks

### Master page items (`layout.masterpage_check`)

- **Frontify:** master-spread items are merged into the item list of every spread that uses the master
  (`utility/Idml/Renderer/JsonRenderer.php:59-66`). They're flagged `fromMaster` (`utility/Idml/MasterSpread.php:46`),
  but **nothing reads that flag**: `grep fromMaster` finds no use in `web-app/application/client`, `server/` or
  `module/`. So the claim in `checker-rules.md` that master items are "not editable" isn't supported by the code.
  What happens instead: on export, a change to an item that isn't on the edited spread is applied to the master
  spreads (`utility/Idml/Idml.php:218-222`, "`$this->applySpreadChanges($redundantChanges, $masterSpread);`"). The
  edit is written to the master, so it changes **every** page that uses it.
- **Nested masters** (a master based on another master) aren't resolved: only the master a page or spread applies
  directly is merged (`JsonRenderer.php:50-56`). **"Hide master items"** on a page isn't read (0 references to
  `ShowMasterItems`), so the items appear anyway.
- **Issue when:** a master spread contains any page item.
- **Severity:** error. **Verdict:** right. Update the "Master page items" row in `checker-rules.md`.

### Paragraph style missing (`text.par_style_check`)

- **Frontify:** `[No paragraph style]` and `[Basic Paragraph]` are rendered like any other style
  (`utility/Idml/TextFrame.php:180-183`, "`$paragraphStyle = $styles->getParagraphStyle(...)`").
- **Issue when:** text uses a default style. This is Template Checker's editing rule, not a rendering difference.
- **Severity:** error, as decided. Empty-frame info is fine. **Verdict:** right as a house rule.

### Hyphenation (`text.hyphenation_check`)

- **Frontify:** supported, but the browser does the hyphenating. `Hyphenation="true"` becomes CSS `hyphens: auto`
  with InDesign's limits and the language (`utility/Idml/PageItem.php:372-391`). The editor sets `lang` on each
  paragraph (`web-app/.../Component/TextEditor/Element/Element.tsx:60`), so it does hyphenate, but with the browser's
  dictionary and without InDesign's zone or penalties.
- **Issue when:** effective `Hyphenation` is `true`.
- **Severity:** warning. **Verdict:** right. A minor note: it's reported per paragraph rather than once per style, so
  it's noisier than the grid-alignment and composer checks.

### Overrides (`text.overrides_check`)

- **Frontify:** range attributes are merged over the style (`TextFrame.php:183`, "`array_merge($paragraphData,
  $this->getStyle($paragraphStyle), $this->getStyle($paragraph))`"; parts at `TextFrame.php:194-231`). Only the
  attributes that `Styles.php` reads survive (`utility/Idml/Styles.php:132-263` for characters, `279-466` for
  paragraphs). For example, a superscript override is dropped (see Part 2 §1).
- **Issue when:** any local formatting is applied.
- **Severity:** warning. **Verdict:** right.

### Kerning — paragraph and character (`text.kerning_check`)

- **Frontify:** `$ID/Optical` and `$ID/Metrics` both become `font-kerning: normal` (`PageItem.php:279-281`). Any other
  method (`None`, `Metrics - Roman only`) emits nothing, so the browser default (`auto`) applies, which normally
  kerns. The editor passes the value through (`web-app/.../Component/TextEditor/Helper/Styling/Styling.ts:66-73`).
- **Issue when:** the effective `KerningMethod` isn't Metrics: Optical (kerned differently) and None (Frontify kerns
  anyway). Manual kerning is covered by overrides (decision 1).
- **Severity:** error. **Verdict:** right.

### Fonts included (`fonts.fonts_included_check`)

- **Frontify:** text gets the PostScript name of the face matching `FontStyle`, falling back to Regular or Book, then
  the first face (`PageItem.php:246-255`; `utility/Idml/Fonts.php:81-98`). Font files are loaded per face, keyed by the
  `FontName` in InDesign's `AdobeFnt*.lst` (`server/Helper/Publishing/File/InDesignImportFontFileReader.php:33-49,
  83-88`). The `TypekitID` is copied into the JSON (`PageItem.php:253`), but nothing in the web-app reads
  `typekitId`, so Adobe Fonts (which InDesign doesn't package) aren't loaded at all.
- **Misses:**
  - Used fonts come from paragraph styles and from `AppliedFont` set directly on text
    (`classes/StoryParagraphData.py:47-49`, `classes/StoryCharacterData.py:34-36`). A font applied only through a
    **character style** (very common: a bold or brand-accent character style) is never added to the used fonts, so
    a missing file for it isn't reported.
  - The comparison is per family (`checks/fonts.py:13-15`). A package with Brand Regular but without Brand Bold
    passes, yet Frontify falls back for the bold text. This overlaps with the planned font-index check (decision 2),
    so it's noted here rather than proposed separately.
- **Issue when:** a face used anywhere (paragraph style, character style, local override) has no file in
  `Document fonts`. When Fonts.xml marks the face as an Adobe font (`TypekitID` set), the message should say that
  Adobe Fonts are never packaged.
- **Severity:** error. **Verdict:** too loose.

### OTF/TTF (`fonts.otf_ttf_font_check`)

- **Frontify:** accepts `ttf, ttc, otf, woff, woff2, eot, svg` and skips anything else silently
  (`InDesignImportFontFileReader.php:17, 74-79`).
- **Issue when:** a file isn't `.otf` or `.ttf`. That's stricter than Frontify for woff, woff2, eot and svg, but
  InDesign packages don't contain those. `.ttc` is accepted, but nothing picks a face inside it.
- **Severity:** error. **Verdict:** right.

### Variable fonts (`fonts.variable_font_check`)

- **Frontify:** no handling of design axes. Face lookup is by style name only (`Fonts.php:81-98`).
- **Issue when:** a used family is variable. **Severity:** error. **Verdict:** right.

### Images included / unused / zero-byte (`images.images_included_check`)

- **Frontify:** links are resolved by exact file name: `basename(LinkResourceURI)` (`utility/Idml/Shapes/Shape.php:333`),
  url-decoded, and looked up in the imported Links files (`Shape.php:347`; `Idml.php:93-96`). No match means an
  empty frame and no error. Every image file in `Links/` is uploaded, whether used or not
  (`server/Service/Publishing/Importer/InDesignPublishingImporter.php:48-59`;
  `server/Service/Publishing/PublishingImporter.php:58-66`).
- **Note:** the checker repairs mojibake and NFC-normalises both sides (`helpers/file_names.py:21-27`). That's right
  for reading the zip, but I couldn't confirm that Frontify normalises names the same way. A name that only matches
  after normalisation might still fail in Frontify (not verified).
- **Issue when:** a link has no file (error); a file has no link (warning); a file is 0 bytes (error).
  **Verdict:** right.

### Large images (`images.large_image_check`)

- **Frontify:** there's no size limit or downscaling on import. Large PSD or TIFF files go to a
  conversion-intensive queue (`server/Utility/FileExtensions.php:119-123`).
- **Severity:** info above 10 MB, our choice. **Verdict:** right.

### Embedded images (`images.embedded_image_check`)

- **Frontify:** `Shape.php:327-329` returns no link data when `StoredState="Embedded"`, so the frame is empty.
- **Issue when:** any link is embedded. **Severity:** error. **Verdict:** right.

### Image transformation (`images.image_transformation_check`)

- **Frontify:** the image inside a frame gets rotate and skew, plus only the **sign** of its scale
  (`utility/Idml/Shapes/Rectangle.php:80-88`, `Shape.php:84-92`). The frame uses the same matrix decomposition as
  other items (next section).
- **Misses:** rotation plus skew is reported as rotation only (see next section).
- **Verdict:** right, apart from that shared gap.

### Page item transformation (`layout.page_item_transformation_check`)

- **Frontify:** decomposes the matrix into rotation, shear and scale (`utility/Idml/Transformation.php:52-64`). When an
  item is rotated, the y-translation correction is skipped if it's also sheared (`PageItem.php:614-616`, "`// Don't
  apply y-translation if skewed`"). Resize and layout only understand rotation
  (`module/IntermediateJson/Core/Domain/Resize/Write/ItemGeometry.php:179-207`).
- **Misses:** `helpers/page_item_transform.py:58-68` returns ROTATION as soon as there's an angle, and only reports
  skew "when there's no rotation". A rotated **and** skewed item (made by rotating then shearing, or shearing a
  rotated group) is a warning, yet Frontify mispositions it. Test for non-perpendicular axes (`a·c + b·d ≠ 0`) before
  testing for rotation.
- **Minor:** Ovals and Polygons that hold an image are candidates too (only Rectangles with a Link are skipped,
  `classes/SpreadData.py:91-92`), so their frame is reported by both this check and the image check.
- **Issue when:** mirrored → error; axes not perpendicular (whether rotated or not) → error; rotation only → warning.
- **Verdict:** too loose for rotated and skewed items.

### Tables (`text.table_check`)

- **Frontify:** only `Content` and `Br` children of a CharacterStyleRange are kept (`utility/Idml/Story.php:325-340`). A
  `<Table>` and its cell text disappear.
- **Issue when:** any table. **Severity:** error. **Verdict:** right. See Part 2 §5 for other content dropped in the
  same place.

### Pasted graphics (`layout.pasted_graphics_check`)

- **Frontify:** a frame's graphic is the first `Image`, `EPS`, `PDF` or `SVG` element (`utility/Idml/Spread.php:27`,
  `Shape.php:280-294`). Without a `Link` there's no image data (`Shape.php:326-329`), so the frame is empty.
- **Misses:** only `Rectangle` elements are checked, for `PDF`, `EPS` and `Image` only (`classes/SpreadData.py:108-128`).
  Graphics pasted into an Oval or Polygon (a pasted logo in a circle) or an `SVG` aren't counted.
- **Issue when:** any graphic element in any frame type has no `Link`. **Severity:** error. **Verdict:** slightly too
  loose.

### Document bleed (`layout.document_bleed_check`)

- **Frontify:** bleed is never read (0 references to `DocumentBleed*` outside tests).
- **Issue when:** any bleed offset isn't 0. **Severity:** warning. **Verdict:** right.

### Auto-size (`layout.auto_size_text_box_check`)

- **Frontify:** WidthOnly and HeightAndWidth always get `whiteSpace: nowrap` (`PageItem.php:510-526`).
  `UseNoLineBreaksForAutoSizing` is read (`TextFrame.php:46-48`) and never used. All nine reference points are mapped,
  and CenterPoint is assumed when none is set (`PageItem.php:530-568`). Minimum width and height are supported
  (`PageItem.php:503-508`).
- **Issue when:** WidthOnly or HeightAndWidth has "No Line Breaks" off (an absent attribute means off, InDesign's
  default), or the type is unknown.
- **Severity:** error. **Verdict:** right. The checker reads only the frame's own `TextFramePreference`
  (`classes/TextFrame.py:31-41`). Auto-size coming from an object style is covered by the object-style check, except
  for edited default styles (see below).

### Text columns (`layout.text_columns_check`)

- **Frontify:** column count and gutter become CSS `columnCount`/`columnGap` (`PageItem.php:498-501`;
  `web-app/.../Component/CanvasFrame/TextItemEditor.tsx:58`). `column-fill` is never set, so the browser **balances**
  the columns, while InDesign fills column 1 first. Fixed and maximum column width are read and dropped
  (`TextFrame.php:34-35`). Span or split columns are never read (0 references to `SpanColumn`).
- **Issue when:** `TextColumnCount > 1`. **Severity:** error: balanced columns look clearly different for most texts.
  **Verdict:** right.

### Text wrap (`layout.text_wrap_check`)

- **Frontify:** wrap is never read (0 references to `TextWrap`). No object pushes text away in Frontify.
- **The checker looks at the wrong object.** It reads `TextWrapPreference` on **text frames** only
  (`classes/TextFrame.py:45-47`; `checks/layout.py:87-95`). In InDesign, wrap is set on the **obstacle**: typically an
  image frame, a shape or a group sitting over a text frame. A text frame's own wrap only affects *other* text that
  overlaps it. The common case (an image with "Wrap around bounding box" pushing body copy aside) isn't flagged, and
  in Frontify the text runs under the image.
- **Issue when:** any page item (Rectangle, Oval, Polygon, GraphicLine, Group, TextFrame) has `TextWrapMode` other than
  `None`. Ideally limit it to items that overlap a text frame without `IgnoreWrap="true"`; if overlap is too much
  work, report all of them. Inherited wrap from a custom object style is already an object-style error.
- **Severity:** error. **Verdict:** too loose. This is the most valuable fix in this review.

### Linked text frames (`layout.linked_text_frame_check`)

- **Frontify:** `PreviousTextFrame` and `NextTextFrame` are read (`PageItem.php:134-135`) and never used. Each frame
  renders its whole story (`TextFrame.php:124-130`).
- **Issue when:** either attribute isn't `n`. **Severity:** error. **Verdict:** right. A minor robustness point: an
  absent attribute (`None`) counts as linked (`classes/TextFrame.py:25-26`); InDesign always writes both, so this
  doesn't matter in practice.

### Object styles (`layout.object_style_check`)

- **Frontify:** only the style's stroke colour is used (`PageItem.php:781-783`). The style reader keeps stroke weight,
  stroke colour, fill and BasedOn (`Styles.php:482-509`). Attributes missing on the item fall back to the document's
  `PageItemDefault`, not to the object style (`PageItem.php:42-52`).
- **Misses:** `[Normal Text Frame]` and `[Normal Graphics Frame]` count as default (`document.py:18-20`), but designers
  often **edit** them (inset spacing, auto-size, fill, stroke, effects). InDesign then omits those values on each
  frame, which inherits them from the style (IDML behaviour). Frontify, reading only the frame, loses them.
- **Issue when:** a custom object style is applied (as now), or a default object style in `Styles.xml` sets anything
  that differs from a fresh document's default. The simplest test is to compare the style element's attributes and
  children with a reference copy from a new document.
- **Severity:** error. **Verdict:** too loose for edited default styles.

### Grid alignment (`text.grid_alignment_check`)

- **Frontify:** read (`Styles.php:333-338`, the same block twice) and never used.
- **Issue when:** effective `GridAlignment` isn't None. **Severity:** error. **Verdict:** right.

### Composer (`text.composer_check`)

- **Frontify:** the composer is copied into the JSON (`TextFrame.php:169-171`) but not rendered: the browser breaks
  lines. When an edited paragraph is written back, the composer is mapped (`Idml.php:401-408`): Paragraph or
  Single-line becomes `HL Single`; **anything else**, including World-Ready, becomes `HL Single Optyca`
  (World-Ready Single-line, `Story.php:22-25`).
- **Too strict:** `HL Single Optyca` stays `HL Single Optyca`, so it doesn't change on export, yet the check flags
  everything except `HL Single` (`checks/text.py:172`). World-Ready Paragraph (`HL Composer Optyca`) is rightly
  flagged.
- **Issue when:** effective composer is `HL Composer` or `HL Composer Optyca`.
- **Severity:** warning. **Verdict:** slightly too strict (affects Arabic, Hebrew and Indic templates).

### Fill tint on text (`text.other_checks`)

- **Frontify:** text colour is the swatch alone. `FillTint` isn't read for paragraph or character styles
  (`Styles.php:167-169, 297-299`). Tint is only applied to frame fills (`PageItem.php:720-721`). Tint **swatches**
  (`Tint/…`) are resolved properly (`utility/Idml/Graphic.php:201-222`), which is the fix to suggest in the message.
- **Misses:** only paragraph styles are read (`parsers/StylesParser.py:25`). A **character style** with a tint (common:
  a 60% grey "caption" character style) isn't checked; `StylesParser.py:36-44` doesn't collect `FillTint` for
  character styles. A tint applied directly to text is an override (warning), although Frontify drops it.
- **Issue when:** effective `FillTint` isn't -1 or 100 in a paragraph **or character** style.
- **Severity:** error. **Verdict:** too loose.

---

## Part 2 — Proposed checks

Ranked by how often I'd expect the feature in brand templates × how badly it differs in Frontify. "Effective"
values follow the paragraph or character style's `BasedOn` chain plus local overrides. For page items it's the
item, then its object style.

### 1. Superscript, subscript and baseline shift

- **Why it's common:** ®, ™, footnote markers, m² and CO₂ appear in almost every brand's legal lines and product copy.
- **Frontify:** `Position` is read for character and paragraph styles (`Styles.php:214-216, 381-383`) but not
  rendered: `PageItem::getStyle` has no case for it (`PageItem.php:242-572`). The only other reference is Frontify's
  own import validator. `BaselineShift` has 0 references. Superscripts come out full size on the baseline.
- **Issue when:** effective `Position` is anything but `Normal` (Superscript, Subscript, OTSuperscript, OTSubscript,
  OTNumerator, OTDenominator), or `BaselineShift` isn't 0.
- **Severity:** error for Position (clearly won't match); warning for baseline shift (a few points off).

### 2. Effects and partial transparency

- **Why it's common:** drop shadows on images and text, and semi-transparent overlay shapes, are standard in social,
  web-banner and presentation templates.
- **Frontify:**
  - Drop shadow is read **only on text frames** (`utility/Idml/TextFrame.php:67, 70-96`) and becomes CSS
    `textShadow`. It shadows the glyphs, not the frame. Its opacity is lost whenever the effect colour is a swatch
    (always, in practice): `utility/Idml/Elements/DropShadowSetting.php:35`, "`$color = $colorModel ?
    $colorModel['color'] : [0, 0, 0, $opacity];`". Spread and noise are dropped.
  - Shapes (rectangles, ovals, polygons, so image frames too) read only inner shadow and gradient feather
    (`Shape.php:42-43`). A drop shadow on an image or shape is dropped. Inner shadow has the same opacity issue
    (`utility/Idml/Elements/InnerShadowSetting.php:47`).
  - Outer glow, inner glow, bevel and emboss, satin, basic feather and directional feather have 0 references.
  - Object opacity and blend mode are supported (`PageItem.php:757-773, 470-473`). Fill opacity is applied only to
    text frames and rectangles (`PageItem.php:723-739`), so fill opacity on an oval or polygon is lost.
    `StrokeTransparencySetting` has 0 references. Text-level opacity (`ContentTransparencySetting` on a text frame)
    is read only for drop shadows (`TextFrame.php:21-24`).
- **Issue when:**
  - **Error:** drop shadow on any non-text item; any glow, bevel, satin, basic or directional feather; inner shadow or
    gradient feather on a text frame; fill opacity < 100 on an Oval or Polygon; any stroke or text-level opacity or
    effect.
  - **Warning:** drop shadow on a text frame (rendered as a text shadow at full opacity).
- **Severity:** as above.

### 3. Tabs and tab stops

- **Why it's common:** contact blocks ("T\t+41 …"), price lists, forms and aligned label/value pairs use tabs. So do
  bullets typed by hand.
- **Frontify:** tab stops (`TabList`) are only used to place a bullet (`PageItem.php:304-314`), and position is the
  only thing read from each stop (`Styles.php:453-462`); alignment, leader and alignment character are never read.
  Text is rendered `white-space: pre-wrap` (`web-app/.../Component/TextEditor/constants.ts:38-42`). No `tab-size` is
  set anywhere in the Publishing feature (`grep tabSize` finds nothing), so a tab is the browser default of 8
  spaces. Right, centre and decimal tabs, and leaders, are lost.
- **Issue when:** text content contains a tab character (`\t`) outside a list's auto-generated bullet. Say "error"
  when the paragraph defines tab stops (alignment will clearly differ) and "warning" when it relies on InDesign's
  default stops.
- **Severity:** error / warning as above.

### 4. Stroke type, tint, arrowheads and alignment

- **Why it's common:** dashed or dotted dividers and coupon borders, tinted hairlines (a 30% grey rule), and arrows on
  lines appear in many layouts.
- **Frontify:** borders are always solid: `"{$strokeWeight}px solid"` (`PageItem.php:922`;
  `utility/Idml/Shapes/GraphicLine.php:17`). `StrokeType` and line ends (`LeftLineEnd`/`RightLineEnd`) have 0
  references. `StrokeTint` is read (`PageItem.php:138`) and never used; the stroke colour is the swatch at 100%
  (`PageItem.php:775-786`). `StrokeAlignment` has 0 references.
- **Issue when:** effective `StrokeType` isn't Solid; `StrokeTint` isn't -1 or 100; either line end isn't None (error).
  `StrokeAlignment` isn't Center (warning: where the stroke sits depends on SVG versus CSS border, which I haven't
  verified per item type).
- **Severity:** error, except alignment (warning).

### 5. Inline/anchored objects, hyperlinks and other non-text content in stories

- **Why it's common:** icons placed inline in text (phone, mail, social icons), logos anchored to a headline, and
  website or email hyperlinks in footers of digital templates.
- **Frontify:** a CharacterStyleRange keeps only its direct `Content` and `Br` children (`Story.php:325-340`).
  - **Anchored or inline frames** (`Rectangle`, `TextFrame`, `Group`… nested in the story) are dropped. Because they
    live in Stories rather than Spreads, none of the checker's frame checks see them either.
  - **Hyperlinks:** in IDML, hyperlinked text sits inside `<HyperlinkTextSource>` within the range (IDML structure,
    not tested in Frontify). It isn't a direct `Content` child, so the **linked text itself disappears**.
    `HyperlinkTextSource` has 0 references.
  - **Text variables** (`TextVariableInstance`) and **special characters** written as processing instructions (auto
    page number, indent-to-here, end nested style) are dropped the same way.
  - The checker has the same blind spot: `StoryCharacterData` only collects direct `Content`
    (`classes/StoryCharacterData.py:29-32`).
- **Issue when:** a CharacterStyleRange has a child element other than `Content`, `Br`, `Properties` or `Table`
  (tables have their own check), or contains a processing instruction.
- **Severity:** error (content disappears).

### 6. Paragraph rules and borders

- **Why it's common:** a line above or below headings, or a coloured bar behind a label, is often built into
  paragraph styles in brand templates.
- **Frontify:** `RuleAbove`, `RuleBelow` and `ParagraphBorder` have 0 references. Paragraph **shading** is supported
  (`utility/Idml/ParagraphShading.php:123-154`).
- **Issue when:** effective `RuleAboveOn` or `RuleBelowOn` is true, or `ParagraphBorderOn` is true.
- **Severity:** error (the line disappears).

### 7. Numbered and bulleted list formatting

- **Why it's common:** bullet lists are in most text-heavy templates; numbered steps are common in guides and
  flyers.
- **Frontify:**
  - The number text is always "counter + `.`" (`web-app/.../Component/TextEditor/Helper/Styling/Styling.ts:177`).
    `NumberingExpression` is read (`Styles.php:342-344`) and never used. `NumberingStartAt` has 0 references.
    Formats map to CSS list styles, and every leading-zero variant becomes `decimal-leading-zero`
    (`utility/Idml/ListStyle.php:19-34`).
  - Of the bullet's character style, only its colour is used (`Styles.php:531-542`): its font, size and
    position are lost. The bullet glyph is taken by value (`TextFrame.php:159-163`) and drawn in the text's font, so
    a bullet from a symbol font (`UnicodeWithFont`) can show a different glyph.
- **Issue when:** `NumberingExpression` isn't the default `^#.^t`; a start number is set (or the list continues from a
  previous frame); the format is `001…` or `0001…`; a bullet character style changes anything but colour; or the
  bullet glyph comes from a different font than the text.
- **Severity:** error for numbering text (it reads differently); warning for bullet font, size or glyph.

### 8. Horizontal and vertical text scale

- **Why it's common:** designers squeeze headlines or labels to fit (95% horizontal scale is a common habit).
- **Frontify:** `HorizontalScale` and `VerticalScale` are read (`Styles.php:229-238, 396-405`) and never rendered; only
  Frontify's own validator uses them.
- **Issue when:** effective `HorizontalScale` or `VerticalScale` isn't 100.
- **Severity:** error (text width changes, so line breaks change).

### 9. Small caps

- **Why it's common:** used in some brand typographies for labels, acronyms and eyebrow text. Less common than the
  items above, but the result is badly wrong.
- **Frontify:** `SmallCaps` becomes `text-transform: lowercase`, and `CapToSmallCap` (OpenType All Small Caps) becomes
  `capitalize` (`PageItem.php:327-343`). Spans render `textTransform` (`web-app/.../Component/TextEditor/constants.ts:188`).
  The text shows in lowercase, or with each word capitalised.
- **Issue when:** effective `Capitalization` is `SmallCaps` or `CapToSmallCap`.
- **Severity:** error.

### 10. CMYK and Lab swatches

- **Why it's common:** brand templates that started as print documents use CMYK process swatches and Pantone spot
  colours (stored as Lab or CMYK).
- **Frontify:** CMYK is converted with one fixed profile, ECI ISO Coated v2 (`utility/Idml/Color.php:39-40,
  196-227`), not the document's CMYK profile. Lab is converted with a D65 reference white (`Color.php:32-34,
  106-117`), while InDesign's Lab is D50 (ICC standard, from general knowledge). On-screen colours in Frontify can
  shift from what the designer approved, especially on a SWOP-profile document or with Lab Pantones.
- **Issue when:** a used swatch has `Space="CMYK"` or `Space="LAB"`. Recommend RGB (or a hex-matched) swatch for
  digital templates.
- **Severity:** info (worth a check; small differences, not breakage).

### Considered and left out

Rare in brand templates, or minor, so not proposed: non-rounded corner options (Bevel, Inset, Fancy, Inverse
Rounded) render square, since only `RoundedCorner` is read (`PageItem.php:430-457`); vertical justification
"Justify" renders as centre (`PageItem.php:491-496`); underline type and strikethrough options (always solid,
`Styles.php:182-186`); justification "Towards/Away from spine" (no case in `PageItem.php:344-371`); gradient fills on
text (`Graphic.php:80-83` returns no colour for a gradient); placed InDesign pages (`ImportedPage` isn't one of the
graphic types in `Spread.php:27`).

---

## Noticed in passing (Frontify, not checker rules)

- **`Underline="false"` may render an underline.** `getStyle` tests `isset($attributes['underline'])`
  (`PageItem.php:416`), and the string `'false'` is truthy at `PageItem.php:262`, so a run with `Underline="false"`
  (e.g. a character style that switches underline off) gets `textDecoration: underline solid …`. The editor shows
  nothing only when the thickness is empty (`Styling.ts:95-97`). Worth a Frontify ticket; not tested.
- **Group opacity can come from a child.** `setBlendingSetting` uses `getElementsByTagName('TransparencySetting')`,
  which searches all descendants (`PageItem.php:760`), so a group without its own opacity takes the first child's,
  and the child applies it again.
- **Effects ignore `Applied`.** Inner shadow and gradient feather are drawn whenever their element exists
  (`Shape.php:163-176, 182-195`), even with `Applied="false"`.

---

## Verification

Every `file:line` above was re-opened at the commits listed at the top and checked against the quote or claim.
Three claims rest on IDML structure or general knowledge rather than Frontify's code, and are marked where they
appear: hyperlink text inside `HyperlinkTextSource`, default object styles being inherited rather than written on
each frame, and InDesign's Lab using D50. The "Noticed in passing" items are read from the code, not reproduced.
