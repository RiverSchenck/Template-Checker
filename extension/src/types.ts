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

export type ValidationItem = {
  validationClassifier: string;
  context: string;
  identifier: string | null;
  page_id: string; // Page Self (was "page")
  page_name: string; // Page Name (was "page_id")
  spread_id: string; // Spread Self
  data_id: string;
  text_content?: string[]; // Array of text strings where the issue occurs (for PAR_STYLE, CHAR_STYLE, and OVERRIDE)
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
}

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
