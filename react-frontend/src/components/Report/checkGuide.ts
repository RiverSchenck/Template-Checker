import { ValidationType } from '../../types';

/**
 * What a problem is tied to, which decides how its places are grouped:
 * fixing one paragraph style fixes every frame that uses it, while a frame
 * problem has to be fixed frame by frame.
 */
export type SubjectKind = 'paragraph-style' | 'character-style' | 'font' | 'image' | 'frame' | 'document';

export type CheckGuide = {
  /** Short plain-language name of the problem. */
  title: string;
  /** What goes wrong in Frontify, in a sentence or two. */
  why: string;
  /** How the template author fixes it in InDesign. */
  fix: string[];
  subject: SubjectKind;
};

/**
 * Internal debugging notes for every check, keyed by severity then check key.
 * Some keys (e.g. IMAGE_TRANSFORMATION) are an error for flips/skews and a warning for rotation.
 */
const GUIDES: Record<ValidationType, Record<string, CheckGuide>> = {
  errors: {
    MASTERPAGE: {
      title: 'Items on a master page',
      why: 'Frontify only reads items on the document pages, so anything on a master page (called a parent page in newer InDesign versions) is ignored or breaks the template.',
      fix: [
        'In the Pages panel, open the master (parent) page and move its items onto the document pages, or delete them.',
      ],
      subject: 'document',
    },
    PARAGRAPH_STYLE: {
      title: 'Text without a paragraph style',
      why: 'Frontify uses paragraph styles to format text and decide what can be edited. Text set to [Basic Paragraph] or [No Paragraph Style] has nothing to follow.',
      fix: [
        'Select the text and apply a paragraph style in Window > Styles > Paragraph Styles (any style except [Basic Paragraph] or [No Paragraph Style]).',
      ],
      subject: 'frame',
    },
    PARAGRAPH_STYLE_TEXT_BOX: {
      title: 'Text frame has no paragraph style',
      why: 'Frontify uses paragraph styles to format text and decide what can be edited. This frame only uses the default style.',
      fix: [
        'Select the frame and apply a paragraph style in Window > Styles > Paragraph Styles (any style except [Basic Paragraph] or [No Paragraph Style]).',
      ],
      subject: 'frame',
    },
    FONTS_INCLUDED: {
      title: 'Font missing from the package',
      why: 'Frontify needs the font files to render the text, otherwise the template falls back to another font.',
      fix: [
        'Make sure the font is installed or activated on your computer.',
        'Package again with File > Package with "Copy Fonts" checked, and zip the whole folder, including "Document fonts".',
      ],
      subject: 'font',
    },
    OTF_TTF_FONT: {
      title: 'Unsupported font format',
      why: 'Frontify can only use OpenType (.otf) and TrueType (.ttf) fonts. Other formats, such as Type 1, can’t be loaded.',
      fix: [
        'Get an OTF or TTF version from the font vendor and swap it in with Type > Find/Replace Font.',
      ],
      subject: 'font',
    },
    VARIABLE_FONT: {
      title: 'Variable font used',
      why: 'Frontify doesn’t support variable fonts, so text using them won’t render correctly.',
      fix: [
        'Install the static (non-variable) version of the font and swap it in with Type > Find/Replace Font.',
      ],
      subject: 'font',
    },
    IMAGE_INCLUDED: {
      title: 'Linked image missing from the package',
      why: 'The document links to an image that isn’t in the package, so Frontify can’t show it.',
      fix: [
        'Relink any missing images in Window > Links.',
        'Package again with File > Package with "Copy Linked Graphics" checked.',
      ],
      subject: 'image',
    },
    EMBEDDED_IMAGE: {
      title: 'Embedded image',
      why: 'Frontify needs images as separate linked files and can’t read images embedded in the document.',
      fix: [
        'In Window > Links, select the image and choose Unembed Link from the panel menu.',
        'Save it into the Links folder and package again.',
      ],
      subject: 'image',
    },
    IMAGE_TRANSFORMATION: {
      title: 'Image is flipped or skewed',
      why: 'Frontify can’t reproduce flipped or skewed images, so they’ll look different or break when edited.',
      fix: [
        'Select the image and choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).',
        'If you need the flipped look, save a flipped copy of the image file instead.',
      ],
      subject: 'image',
    },
    IMAGE_TRANSFORMATION_IMAGE: {
      title: 'Image is flipped or skewed',
      why: 'Frontify can’t reproduce flipped or skewed images, so they’ll look different or break when edited.',
      fix: [
        'Double-click to select the image inside the frame, then choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).',
        'If you need the flipped look, save a flipped copy of the image file instead.',
      ],
      subject: 'image',
    },
    IMAGE_TRANSFORMATION_CONTAINER: {
      title: 'Image frame is flipped or skewed',
      why: 'Frontify can’t reproduce flipped or skewed frames, so the image will look different or break when edited.',
      fix: [
        'Select the image frame and choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).',
      ],
      subject: 'image',
    },
    PAGE_ITEM_TRANSFORMATION: {
      title: 'Item is flipped or skewed',
      why: 'Frontify can’t reproduce flipped or skewed items, so they’ll look different from the InDesign file.',
      fix: [
        'Select the item and choose Object > Transform > Clear Transformations (or set the shear angle to 0° and remove the flip).',
      ],
      subject: 'frame',
    },
    TABLE: {
      title: 'Table in a text frame',
      why: 'Frontify doesn’t support InDesign tables.',
      fix: [
        'Click into the table and choose Table > Convert Table to Text, or rebuild it with separate text frames.',
      ],
      subject: 'frame',
    },
    PASTED_GRAPHICS: {
      title: 'Pasted graphic',
      why: 'Graphics pasted straight into InDesign aren’t linked files, so Frontify can’t read them.',
      fix: [
        'Save the graphic as a file (for example SVG, PDF or PNG), delete the pasted version and place the file with File > Place.',
      ],
      subject: 'document',
    },
    AUTO_SIZE_TEXT_BOX: {
      title: 'Auto-size text frame set up incorrectly',
      why: 'Frontify grows auto-size frames as people type, and can’t match how these settings resize the frame.',
      fix: [
        'For each frame, open Object > Text Frame Options > Auto-Size and make the change noted next to it.',
      ],
      subject: 'frame',
    },
    TEXT_COLUMNS: {
      title: 'Text frame has columns',
      why: 'Frontify doesn’t support multiple columns inside one text frame.',
      fix: [
        'Set Columns to 1 in Object > Text Frame Options. Use separate text frames if you need columns.',
      ],
      subject: 'frame',
    },
    LINKED_TEXT_FRAME: {
      title: 'Threaded (linked) text frames',
      why: 'Frontify doesn’t support text flowing from one frame into another.',
      fix: [
        'Turn on View > Extras > Show Text Threads, then double-click a frame’s out port to break the thread so each frame holds its own text.',
      ],
      subject: 'frame',
    },
    OBJECT_STYLE_TEXT: {
      title: 'Object style on a text frame',
      why: 'Frontify doesn’t apply object styles, so the frame will look different.',
      fix: [
        'Select the frame and apply [None] or [Basic Text Frame] in Window > Styles > Object Styles, then re-apply any formatting you need directly.',
      ],
      subject: 'frame',
    },
    OBJECT_STYLE_IMAGE: {
      title: 'Object style on an image frame',
      why: 'Frontify doesn’t apply object styles, so the frame will look different.',
      fix: [
        'Select the frame and apply [None] or [Basic Graphics Frame] in Window > Styles > Object Styles, then re-apply any formatting you need directly.',
      ],
      subject: 'image',
    },
    GRID_ALIGNMENT: {
      title: 'Text aligned to the baseline grid',
      why: 'Frontify doesn’t use InDesign’s baseline grid, so line spacing will change.',
      fix: [
        'In the paragraph style, go to Indents and Spacing and set Align to Grid to None.',
      ],
      subject: 'paragraph-style',
    },
    KERNING: {
      title: 'Kerning isn’t set to Metrics',
      why: 'Frontify spaces letters using the font’s own kerning (Metrics). Other settings make text shift when it’s edited.',
      fix: [
        'In the paragraph style, go to Basic Character Formats and set Kerning to Metrics.',
      ],
      subject: 'paragraph-style',
    },
    KERNING_CHAR: {
      title: 'Kerning isn’t set to Metrics',
      why: 'Frontify spaces letters using the font’s own kerning (Metrics). Other settings make text shift when it’s edited.',
      fix: [
        'In the character style, go to Basic Character Formats and set Kerning to Metrics.',
      ],
      subject: 'character-style',
    },
    TEXT_WRAP: {
      title: 'Text wrap applied',
      why: 'Frontify doesn’t support text wrap, so text won’t flow around objects.',
      fix: [
        'Select the frame and choose No Text Wrap in Window > Text Wrap.',
      ],
      subject: 'frame',
    },
    FILL_TINT: {
      title: 'Text color tint isn’t 100%',
      why: 'Frontify shows text colors at full strength, so tinted text will look darker. This check is in beta and can be wrong.',
      fix: [
        'In the paragraph style, go to Character Color and set Tint to 100%.',
      ],
      subject: 'paragraph-style',
    },
  },
  warnings: {
    HYPHENATION: {
      title: 'Hyphenation is on',
      why: 'Browsers hyphenate differently from InDesign, so lines may break in different places.',
      fix: [
        'In the paragraph style, go to Hyphenation and uncheck Hyphenate.',
      ],
      subject: 'paragraph-style',
    },
    OVERRIDE: {
      title: 'Text formatted outside its paragraph style',
      why: 'Formatting added by hand on top of a paragraph style (shown as a + next to the style name) may be lost or look different in Frontify.',
      fix: [
        'Click into the text. A + after the style name in Window > Styles > Paragraph Styles means it has extra formatting.',
        'To remove it, select the text and click Clear Overrides at the bottom of the Paragraph Styles panel.',
        'To keep the look, update the style to match instead (right-click the style > Redefine Style), or use a character style for single words.',
      ],
      subject: 'frame',
    },
    UNUSED_IMAGE: {
      title: 'Unused images in the package',
      why: 'These files aren’t used in the document and only make the package bigger.',
      fix: ['Delete the unused files from the Links folder before zipping the package.'],
      subject: 'image',
    },
    IMAGE_TRANSFORMATION: {
      title: 'Image is rotated',
      why: 'Rotation works, but the image may look slightly different in Frontify than in InDesign.',
      fix: ['Check the result in Frontify. If it looks off, save a rotated copy of the image and place it unrotated.'],
      subject: 'image',
    },
    IMAGE_TRANSFORMATION_IMAGE: {
      title: 'Image is rotated',
      why: 'Rotation works, but the image may look slightly different in Frontify than in InDesign.',
      fix: ['Check the result in Frontify. If it looks off, save a rotated copy of the image and place it unrotated.'],
      subject: 'image',
    },
    IMAGE_TRANSFORMATION_CONTAINER: {
      title: 'Image frame is rotated',
      why: 'Rotation works, but the frame may look slightly different in Frontify than in InDesign.',
      fix: ['Check the result in Frontify. If it looks off, remove the rotation from the frame.'],
      subject: 'image',
    },
    PAGE_ITEM_TRANSFORMATION: {
      title: 'Item is rotated',
      why: 'Rotation works, but the item may look slightly different in Frontify than in InDesign.',
      fix: ['Check the result in Frontify. If it looks off, remove the rotation.'],
      subject: 'frame',
    },
    DOCUMENT_BLEED: {
      title: 'Document has bleed',
      why: 'Bleed is added to every export, which is right for print templates but usually unwanted for digital ones.',
      fix: [
        'For a digital template, set bleed to 0 in File > Document Setup > Bleed and Slug. For print templates, bleed is fine.',
      ],
      subject: 'document',
    },
    COMPOSER: {
      title: 'Paragraph Composer used',
      why: 'The Adobe Paragraph Composer breaks lines differently from browsers, so text may reflow in Frontify.',
      fix: [
        'In the paragraph style, go to Justification and set Composer to Adobe Single-line Composer.',
      ],
      subject: 'paragraph-style',
    },
  },
  infos: {
    EMPTY_TEXT_FRAME: {
      title: 'Empty text frame',
      why: 'Empty frames are allowed, but are often left over by accident.',
      fix: ['Delete the frame if it isn’t needed.'],
      subject: 'frame',
    },
    LARGE_IMAGE: {
      title: 'Large image',
      why: 'Very large images slow down editing and exporting in Frontify.',
      fix: ['Reduce the image’s pixel size or file size if it doesn’t need to be this large.'],
      subject: 'image',
    },
  },
};

/** Fallback for package and parsing errors (and checks added before their copy is written). */
export function getCheckGuide(severity: ValidationType, key: string, label?: string, message?: string): CheckGuide {
  return (
    GUIDES[severity][key] ?? {
      title: label || message || key,
      why: message || '',
      fix: [],
      subject: 'document',
    }
  );
}
