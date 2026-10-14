/* Generated from schema/results-v2.json by scripts/resultsTypes.mjs (npm run types). Don't edit. */

export interface Results {
  schema_version: 2;
  template_name: string;
  /**
   * Every issue, in the order found.
   */
  issues: Issue[];
  subjects_checked: {
    [k: string]: number;
  };
  /**
   * In document order.
   */
  pages: Page[];
  /**
   * The text of each text frame an issue is about, by subject id.
   */
  text_boxes: {
    [k: string]: TextBox;
  };
  checks: Check[];
}
export interface Issue {
  check:
    | "ERROR"
    | "IDML"
    | "ZIP"
    | "WARNING"
    | "MASTERPAGE"
    | "PARAGRAPH_STYLE"
    | "FONTS_INCLUDED"
    | "OTF_TTF_FONT"
    | "VARIABLE_FONT"
    | "IMAGE_INCLUDED"
    | "EMBEDDED_IMAGE"
    | "TRANSFORMATION"
    | "TABLE"
    | "PASTED_GRAPHICS"
    | "AUTO_SIZE_TEXT_BOX"
    | "TEXT_COLUMNS"
    | "LINKED_TEXT_FRAME"
    | "OBJECT_STYLE"
    | "GRID_ALIGNMENT"
    | "KERNING"
    | "KERNING_CHAR"
    | "TEXT_WRAP"
    | "FILL_TINT"
    | "FILL_TINT_CHAR"
    | "TEXT_POSITION"
    | "ADOBE_FONT"
    | "HYPHENATION"
    | "OVERRIDE"
    | "UNUSED_IMAGE"
    | "DOCUMENT_BLEED"
    | "COMPOSER"
    | "BASELINE_SHIFT"
    | "EMPTY_TEXT_FRAME"
    | "LARGE_IMAGE";
  severity: "error" | "warning" | "info";
  subject: Subject;
  location: Location;
  /**
   * The check's facts (its facts model in the catalogue), or null.
   */
  facts:
    | InheritedFacts
    | AutoSizeFacts
    | SizeFacts
    | CountFacts
    | MasterPageFacts
    | BleedFacts
    | ParagraphStyleFacts
    | OverrideFacts
    | MissingFontFacts
    | TransformationFacts
    | null;
  /**
   * The text it's about, when relevant.
   */
  text: string[] | null;
  /**
   * A short note in plain words, e.g. "font and size changed", made from the facts (src/results/notes.py). For a
   * package or parsing failure, why the upload couldn't be checked.
   */
  note: string | null;
}
/**
 * What the issue is about. Styles: id is the style's Self, name as InDesign shows it. Text frames and image
 * frames: the frame's Self (a story's Self for text not in a frame). Images and fonts: the file or family name.
 * Page items: Self, named by kind. The document: no id.
 */
export interface Subject {
  kind:
    "paragraph_style" | "character_style" | "text_frame" | "image" | "image_frame" | "font" | "page_item" | "document";
  id: string | null;
  name: string | null;
}
export interface Location {
  page_id: string | null;
  page_name: string | null;
  spread_id: string | null;
  /**
   * Self of the page item it points at.
   */
  item_id: string | null;
  bounds: Bounds | null;
}
/**
 * Where an item is on its page, in points from the page's top left.
 */
export interface Bounds {
  page_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * The item's tag, e.g. TextFrame.
   */
  kind: string;
}
/**
 * A style setting that comes from a style it's based on.
 */
export interface InheritedFacts {
  /**
   * Self of the style that sets it.
   */
  inherited_from: string;
}
export interface AutoSizeFacts {
  /**
   * InDesign's AutoSizingType, e.g. WidthOnly.
   */
  auto_size: string;
  no_line_breaks: boolean;
}
export interface SizeFacts {
  size_mb: number;
}
export interface CountFacts {
  count: number;
}
export interface MasterPageFacts {
  /**
   * What's on the master pages, in the order found.
   */
  elements: MasterElement[];
}
export interface MasterElement {
  /**
   * The element's tag, e.g. Rectangle.
   */
  kind: string;
  count: number;
}
export interface BleedFacts {
  bleed: Bleed;
}
/**
 * Offsets in points (may be negative); null when InDesign's value isn't a number.
 */
export interface Bleed {
  top: number | null;
  bottom: number | null;
  inside: number | null;
  outside: number | null;
}
export interface ParagraphStyleFacts {
  /**
   * The whole frame has no paragraph style (else one run of its text).
   */
  whole_frame: boolean;
  whitespace_only: boolean;
}
export interface OverrideFacts {
  text: string;
  /**
   * Property -> the value set on the text.
   */
  overrides: {
    [k: string]: string;
  };
}
export interface MissingFontFacts {
  missing_styles: string[];
  /**
   * No file of the family is in the package.
   */
  whole_family: boolean;
}
export interface TransformationFacts {
  kind: "flip" | "skew";
  /**
   * null for a flip.
   */
  rotation_deg: number | null;
}
export interface Page {
  id: string;
  name: string;
  index: number;
  spread_id: string | null;
  width: number;
  height: number;
  /**
   * Base64 JPEG, when previews were asked for.
   */
  preview: string | null;
  frames: Bounds[];
}
export interface TextBox {
  content: string;
  page_id: string | null;
}
/**
 * A catalogue entry: the only copy of a check's wording.
 */
export interface Check {
  key:
    | "ERROR"
    | "IDML"
    | "ZIP"
    | "WARNING"
    | "MASTERPAGE"
    | "PARAGRAPH_STYLE"
    | "FONTS_INCLUDED"
    | "OTF_TTF_FONT"
    | "VARIABLE_FONT"
    | "IMAGE_INCLUDED"
    | "EMBEDDED_IMAGE"
    | "TRANSFORMATION"
    | "TABLE"
    | "PASTED_GRAPHICS"
    | "AUTO_SIZE_TEXT_BOX"
    | "TEXT_COLUMNS"
    | "LINKED_TEXT_FRAME"
    | "OBJECT_STYLE"
    | "GRID_ALIGNMENT"
    | "KERNING"
    | "KERNING_CHAR"
    | "TEXT_WRAP"
    | "FILL_TINT"
    | "FILL_TINT_CHAR"
    | "TEXT_POSITION"
    | "ADOBE_FONT"
    | "HYPHENATION"
    | "OVERRIDE"
    | "UNUSED_IMAGE"
    | "DOCUMENT_BLEED"
    | "COMPOSER"
    | "BASELINE_SHIFT"
    | "EMPTY_TEXT_FRAME"
    | "LARGE_IMAGE";
  severity: "error" | "warning" | "info";
  subject_kinds: (
    "paragraph_style" | "character_style" | "text_frame" | "image" | "image_frame" | "font" | "page_item" | "document"
  )[];
  title: string;
  why: string;
  /**
   * Steps in InDesign, per kind of subject.
   */
  fix: {
    [k: string]: string[];
  };
  help_article: string | null;
  /**
   * False for package and parsing failures, which aren't listed among the checks a template passed.
   */
  is_check: boolean;
}
