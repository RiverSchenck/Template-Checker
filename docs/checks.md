# Checks

Every check the Template Checker runs on an InDesign package, with the wording the web app, the customer summary
and analytics show. Generated from the catalogue
([`python_backend/src/results/catalogue.py`](../python_backend/src/results/catalogue.py)); don't edit it by hand:
change the catalogue and run `python -m src.results.checks_doc` in `python_backend`. Why each rule exists, and how
Frontify behaves, is in [checker-rules.md](checker-rules.md).

| Check | Severity | About | Title |
|---|---|---|---|
| `MASTERPAGE` | Blocker | document | Items on a master page |
| `PARAGRAPH_STYLE` | Blocker | text frame | Text without a paragraph style |
| `FONTS_INCLUDED` | Blocker | font | Font missing from the package |
| `OTF_TTF_FONT` | Blocker | font | Unsupported font format |
| `VARIABLE_FONT` | Blocker | font | Variable font used |
| `IMAGE_INCLUDED` | Blocker | image | Linked image missing from the package |
| `EMBEDDED_IMAGE` | Blocker | image | Embedded image |
| `TRANSFORMATION` | Blocker | image, image frame, page item | Item is flipped or skewed |
| `TABLE` | Blocker | text frame | Table in a text frame |
| `PASTED_GRAPHICS` | Blocker | document | Pasted graphic |
| `AUTO_SIZE_TEXT_BOX` | Blocker | text frame | Auto-size text frame set up incorrectly |
| `TEXT_COLUMNS` | Blocker | text frame | Text frame has columns |
| `LINKED_TEXT_FRAME` | Blocker | text frame | Threaded (linked) text frames |
| `OBJECT_STYLE` | Blocker | text frame, image | Object style applied |
| `GRID_ALIGNMENT` | Blocker | paragraph style | Text aligned to the baseline grid |
| `KERNING` | Blocker | paragraph style | Kerning isn’t set to Metrics |
| `KERNING_CHAR` | Blocker | character style | Kerning isn’t set to Metrics |
| `TEXT_WRAP` | Blocker | text frame, page item | Text wrap applied |
| `FILL_TINT` | Blocker | paragraph style | Text color tint isn’t 100% |
| `FILL_TINT_CHAR` | Blocker | character style | Text color tint isn’t 100% |
| `TEXT_POSITION` | Blocker | character style | Superscript or subscript text |
| `ADOBE_FONT` | Blocker | font | Adobe Font used |
| `HYPHENATION` | Warning | paragraph style | Hyphenation is on |
| `OVERRIDE` | Warning | text frame | Text formatted outside its paragraph style |
| `UNUSED_IMAGE` | Warning | image | Unused images in the package |
| `DOCUMENT_BLEED` | Warning | document | Document has bleed |
| `COMPOSER` | Warning | paragraph style | Paragraph Composer used |
| `BASELINE_SHIFT` | Warning | character style | Baseline shift used |
| `EMPTY_TEXT_FRAME` | Info | text frame | Empty text frame |
| `LARGE_IMAGE` | Info | image | Large image |

## Blockers

Break the template, or will very likely make it look different.

### Items on a master page

`MASTERPAGE` · About: document

Frontify only reads items on the document pages, so anything on a master page (called a parent page in newer InDesign versions) is ignored or breaks the template.

**Fix in InDesign:**

- In the Pages panel, open the master (parent) page and move its items onto the document pages, or delete them.

**Facts:** `elements` (What's on the master pages, in the order found).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_4bef512504)

### Text without a paragraph style

`PARAGRAPH_STYLE` · About: text frame

Frontify uses paragraph styles to format text and decide what can be edited. Text set to [Basic Paragraph] or [No Paragraph Style] has nothing to follow.

**Fix in InDesign:**

- Select the text (or the whole frame) and apply a paragraph style in Window > Styles > Paragraph Styles (any style except [Basic Paragraph] or [No Paragraph Style]).

**Facts:** `whole_frame` (The whole frame has no paragraph style (else one run of its text)), `whitespace_only`.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775)

### Font missing from the package

`FONTS_INCLUDED` · About: font

Frontify needs the font files to render the text, otherwise the template falls back to another font.

**Fix in InDesign:**

- Make sure the font is installed or activated on your computer.
- Package again with File > Package with "Copy Fonts" checked, and zip the whole folder, including "Document fonts".

**Facts:** `missing_styles`, `whole_family` (No file of the family is in the package).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981)

### Unsupported font format

`OTF_TTF_FONT` · About: font

Frontify can only use OpenType (.otf) and TrueType (.ttf) fonts. Other formats, such as Type 1, can’t be loaded.

**Fix in InDesign:**

- Get an OTF or TTF version from the font vendor and swap it in with Type > Find/Replace Font.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981)

### Variable font used

`VARIABLE_FONT` · About: font

Frontify doesn’t support variable fonts, so text using them won’t render correctly.

**Fix in InDesign:**

- Install the static (non-variable) version of the font and swap it in with Type > Find/Replace Font.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981)

### Linked image missing from the package

`IMAGE_INCLUDED` · About: image

The document links to an image that isn’t in the package, so Frontify can’t show it.

**Fix in InDesign:**

- Relink any missing images in Window > Links.
- Package again with File > Package with "Copy Linked Graphics" checked.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_eba8d9b8c1)

### Embedded image

`EMBEDDED_IMAGE` · About: image

Frontify needs images as separate linked files and can’t read images embedded in the document.

**Fix in InDesign:**

- In Window > Links, select the image and choose Unembed Link from the panel menu.
- Save it into the Links folder and package again.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_889cff064d)

### Item is flipped or skewed

`TRANSFORMATION` · About: image, image frame, page item

Frontify can’t reproduce flipped or skewed items, so they’ll look different or break when edited.

**Fix in InDesign:**

- For images:
  - Double-click to select the image inside the frame, then choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).
  - If you need the flipped look, save a flipped copy of the image file instead.
- For image frames:
  - Select the image frame and choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).
- For page items:
  - Select the item and choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).

**Facts:** `kind`, `rotation_deg` (null for a flip).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_1205c11ca4)

### Table in a text frame

`TABLE` · About: text frame

Frontify doesn’t support InDesign tables.

**Fix in InDesign:**

- Click into the table and choose Table > Convert Table to Text, or rebuild it with separate text frames.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_b333040b53)

### Pasted graphic

`PASTED_GRAPHICS` · About: document

Graphics pasted straight into InDesign aren’t linked files, so Frontify can’t read them.

**Fix in InDesign:**

- Save the graphic as a file (for example SVG, PDF or PNG), delete the pasted version and place the file with File > Place.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_889cff064d)

### Auto-size text frame set up incorrectly

`AUTO_SIZE_TEXT_BOX` · About: text frame

Frontify grows auto-size frames as people type, and can’t match how these settings resize the frame.

**Fix in InDesign:**

- For each frame, open Object > Text Frame Options > Auto-Size and make the change noted next to it.

**Facts:** `auto_size` (InDesign's AutoSizingType, e.g. WidthOnly), `no_line_breaks`.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_e69bd3114b)

### Text frame has columns

`TEXT_COLUMNS` · About: text frame

Frontify doesn’t support multiple columns inside one text frame.

**Fix in InDesign:**

- Set Columns to 1 in Object > Text Frame Options. Use separate text frames if you need columns.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_2ea0534af5)

### Threaded (linked) text frames

`LINKED_TEXT_FRAME` · About: text frame

Frontify doesn’t support text flowing from one frame into another.

**Fix in InDesign:**

- Turn on View > Extras > Show Text Threads, then double-click a frame’s out port to break the thread so each frame holds its own text.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_befb8c0698)

### Object style applied

`OBJECT_STYLE` · About: text frame, image

Frontify doesn’t apply object styles, so the frame will look different.

**Fix in InDesign:**

- For text frames:
  - Select the frame and apply [None] or [Basic Text Frame] in Window > Styles > Object Styles, then re-apply any formatting you need directly.
- For images:
  - Select the frame and apply [None] or [Basic Graphics Frame] in Window > Styles > Object Styles, then re-apply any formatting you need directly.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a92f4cebdf)

### Text aligned to the baseline grid

`GRID_ALIGNMENT` · About: paragraph style

Frontify doesn’t use InDesign’s baseline grid, so line spacing will change.

**Fix in InDesign:**

- In the paragraph style, go to Indents and Spacing and set Align to Grid to None.

**Facts:** `inherited_from` (Self of the style that sets it).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_f6aa8d5242)

### Kerning isn’t set to Metrics

`KERNING` · About: paragraph style

Frontify spaces letters using the font’s own kerning (Metrics). Other settings make text shift when it’s edited.

**Fix in InDesign:**

- In the paragraph style, go to Basic Character Formats and set Kerning to Metrics.

**Facts:** `inherited_from` (Self of the style that sets it).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_270ad57d8d)

### Kerning isn’t set to Metrics

`KERNING_CHAR` · About: character style

Frontify spaces letters using the font’s own kerning (Metrics). Other settings make text shift when it’s edited.

**Fix in InDesign:**

- In the character style, go to Basic Character Formats and set Kerning to Metrics.

**Facts:** `inherited_from` (Self of the style that sets it).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_270ad57d8d)

### Text wrap applied

`TEXT_WRAP` · About: text frame, page item

Frontify doesn’t support text wrap, so text won’t flow around objects and will run underneath them.

**Fix in InDesign:**

- For text frames:
  - Select the frame and choose No Text Wrap in Window > Text Wrap.
- For page items:
  - Select the image, shape or group and choose No Text Wrap in Window > Text Wrap.
  - Then make room for it with the text frame’s size or insets instead.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_0882abae12)

### Text color tint isn’t 100%

`FILL_TINT` · About: paragraph style

Frontify shows text colors at full strength, so tinted text will look darker.

**Fix in InDesign:**

- In the paragraph style, go to Character Color and set Tint to 100%.

**Facts:** `inherited_from` (Self of the style that sets it).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_5cc6e214cf)

### Text color tint isn’t 100%

`FILL_TINT_CHAR` · About: character style

Frontify shows text colors at full strength, so tinted text will look darker.

**Fix in InDesign:**

- In the character style, go to Character Color and set Tint to 100%.
- To keep the lighter color, make a tint swatch (Swatches panel > New Tint Swatch) and apply that instead.

**Facts:** `inherited_from` (Self of the style that sets it).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_5cc6e214cf)

### Superscript or subscript text

`TEXT_POSITION` · About: character style

Frontify doesn’t support superscript or subscript, so the text shows at full size on the baseline (for example ® or a footnote number).

**Fix in InDesign:**

- Set Position to Normal in the character style (Basic Character Formats) or in the Character panel.
- For symbols like ® or ™, use a smaller point size in a character style instead, or a font’s superscript glyphs.

**Facts:** `inherited_from` (Self of the style that sets it).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_85811f039b)

### Adobe Font used

`ADOBE_FONT` · About: font

Adobe Fonts aren’t supported in Frontify templates (for licensing reasons), so the template falls back to another font.

**Fix in InDesign:**

- Install a desktop version of the font (OTF or TTF) that you’re licensed to use, and switch the text to it: Type > Find/Change Font, or update the paragraph and character styles.
- Package again with "Copy Fonts" checked, and zip the whole folder, including "Document fonts".

**Facts:** `missing_styles`, `whole_family` (No file of the family is in the package).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981)

## Warnings

May make the template look different than expected.

### Hyphenation is on

`HYPHENATION` · About: paragraph style

Browsers hyphenate differently from InDesign, so lines may break in different places.

**Fix in InDesign:**

- In the paragraph style, go to Hyphenation and uncheck Hyphenate.

**Facts:** `inherited_from` (Self of the style that sets it).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_55fa4b04cf)

### Text formatted outside its paragraph style

`OVERRIDE` · About: text frame

Formatting added by hand on top of a paragraph style (shown as a + next to the style name) may be lost or look different in Frontify.

**Fix in InDesign:**

- Click into the text. A + after the style name in Window > Styles > Paragraph Styles means it has extra formatting.
- To remove it, select the text and click Clear Overrides at the bottom of the Paragraph Styles panel.
- To keep the look, update the style to match instead (right-click the style > Redefine Style), or use a character style for single words.

**Facts:** `text`, `overrides` (Property -> the value set on the text).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775)

### Unused images in the package

`UNUSED_IMAGE` · About: image

These files aren’t used in the document and only make the package bigger.

**Fix in InDesign:**

- Delete the unused files from the Links folder before zipping the package.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_66fcd1c2c2)

### Document has bleed

`DOCUMENT_BLEED` · About: document

Bleed is added to every export, which is right for print templates but usually unwanted for digital ones.

**Fix in InDesign:**

- For a digital template, set bleed to 0 in File > Document Setup > Bleed and Slug. For print templates, bleed is fine.

**Facts:** `bleed`.

[Help article](https://help.frontify.com/en/articles/8519462-bleed-settings-and-pdf-presets-for-digital-print-templates-indesign-based)

### Paragraph Composer used

`COMPOSER` · About: paragraph style

The Adobe Paragraph Composer breaks lines differently from browsers, so text may reflow in Frontify.

**Fix in InDesign:**

- In the paragraph style, go to Justification and set Composer to Adobe Single-line Composer.

**Facts:** `inherited_from` (Self of the style that sets it).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_bfdd4bceb0)

### Baseline shift used

`BASELINE_SHIFT` · About: character style

Frontify doesn’t support baseline shift, so shifted text sits on the baseline.

**Fix in InDesign:**

- Set Baseline Shift to 0 pt in the character style (Advanced Character Formats) or in the Character panel.

**Facts:** `inherited_from` (Self of the style that sets it).

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_85811f039b)

## Infos

A heads up: worth a check, but often fine.

### Empty text frame

`EMPTY_TEXT_FRAME` · About: text frame

Empty frames are allowed, but are often left over by accident.

**Fix in InDesign:**

- Delete the frame if it isn’t needed.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775)

### Large image

`LARGE_IMAGE` · About: image

Very large images slow down editing and exporting in Frontify.

**Fix in InDesign:**

- Reduce the image’s pixel size or file size if it doesn’t need to be this large.

**Facts:** `size_mb`.

[Help article](https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_66fcd1c2c2)

## Package and parsing failures

Reported when a package can't be checked (`ERROR`, `IDML`, `ZIP`, `WARNING`); the issue's detail says why. They aren't listed among the checks a template passed.

## Adding a check

1. Write the check in the `src/checks/` module for its theme and register it (`src/checks/__init__.py` says how).
2. Add its entry to the catalogue (`src/results/catalogue.py`): key, severity, what it's about, title, why, fix steps
   and help article, and the facts model its issues record (`src/results/facts.py`), if any.
3. Add its classifier to `src/results/classifiers.py` (the class for its severity), and report it with the subject
   it's about (`report(..., subject=...)`, or the `at_*` helpers in `src/checks/_report.py`).
4. Regenerate what's built from the catalogue and the results, in this order, and review each diff:
   - in `python_backend`: `python -m src.results.checks_doc` (this page), `python -m src.results.models`
     (`schema/results-v2.json`), `python -m testing.golden --update` and
     `UPDATE_SUMMARY_GOLDENS=1 pytest testing/unit_tests/customer_summary/test_summary_goldens.py`;
   - in `react-frontend`: `npm run types` and `npm run fixtures`.
