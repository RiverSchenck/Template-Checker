// Adjust or add to your types.ts file
export enum ValidationCategory {
  par_styles = "Paragraph Style",
  char_styles = "Character Style",
  text_boxes = "Text Box",
  fonts = "Font",
  images = "Image",
  general = "General",
}

export type ValidationType = "errors" | "warnings" | "infos";

/** Optional structured context (e.g. text, overrides, inheritedFrom) when present from the backend. */
export type ContextDetails = {
  text?: string;
  overrides?: Record<string, string>;
  inheritedFrom?: string;
  [key: string]: unknown;
};

/** Frame position on its page, in points from the page's top-left corner. */
export type PageBounds = {
  page_id: string;
  /** IDML element the box belongs to, e.g. TextFrame, Rectangle, Group. */
  kind?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PageLayout = {
  page_id: string;
  name: string;
  index: number;
  spread_id: string;
  width: number;
  height: number;
  /** Base64 JPEG preview embedded by InDesign (usually only the first pages). */
  preview: string | null;
  frames: (PageBounds & { kind: string })[];
};

export type ValidationItem = {
  validationClassifier: string;
  context: string;
  context_details?: ContextDetails | null;
  identifier: string | null;
  page_id: string; // Page Self (was "page")
  page_name: string; // Page Name (was "page_id")
  spread_id: string; // Spread Self
  data_id: string;
  /** Text the issue was found in (style and override issues). */
  text_content?: string[];
  bounds?: PageBounds;
};

export type ValidationEntries = {
  [key in ValidationType]: ValidationItem[];
};

export type IdentifierGroupedData = {
  [identifier: string]: ValidationEntries;
};

export type CategoryDetail = {
  details: IdentifierGroupedData;
  total_count: number;
};

export type TextBoxData = {
  identifier: string;
  content: string;
  page_id: string; // Page Self (was "page")
  page_name: string; // Page Name (was "page_id")
};

export interface ValidationResult {
  template_name: string;
  output_folder: string;
  par_styles: CategoryDetail;
  char_styles: CategoryDetail;
  text_boxes: CategoryDetail;
  fonts: CategoryDetail;
  images: CategoryDetail;
  general: CategoryDetail;
  validation_classifiers: { [key: string]: ClassifierData };
  text_box_data: { [key: string]: TextBoxData };
  spread_to_pages: { [spread_self: string]: string[] };
  pages: { [page_self: string]: string };
  page_layouts?: PageLayout[];
  /** Every template check that ran (missing on results from older backends). */
  checks?: CheckDefinition[];
  /** Plain-language copy for each check that ran or found something, by severity then check key. */
  check_guides?: Partial<Record<ValidationType, Record<string, CheckGuide>>>;
  /** The message for the customer, written by the backend. Null if it couldn't be written; missing on older results. */
  customer_summary?: CustomerSummaryPayload | null;
}

/** What goes wrong in Frontify and how to fix it in InDesign, for one check. */
export type CheckGuide = {
  /** Short plain-language name of the problem. */
  title: string;
  /** What goes wrong in Frontify, in a sentence or two. */
  why: string;
  /** How the template author fixes it in InDesign. */
  fix: string[];
  /**
   * What a problem is tied to, which decides how its places are grouped: fixing one paragraph style fixes every
   * frame that uses it, while a frame problem has to be fixed frame by frame.
   */
  subject: SubjectKind;
};

export type SubjectKind = 'paragraph-style' | 'character-style' | 'font' | 'image' | 'frame' | 'document';

/** One line of the customer summary. The HTML and plain-text copies are rendered from the same lines. */
export type SummaryLine =
  | { kind: 'heading' | 'title' | 'text' | 'step'; text: string }
  | { kind: 'link'; text: string; href: string };

export type CustomerSummaryPayload = {
  summary_version: string;
  counts: { blockers: number; warnings: number; infos: number };
  /** For pasting with formatting (Intercom). */
  html: string;
  /** For pasting where formatting isn't kept; links are written out. */
  text: string;
  sections: {
    /** What review feedback is filed under: an issue's check key, or 'intro' / 'closing'. */
    key: string;
    title: string;
    /** The issue the section describes, e.g. 'errors:FONTS_INCLUDED'. */
    problem_id: string | null;
    lines: SummaryLine[];
  }[];
};

export type CheckDefinition = {
  key: string;
  severity: ValidationType;
  label: string;
  message: string;
  help_article: string | null;
  category: keyof typeof ValidationCategory;
};

export type ClassifierData = {
  label: string;
  message: string;
  help_article: string | null; //optional
};

// export type ValidationClassifier = ValidationError | ValidationWarning | ValidationInfo | ValidationAPI

// type ValidationError = "ERROR" | "FOLDER" | "IDML" | "ZIP" | "MASTERPAGE" | "PARAGRAPH_STYLE" | "FONTS_INCLUDED" | "OTF_TTF_FONT" | "VARIABLE_FONT" | "IMAGE_INCLUDED" | "EMBEDDED_IMAGE" | "IMAGE_TRANSFORMATION" | "TABLE" | "PASTED_GRAPHICS" | "AUTO_SIZE_TEXT_BOX" | "TEXT_COLUMNS" | "LINKED_TEXT_FRAME" | "OBJECT_STYLE" | "GRID_ALIGNMENT" | "KERNING" | "TEXT_WRAP"

// type ValidationWarning = "WARNING" | "HYPHENATION" | "OVERRIDE" | "UNUSED_IMAGE" | "IMAGE_TRANSFORMATION" | "DOCUMENT_BLEED" | "COMPOSER"

// type ValidationInfo = "EMPTY_TEXT_FRAME" | "LARGE_IMAGE"

// type ValidationAPI = "API_SERVER_ERROR"
