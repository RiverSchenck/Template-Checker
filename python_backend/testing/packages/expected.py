"""Expected issues per test package (testing/test_packages.py says how they're compared).

Items read 'subject @ page (key fact)': the style, font or file name, a frame's id, or a page item's kind and id;
the page's name; for flips and skews the kind, for auto-size its type.
"""

# The issues of the checks each package exists to test.
CHECKS = {
    '1 bleed.zip': {
        'DOCUMENT_BLEED': ['document'],
    },
    '1 column.zip': {
        'TEXT_COLUMNS': ['u10e @ 1'],
    },
    '1 grid alignment.zip': {
        'GRID_ALIGNMENT': ['HEader 2 - Our Future @ 1'],
    },
    # Paragraph style H4 uses Optical kerning (Styles.xml: KerningMethod="$ID/Optical"); one error per
    # story that uses H4 (3 stories). Character-style kerning has no package: see testing/fixtures/test_kerning_rule.py.
    '1 large image.zip': {
        'IMAGE_INCLUDED': [],
        'KERNING': ['H4 @ 1', 'H4 @ 1', 'H4 @ 1'],
        'KERNING_CHAR': [],
        'LARGE_IMAGE': ['iStock-1226023798.jpg @ 1'],
        'UNUSED_IMAGE': [],
        'VARIABLE_FONT': [],
    },
    '1 linked frame.zip': {
        'LINKED_TEXT_FRAME': ['u107 @ 1', 'uf0 @ 1'],
    },
    # .DS_STORE ISSUES #ADDS %20 on spaces in file names?
    '1 missing 2 unused image.zip': {
        'EMBEDDED_IMAGE': [],
        'IMAGE_INCLUDED': ['Simple_CMYK_Gradients_Fuschia copy.ai @ 1'],
        'LARGE_IMAGE': [],
        'UNUSED_IMAGE': ['Adobe Creative Cloud.png', 'email-footer-cfc-650x150.png'],
    },
    '1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT Folder.zip': {
        'OBJECT_STYLE': ['SEMCO_WHITE_LOGO.eps @ 1', 'u319f @ 1', 'u32c5 @ 1'],
    },
    '1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT.zip': {
        'COMPOSER': ['Body @ 1', 'Body Bullet @ 1', 'H1 @ 1', 'H2 @ 1', 'H3 @ 1', 'H4 @ 1', 'NormalParagraphStyle @ 1'],
        'GRID_ALIGNMENT': [],
        'OBJECT_STYLE': [],
        'OTF_TTF_FONT': ['Times.ttc'],
        'TRANSFORMATION': [],
    },
    '1font missing.zip': {
        'FONTS_INCLUDED': ['FuturaEF'],
    },
    '2 column error.zip': {
        'TEXT_COLUMNS': ['u112 @ 1', 'uf0 @ 1'],
    },
    # BlairITC TT
    # Montserrat is an Adobe Font (TypekitID) that isn't packaged: reported by adobe_font_check instead.
    '2 font missing.zip': {
        'FONTS_INCLUDED': ['BlairITC TT'],
    },
    '2 grid alignment.zip': {
        'GRID_ALIGNMENT': ['HEader 2 - Our Future @ 1', 'Header 1 - Your Drive @ 1'],
    },
    '2 large images 1 small with same name Folder.zip': {
        'LARGE_IMAGE': ['PHONE_SHAPE.psd @ 1', 'Screen2_women_cmyk_300dpi.jpg @ 1'],
    },
    '2 large images.zip': {
        'LARGE_IMAGE': ['PHONE_SHAPE.psd @ 1', 'Screen2.psd @ 1'],
    },
    '2 linked.zip': {
        'LINKED_TEXT_FRAME': ['u12e7 @ 2', 'u1300 @ 2'],
    },
    '2 missing links.zip': {
        'IMAGE_INCLUDED': ['monobrand-main-logo-black.eps @ 1', 'person-holding-wooden-toothbrush-3737592.jpg @ 1'],
        'UNUSED_IMAGE': [],
    },
    '2 obj style Folder.zip': {
        'OBJECT_STYLE': ['logo_FÃ¶rderturm_original.png @ 1', 'u102 @ 1'],
    },
    '2 tables (table in table).zip': {
        'TABLE': ['u17a @ 1', 'u17a @ 1'],
    },
    '2 tables.zip': {
        'TABLE': ['u1dad @ 2', 'u1dad @ 2'],
    },
    # Used 2 variable Fonts, but we are checking Font Family so only 1 error expected
    '2 var fonts.zip': {
        'VARIABLE_FONT': ['Roboto Mono'],
    },
    # VERY LARGE SCRIPT FAILS
    '3 embedded Folder.zip': {
        'EMBEDDED_IMAGE': [
            'Screen2_women_cmyk_300dpi.jpg @ 1',
            'X.ai @ 1',
            'phone_journey-start-switzerland_campaign_de.svg @ 1',
        ],
    },
    '3 embedded images.zip': {
        'EMBEDDED_IMAGE': [
            'Frontify-Brand_Infrastructure-en.pdf @ 1',
            'logo_FÃ¶rderturm_original.png @ 1',
            'logo_FÃ¶rderturm_original.png @ 1',
        ],
    },
    '3 err 2 warn transformation.zip': {
        'TRANSFORMATION': [
            '230209_FRO2301_NYC_15.jpg @ 2 (flip)',
            '230209_FRO2301_NYC_15.jpg @ 2 (flip)',
            'Frontify_Linkedin-Cover-Employee_1584x396.png @ 2 (skew)',
        ],
    },
    '3 grid alignment.zip': {
        'GRID_ALIGNMENT': ['H2 @ 1', 'H3 @ 1', 'H4 @ 1'],
    },
    '3 linked text boxes.zip': {
        'LINKED_TEXT_FRAME': ['u107 @ 1', 'u11e @ 1', 'uf0 @ 1'],
    },
    # One object syle not on textframe/image
    '3 obj styles.zip': {
        'OBJECT_STYLE': ['pexels-mizuno-k-12903254.png @ 1', 'shutterstock_1151850470.png @ 2'],
    },
    '3 variable fonts with multiple weights Folder.zip': {
        'VARIABLE_FONT': ['Edu TAS Beginner', 'Playpen Sans', 'Roboto Mono'],
    },
    # Auto size (HeightAndWidth not from a corner) is no longer an error: Frontify supports every reference point.
    '4 auto size error.zip': {
        'AUTO_SIZE_TEXT_BOX': [
            'u10d @ 1 (WidthOnly)',
            'u124 @ 1 (HeightAndWidth)',
            'uf6 @ 1 (HeightAndWidthProportionally)',
        ],
    },
    '4 column.zip': {
        'TEXT_COLUMNS': ['u10e @ 1', 'u127 @ 1', 'u159 @ 1', 'uf0 @ 1'],
    },
    '4 embedded.zip': {
        'EMBEDDED_IMAGE': [
            'Wave_Pattern_CMYK_Gray.ai @ 1',
            'Wave_Pattern_CMYK_Gray.ai @ 2',
            'pexels-mizuno-k-12903254.png @ 1',
            'shutterstock_1151850470.png @ 2',
        ],
    },
    '4 err 2 warn transformations.zip': {
        'TRANSFORMATION': [
            '230209_FRO2301_NYC_15.jpg @ 2 (flip)',
            '230209_FRO2301_NYC_15.jpg @ 2 (flip)',
            'Frontify_Linkedin-Cover-Employee_1584x396.png @ 2 (skew)',
        ],
    },
    '4 obj style.zip': {
        'OBJECT_STYLE': ['THC zuid PNG.png @ 1', 'u43fb @ 1', 'u442a @ 1', 'u4458 @ 1'],
    },
    '4 var fonts Folder.zip': {
        'VARIABLE_FONT': ['Aleo', 'Alexandria', 'Cabin', 'Varta'],
    },
    '4_no_par_style.zip': {
        'EMPTY_TEXT_FRAME': [],
        'PARAGRAPH_STYLE': ['u10e @ 1', 'u125 @ 1', 'u13c @ 1', 'uf0 @ 1'],
    },
    '5 linked frames.zip': {
        'LINKED_TEXT_FRAME': ['u107 @ 1', 'u11e @ 1', 'u15f @ 1', 'u176 @ 1', 'uf0 @ 1'],
    },
    '6 overrides.zip': {
        'OVERRIDE': ['u112 @ 1', 'u112 @ 1', 'u112 @ 1', 'u112 @ 1', 'u112 @ 1', 'u112 @ 1'],
    },
    '6 tables Folder.zip': {
        'TABLE': ['u104 @ 1', 'u146 @ 1', 'u1ce @ 1', 'u1ef @ 1', 'u210 @ 1', 'u235'],
    },
    'A4 Template v1.zip': {
        'DOCUMENT_BLEED': ['document'],
        'PASTED_GRAPHICS': ['document @ 1'],
    },
    'All_par_style.zip': {
        'EMPTY_TEXT_FRAME': [],
        'PARAGRAPH_STYLE': [],
        'TABLE': [],
    },
    # Auto size (HeightOnly from center) is no longer an error: Frontify supports every reference point.
    'Auto Size Middle.zip': {
        'AUTO_SIZE_TEXT_BOX': ['u151 @ 1 (HeightAndWidth)', 'u19e @ 1 (WidthOnly)'],
    },
    # Auto size (WidthOnly from center) is no longer an error: Frontify supports every reference point.
    'Auto Size Text Boxes.zip': {
        'AUTO_SIZE_TEXT_BOX': [],
    },
    'Auto Size Text box- Height Only top Down.zip': {
        'AUTO_SIZE_TEXT_BOX': [],
        'LINKED_TEXT_FRAME': [],
    },
    'Blank.zip': {
        'AUTO_SIZE_TEXT_BOX': [],
        'COMPOSER': [],
        'DOCUMENT_BLEED': [],
        'EMBEDDED_IMAGE': [],
        'EMPTY_TEXT_FRAME': [],
        'FONTS_INCLUDED': [],
        'GRID_ALIGNMENT': [],
        'HYPHENATION': [],
        'IMAGE_INCLUDED': [],
        'KERNING': [],
        'KERNING_CHAR': [],
        'LARGE_IMAGE': [],
        'LINKED_TEXT_FRAME': [],
        'MASTERPAGE': [],
        'OBJECT_STYLE': [],
        'OTF_TTF_FONT': [],
        'OVERRIDE': [],
        'PARAGRAPH_STYLE': [],
        'PASTED_GRAPHICS': [],
        'TABLE': [],
        'TEXT_COLUMNS': [],
        'UNUSED_IMAGE': [],
        'VARIABLE_FONT': [],
    },
    'Container on masterpage.zip': {
        'MASTERPAGE': ['document'],
    },
    'Embedded Image.zip': {
        'MASTERPAGE': [],
    },
    'Employer Brand_Pullup Banner_Design 1.zip': {
        'MASTERPAGE': [],
    },
    'Flyer_TextHeavy4 Folder.zip': {
        'OVERRIDE': [],
    },
    'H&W auto-size corners Folder.zip': {
        'AUTO_SIZE_TEXT_BOX': [
            'u19c @ 1 (HeightAndWidth)',
            'u1b7 @ 1 (HeightAndWidth)',
            'u1d1 @ 1 (HeightAndWidth)',
            'u1e8 @ 1 (HeightAndWidth)',
        ],
    },
    'Harbour Club Fixed Folder.zip': {
        'COMPOSER': [],
    },
    'Hyph style inheritance.zip': {
        'DOCUMENT_BLEED': ['document'],
        'HYPHENATION': ['body copy:body text @ 1'],
    },
    'Image Transformation Folder 2.zip': {
        'IMAGE_INCLUDED': ['logo_KawaksakiMotorsCorp.USA_original.png @ 2'],
        'UNUSED_IMAGE': [],
    },
    # Flip (frame uf3)
    # Horizontal flip (frame uea, -1 0 0 1; was reported as a 180 degree rotation)
    'Image Transformation Folder.zip': {
        'AUTO_SIZE_TEXT_BOX': [],
        'COMPOSER': [],
        'DOCUMENT_BLEED': [],
        'EMBEDDED_IMAGE': [],
        'GRID_ALIGNMENT': [],
        'HYPHENATION': [],
        'IMAGE_INCLUDED': [],
        'KERNING': [],
        'KERNING_CHAR': [],
        'LARGE_IMAGE': [],
        'LINKED_TEXT_FRAME': [],
        'OBJECT_STYLE': [],
        'OVERRIDE': [],
        'PASTED_GRAPHICS': [],
        'TEXT_COLUMNS': [],
        'TRANSFORMATION': [
            'logo_KawaksakiMotorsCorp.USA_original.png @ 1 (flip)',
            'logo_KawaksakiMotorsCorp.USA_original.png @ 2 (flip)',
        ],
        'UNUSED_IMAGE': [],
        'VARIABLE_FONT': [],
    },
    'Inherited Hyphenation.zip': {
        'HYPHENATION': ['HEader 2 - Our Future @ 1', 'Header 1 - Your Drive @ 1', 'Test style @ 2'],
    },
    'Large image used.zip': {
        'LARGE_IMAGE': ['large_image.tiff @ 1'],
    },
    'Line on masterpage.zip': {
        'MASTERPAGE': ['document'],
    },
    'Master Page.zip': {
        'MASTERPAGE': ['document'],
    },
    'MasterPage with image.zip': {
        'MASTERPAGE': ['document'],
    },
    'Missing two fonts.zip': {
        'MASTERPAGE': [],
    },
    'Mixed paragraph styles.zip': {
        'OTF_TTF_FONT': [],
    },
    'NewEmployeeFolder1.zip': {
        'DOCUMENT_BLEED': [],
        'PASTED_GRAPHICS': ['document @ 1'],
    },
    'No Document Fonts folder.zip': {
        'EMPTY_TEXT_FRAME': [],
        'FONTS_INCLUDED': ['FuturaEF', 'FuturaEF DemiBold', 'Minion Pro'],
        'PARAGRAPH_STYLE': ['u1332 @ 2', 'u1d56 @ 1', 'u1d6d @ 2'],
    },
    'No Hyph.zip': {
        'HYPHENATION': [],
    },
    'Not Using paragraph style.zip': {
        'DOCUMENT_BLEED': ['document'],
        'FONTS_INCLUDED': [],
        'PASTED_GRAPHICS': ['document @ 1', 'document @ 2'],
        'TRANSFORMATION': [],
    },
    'OTF font.zip': {
        'HYPHENATION': [],
    },
    'SEMCO1 Fixed.zip': {
        'COMPOSER': [],
    },
    'TTC Font Template.zip': {
        'OTF_TTF_FONT': ['Futura.ttc'],
    },
    'Table.zip': {
        'TABLE': ['u12a @ 1'],
    },
    'Test-Basic-File-Template Folder.zip': {
        'FONTS_INCLUDED': ['Public Sans'],
        'HYPHENATION': [],
    },
    'Test-Basic-File-Template w HYP [64cc1b].zip': {
        'HYPHENATION': ['Paragraph Style 1 @ 1'],
    },
    'Test-Basic-File-Template w HYP [d9d3d6].zip': {
        'OTF_TTF_FONT': [],
        'TRANSFORMATION': [],
    },
    'Test-Basic-File_with_styles.zip': {
        'EMPTY_TEXT_FRAME': [],
        'PARAGRAPH_STYLE': [],
        'TABLE': [],
    },
    'The Harbour club [01cf25].zip': {
        'FONTS_INCLUDED': [],
        'OTF_TTF_FONT': [],
        'OVERRIDE': [],
        'TEXT_COLUMNS': [],
    },
    'The Harbour club [713646].zip': {
        'DOCUMENT_BLEED': [],
        'EMPTY_TEXT_FRAME': [],
        'HYPHENATION': [
            'Arrangement @ 2',
            'Arrangement @ 2',
            'Arrangement @ 2',
            'Arrangementen @ 2',
            'body arrangement goud @ 2',
            'body arrangement goud @ 2',
            'body arrangement goud @ 2',
            'body arrangement wit @ 2',
            'body arrangement wit @ 2',
            'body arrangement wit @ 2',
            'kop goud @ 1',
            'kop goud @ 1',
            'kop goud @ 1',
            'kop wit @ 1',
            'kop wit @ 1',
            'prijs @ 2',
            'prijs @ 2',
            'prijs @ 2',
        ],
        'PARAGRAPH_STYLE': [],
        'TABLE': [],
    },
    'The Harbour club missing 1 style.zip': {
        'EMPTY_TEXT_FRAME': [],
        'PARAGRAPH_STYLE': ['u417d @ 2'],
    },
    'The Harbour club_amsterdam-zuid_ENG Folder.zip': {
        'GRID_ALIGNMENT': ['Body Harbour Club @ 1', 'intro Harbour Club @ 1', 'kop goud @ 1', 'kop wit @ 1'],
    },
    'The Harbour club_amsterdam-zuid_ENG map.zip': {
        'COMPOSER': [
            'Arrangement @ 2',
            'Arrangementen @ 2',
            'Body Harbour Club @ 1',
            'body arrangement goud @ 2',
            'body arrangement wit @ 2',
            'intro Harbour Club @ 1',
            'kop goud @ 1',
            'kop wit @ 1',
            'prijs @ 2',
        ],
        'GRID_ALIGNMENT': [],
        'OBJECT_STYLE': [],
        'TRANSFORMATION': [],
    },
    'Tietoevry_General News_Template Folder2.zip': {
        'PASTED_GRAPHICS': ['document @ 1'],
    },
    'VOITH SINGLE.zip': {
        'EMBEDDED_IMAGE': [],
        'IMAGE_INCLUDED': [],
        'KERNING': [],
        'KERNING_CHAR': [],
        'LARGE_IMAGE': [],
        'PASTED_GRAPHICS': [],
        'TRANSFORMATION': [],
        'UNUSED_IMAGE': [],
        'VARIABLE_FONT': [],
    },
    'VOITH_7 overrides [130d0e].zip': {
        'FONTS_INCLUDED': [],
        'OTF_TTF_FONT': [],
        'TEXT_COLUMNS': [],
    },
    'VOITH_7 overrides [743af7].zip': {
        'OVERRIDE': ['u116 @ 1', 'u116 @ 1', 'u12c @ 1', 'u142 @ 1', 'u142 @ 1', 'u163 @ 1', 'u179 @ 1'],
    },
    'Variable Font Example.zip': {
        'EMPTY_TEXT_FRAME': [],
        'PARAGRAPH_STYLE': ['u112 @ 1', 'uf5 @ 1', 'ufa @ 1'],
        'VARIABLE_FONT': ['Public Sans'],
    },
    'Weird Font Family convention.zip': {
        'FONTS_INCLUDED': [],
    },
    'columns Folder.zip': {
        'TEXT_COLUMNS': ['u10f @ 1', 'u128 @ 1', 'uf0 @ 1'],
    },
    'composer test.zip': {
        'COMPOSER': ['Paragraph Style 1 @ 1'],
    },
    'composers.zip': {
        'COMPOSER': ['Paragraph Style 1 @ 1', 'Paragraph Style 4 @ 1'],
    },
    'has overrides.zip': {
        'OVERRIDE': ['u1332 @ 2', 'u1d56 @ 1', 'u453 @ 1'],
    },
    'lots of auto size Folder.zip': {
        'AUTO_SIZE_TEXT_BOX': [],
        'LINKED_TEXT_FRAME': [],
    },
    'qr code and 1 missing image Folder.zip': {
        'EMBEDDED_IMAGE': ['QR Code15403-811472920 @ 1'],
        'IMAGE_INCLUDED': ['iStock-1226023798.jpg @ 1'],
        'PASTED_GRAPHICS': [],
        'UNUSED_IMAGE': [],
    },
    'with overrides.zip': {
        'OVERRIDE': [
            'u3a81 @ 1',
            'u3a98 @ 1',
            'u414f @ 2',
            'u4166 @ 2',
            'u42c2 @ 2',
            'u4363 @ 2',
            'u437a @ 2',
            'u4413 @ 1',
            'u442a @ 1',
        ],
    },
}

# How many issues of each check a whole run finds.
ALL_ISSUES = {
    'All_err_and_warn.zip': {
        'AUTO_SIZE_TEXT_BOX': 1,
        'COMPOSER': 2,
        'DOCUMENT_BLEED': 1,
        'EMBEDDED_IMAGE': 1,
        'EMPTY_TEXT_FRAME': 1,
        'FONTS_INCLUDED': 1,
        'GRID_ALIGNMENT': 1,
        'HYPHENATION': 1,
        'IMAGE_INCLUDED': 1,
        'LARGE_IMAGE': 1,
        'LINKED_TEXT_FRAME': 2,
        'MASTERPAGE': 1,
        'OBJECT_STYLE': 1,
        'OTF_TTF_FONT': 1,
        'OVERRIDE': 1,
        'PARAGRAPH_STYLE': 1,
        'PASTED_GRAPHICS': 1,
        'TABLE': 1,
        'TEXT_COLUMNS': 1,
        'TRANSFORMATION': 1,
        'UNUSED_IMAGE': 1,
        'VARIABLE_FONT': 1,
    },
    'Another Test.zip': {
        'COMPOSER': 2,
        'DOCUMENT_BLEED': 1,
        'EMBEDDED_IMAGE': 1,
        'GRID_ALIGNMENT': 1,
        'HYPHENATION': 1,
        'LINKED_TEXT_FRAME': 2,
        'MASTERPAGE': 1,
        'OVERRIDE': 1,
        'PARAGRAPH_STYLE': 1,
    },
    'Blank.zip': {},
    # Playfair Display: the text uses its Regular style, an Adobe Font (TypekitID) that isn't packaged.
    'Brochure_Bad.zip': {
        'ADOBE_FONT': 1,
        'COMPOSER': 1,
        'DOCUMENT_BLEED': 1,
        'FONTS_INCLUDED': 1,
        'OVERRIDE': 12,
        'PARAGRAPH_STYLE': 10,
        'TEXT_COLUMNS': 2,
        'VARIABLE_FONT': 1,
    },
    'Brochure_Good.zip': {},
    'Fact-Sheet-Images_Bad.zip': {
        'COMPOSER': 3,
        'FONTS_INCLUDED': 1,
        'HYPHENATION': 16,
        'OVERRIDE': 9,
        'PARAGRAPH_STYLE': 7,
    },
    # Text uses Playfair Display Black (paragraph style Title), an Adobe Font that isn't packaged; and a
    # variable Montserrat is used through the character styles Title style / Text style.
    'Fact-Sheet-Images_Good.zip': {'ADOBE_FONT': 1, 'VARIABLE_FONT': 1},
    'Flyer-Sales_Bad.zip': {
        'COMPOSER': 1,
        'DOCUMENT_BLEED': 1,
        'FONTS_INCLUDED': 1,
        'OVERRIDE': 3,
        'PARAGRAPH_STYLE': 3,
    },
    # Text uses Playfair Display Regular (Sub Header); only PlayfairDisplay-Black.ttf is packaged.
    'Flyer-Sales_Good.zip': {'FONTS_INCLUDED': 1},
    # Playfair Display: the text uses its Regular style, an Adobe Font (TypekitID) that isn't packaged.
    # Skew (frame u188)
    # Horizontal flip (frame u17f, -1 0 0 1)
    # Auto size (WidthOnly from center) is no longer an error: Frontify supports every reference point.
    'Full coverage errors Folder.zip': {
        'ADOBE_FONT': 1,
        'COMPOSER': 1,
        'DOCUMENT_BLEED': 1,
        'EMBEDDED_IMAGE': 1,
        'EMPTY_TEXT_FRAME': 1,
        'FONTS_INCLUDED': 1,
        'GRID_ALIGNMENT': 2,
        'HYPHENATION': 1,
        'IMAGE_INCLUDED': 1,
        'LARGE_IMAGE': 1,
        'LINKED_TEXT_FRAME': 2,
        'MASTERPAGE': 1,
        'OBJECT_STYLE': 1,
        'OTF_TTF_FONT': 1,
        'OVERRIDE': 1,
        'PARAGRAPH_STYLE': 3,
        'PASTED_GRAPHICS': 1,
        'TABLE': 1,
        'TEXT_COLUMNS': 1,
        'TRANSFORMATION': 2,
        'UNUSED_IMAGE': 1,
        'VARIABLE_FONT': 1,
    },
    'Lookbook_Bad.zip': {'COMPOSER': 1, 'DOCUMENT_BLEED': 1, 'FONTS_INCLUDED': 1, 'OVERRIDE': 13, 'PARAGRAPH_STYLE': 9},
    # Text uses Playfair Display Black (Header) and Regular (Footer), Adobe Fonts that aren't packaged.
    'Lookbook_Good.zip': {'ADOBE_FONT': 1},
    # Playfair Display: the text uses its Regular style, an Adobe Font (TypekitID) that isn't packaged.
    'Packaging_Bad Folder.zip': {
        'ADOBE_FONT': 1,
        'COMPOSER': 1,
        'EMBEDDED_IMAGE': 1,
        'EMPTY_TEXT_FRAME': 1,
        'GRID_ALIGNMENT': 1,
        'LINKED_TEXT_FRAME': 2,
        'MASTERPAGE': 1,
        'OTF_TTF_FONT': 1,
        'OVERRIDE': 1,
        'PARAGRAPH_STYLE': 1,
        'PASTED_GRAPHICS': 1,
        'VARIABLE_FONT': 1,
    },
    # Text uses Playfair Display Regular (Paragraph Style 1); only the Bold file is packaged.
    'Packaging_Good.zip': {'FONTS_INCLUDED': 1},
    # Auto size (HeightOnly from center) is no longer an error: Frontify supports every reference point.
    'RollUp_Bad.zip': {
        'COMPOSER': 1,
        'DOCUMENT_BLEED': 1,
        'EMBEDDED_IMAGE': 1,
        'LARGE_IMAGE': 1,
        'LINKED_TEXT_FRAME': 2,
        'OTF_TTF_FONT': 1,
        'PARAGRAPH_STYLE': 2,
        'PASTED_GRAPHICS': 1,
        'TEXT_COLUMNS': 1,
        'TRANSFORMATION': 1,
        'UNUSED_IMAGE': 1,
    },
    'RollUp_Fixed.zip': {},
    'Sammelform-Price-Tag_Bad.zip': {'COMPOSER': 1, 'FONTS_INCLUDED': 1, 'OVERRIDE': 63, 'PARAGRAPH_STYLE': 63},
    'Sammelform-Price-Tag_Good.zip': {},
    'Shopping-Bag_Bad.zip': {
        'AUTO_SIZE_TEXT_BOX': 1,
        'COMPOSER': 2,
        'EMPTY_TEXT_FRAME': 1,
        'FONTS_INCLUDED': 1,
        'GRID_ALIGNMENT': 1,
        'HYPHENATION': 1,
        'LARGE_IMAGE': 1,
        'OBJECT_STYLE': 1,
        'TABLE': 1,
        'UNUSED_IMAGE': 1,
        'VARIABLE_FONT': 1,
    },
    'Shopping-Bag_Good.zip': {},
    'VOITH_Bad Folder.zip': {
        'COMPOSER': 1,
        'EMBEDDED_IMAGE': 1,
        'EMPTY_TEXT_FRAME': 1,
        'FONTS_INCLUDED': 1,
        'GRID_ALIGNMENT': 1,
        'HYPHENATION': 16,
        'MASTERPAGE': 1,
        'OBJECT_STYLE': 1,
        'OVERRIDE': 2,
        'PARAGRAPH_STYLE': 1,
        'TABLE': 1,
        'TEXT_COLUMNS': 1,
        'TRANSFORMATION': 1,
        'VARIABLE_FONT': 1,
    },
    'VOITH_Good.zip': {},
}
