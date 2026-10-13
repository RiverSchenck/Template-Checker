# Validation classifiers reference

This document lists every validation classifier defined in [`ValidationClassifier.py`](../src/error_handling/ValidationClassifier.py), grouped by **`ValidationCategory`**. **Level** is determined by which enum the member belongs to: `ValidationError` → error, `ValidationWarning` → warning, `ValidationInfo` → info.

**FrontifyChecker** indicates whether [`FrontifyChecker.py`](../src/classes/FrontifyChecker.py) references that enum member when emitting a result.

Section titles use the category **label** from code (`ValidationCategory.*.label`); `WARNING` has no `.category` in the classifier (plain `auto()` member) and is listed under **General** because that is where it is used in `FrontifyChecker`.

---

## General (`ValidationCategory.GENERAL`)

| Error name | Level | Description | Help article | FrontifyChecker |
|------------|-------|-------------|--------------|-----------------|
| `ERROR` | error | Error | — | Yes — generic IDML / filesystem failures (unzip, missing dirs, `Fonts.XML`, `Styles.xml`, `Preferences.xml`, spread parse errors, etc.) |
| `FOLDER` | error | Folder error | — | No — not referenced |
| `IDML` | error | IDML error | — | Yes — missing or multiple `.idml` files |
| `ZIP` | error | ZIP file error | https://help.frontify.com/en/articles/5306557-what-input-formats-do-digital-and-print-templates-support | Yes — upload is not a ZIP |
| `MASTERPAGE` | error | Master Page can't be used. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_4bef512504 | Yes |
| `WARNING` | warning | *(No default message on this member; call site supplies text.)* | — | Yes — e.g. missing `MasterSpreads` directory |
| `DOCUMENT_BLEED` | warning | InDesign defined bleed is applied. | https://help.frontify.com/en/articles/8519462-bleed-settings-and-pdf-presets-for-digital-print-templates-indesign-based | Yes |
| `PAGE_ITEM_TRANSFORMATION` | error | Page item transformations (flip/skew) are not supported. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_1205c11ca4 | Yes — flipped or skewed text frames, shapes and groups |
| `TEXT_WRAP_ITEM` | error | Text Wrap is not supported. | https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_0882abae12 | Yes — images, shapes, lines and groups with wrap |

---

## Paragraph Styles (`ValidationCategory.PAR_STYLE`)

| Error name | Level | Description | Help article | FrontifyChecker |
|------------|-------|-------------|--------------|-----------------|
| `GRID_ALIGNMENT` | error | Grid alignment is not supported | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_f6aa8d5242 | Yes |
| `KERNING` | error | Kerning must be 'Metrics' | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_270ad57d8d | Yes — paragraph style |
| `FILL_TINT` | error | Fill Tint must be 100. (This may be inaccurate, testing currently) | https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_5cc6e214cf | Yes |
| `HYPHENATION` | warning | Hyphenation is not supported. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_55fa4b04cf | Yes |
| `COMPOSER` | warning | We recommend defining paragraph style composers as 'Adobe Single-line Composer', as browsers can render this composer. Otherwise, discrepencies between export and editing may occur. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_bfdd4bceb0 | Yes |

---

## Character Styles (`ValidationCategory.CHAR_STYLE`)

| Error name | Level | Description | Help article | FrontifyChecker |
|------------|-------|-------------|--------------|-----------------|
| `KERNING_CHAR` | error | Kerning must be 'Metrics' | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_270ad57d8d | Yes — character style |
| `FILL_TINT_CHAR` | error | Fill Tint must be 100. Frontify shows text colours without their tint. | https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_5cc6e214cf | Yes — character style |
| `TEXT_POSITION` | error | Superscript and subscript are not supported. | https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_85811f039b | Yes — per text run |
| `BASELINE_SHIFT` | warning | Baseline shift is not supported. Shifted text sits on the baseline in Frontify. | https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_85811f039b | Yes — per text run |

---

## Text Boxes (`ValidationCategory.TEXT_BOX`)

| Error name | Level | Description | Help article | FrontifyChecker |
|------------|-------|-------------|--------------|-----------------|
| `PARAGRAPH_STYLE` | error | Text found missing paragraph styles. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775 | Yes |
| `PARAGRAPH_STYLE_TEXT_BOX` | error | No paragraph styles were used. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775 | Yes |
| `TABLE` | error | Tables are not supported | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_b333040b53 | Yes |
| `AUTO_SIZE_TEXT_BOX` | error | Auto-size text boxes were not set up properly | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_e69bd3114b | Yes |
| `TEXT_COLUMNS` | error | Text columns are not supported | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_2ea0534af5 | Yes |
| `LINKED_TEXT_FRAME` | error | Linked (threaded) text frames are not supported. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_befb8c0698 | Yes |
| `OBJECT_STYLE_TEXT` | error | Object styles are not supported. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a92f4cebdf | Yes |
| `TEXT_WRAP` | error | Text Wrap is not supported. | https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_0882abae12 | Yes |
| `OVERRIDE` | warning | Overrides are not supported. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775 | Yes |
| `EMPTY_TEXT_FRAME` | info | Empty text frame found. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_68e2603775 | Yes |

---

## Fonts (`ValidationCategory.FONTS`)

| Error name | Level | Description | Help article | FrontifyChecker |
|------------|-------|-------------|--------------|-----------------|
| `FONTS_INCLUDED` | error | Package is missing fonts (whole family, or the styles named in the context). | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981 | Yes |
| `ADOBE_FONT` | error | Adobe Fonts are not supported. Use a desktop version of the font (OTF or TTF) instead. | https://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981 | Yes — Adobe Fonts styles not in Document fonts |
| `OTF_TTF_FONT` | error | Only OTF or TTF fonts are supported. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981 | Yes |
| `VARIABLE_FONT` | error | Variable fonts are not supported | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a3094cd981 | Yes |

---

## Images (`ValidationCategory.IMAGES`)

| Error name | Level | Description | Help article | FrontifyChecker |
|------------|-------|-------------|--------------|-----------------|
| `IMAGE_INCLUDED` | error | Package missing image link. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_eba8d9b8c1 | Yes |
| `EMBEDDED_IMAGE` | error | Embedded images are not supported. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_889cff064d | Yes |
| `IMAGE_TRANSFORMATION_IMAGE` | error | Image transformations are not supported. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_1205c11ca4 | Yes — image (item) transform |
| `IMAGE_TRANSFORMATION_CONTAINER` | error | Image transformations are not supported. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_1205c11ca4 | Yes — container transform |
| `PASTED_GRAPHICS` | error | Pasted graphics are not supported | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_889cff064d | Yes |
| `OBJECT_STYLE_IMAGE` | error | Object styles are not supported. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_a92f4cebdf | Yes |
| `UNUSED_IMAGE` | warning | Image(s) in package are unused making the package larger in size. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_66fcd1c2c2 | Yes |
| `LARGE_IMAGE` | info | Image is large. Verify that this large of an image is needed. | http://help.frontify.com/en/articles/3768754-prepare-indesign-documents-for-templates#h_66fcd1c2c2 | Yes |

---

## Notes

- **`ValidationWarning.WARNING`:** Not assigned a `ValidationCategory` in code (`WARNING = auto()` only). It is documented under **General** alongside other package / document-level items.
- **Rotation is not an issue** (Frontify carries it over). The rotation warnings were retired on 2026-10-12, so each transformation name now means one thing: a flip or skew error.
- **Help links:** Some entries use `http://` in source; consider normalizing to `https://` for user-facing docs.
