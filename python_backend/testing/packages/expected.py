"""Expected issues per test package (testing/test_packages.py says how they're compared).

Items read 'subject @ page (key fact)': the style, font or file name, a frame's id, or a page item's kind and id;
the page's name; for flips and skews the kind, for auto-size its type.
"""

# The issues of the checks each package exists to test.
CHECKS = {
    # Auto size (HeightAndWidth not from a corner) is no longer an error: Frontify supports every reference point.
    'unit_tests/auto_size_textbox_check/fail_data/4 auto size error.zip': {
        'AUTO_SIZE_TEXT_BOX': [
            'u10d @ 1 (WidthOnly)',
            'u124 @ 1 (HeightAndWidth)',
            'uf6 @ 1 (HeightAndWidthProportionally)',
        ],
    },
    # Auto size (HeightOnly from center) is no longer an error: Frontify supports every reference point.
    'unit_tests/auto_size_textbox_check/fail_data/Auto Size Middle.zip': {
        'AUTO_SIZE_TEXT_BOX': ['u151 @ 1 (HeightAndWidth)', 'u19e @ 1 (WidthOnly)'],
    },
    # Auto size (WidthOnly from center) is no longer an error: Frontify supports every reference point.
    'unit_tests/auto_size_textbox_check/fail_data/Auto Size Text Boxes.zip': {
        'AUTO_SIZE_TEXT_BOX': [],
    },
    'unit_tests/auto_size_textbox_check/fail_data/H&W auto-size corners Folder.zip': {
        'AUTO_SIZE_TEXT_BOX': [
            'u19c @ 1 (HeightAndWidth)',
            'u1b7 @ 1 (HeightAndWidth)',
            'u1d1 @ 1 (HeightAndWidth)',
            'u1e8 @ 1 (HeightAndWidth)',
        ],
    },
    'unit_tests/auto_size_textbox_check/pass_data/Auto Size Text box- Height Only top Down.zip': {
        'AUTO_SIZE_TEXT_BOX': [],
    },
    'unit_tests/auto_size_textbox_check/pass_data/Blank.zip': {
        'AUTO_SIZE_TEXT_BOX': [],
    },
    'unit_tests/auto_size_textbox_check/pass_data/Image Transformation Folder.zip': {
        'AUTO_SIZE_TEXT_BOX': [],
    },
    'unit_tests/auto_size_textbox_check/pass_data/lots of auto size Folder.zip': {
        'AUTO_SIZE_TEXT_BOX': [],
    },
    'unit_tests/composer_check/fail_data/1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT.zip': {
        'COMPOSER': ['Body @ 1', 'Body Bullet @ 1', 'H1 @ 1', 'H2 @ 1', 'H3 @ 1', 'H4 @ 1', 'NormalParagraphStyle @ 1'],
    },
    'unit_tests/composer_check/fail_data/The Harbour club_amsterdam-zuid_ENG map.zip': {
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
    },
    'unit_tests/composer_check/fail_data/composer test.zip': {
        'COMPOSER': ['Paragraph Style 1 @ 1'],
    },
    'unit_tests/composer_check/fail_data/composers.zip': {
        'COMPOSER': ['Paragraph Style 1 @ 1', 'Paragraph Style 4 @ 1'],
    },
    'unit_tests/composer_check/pass_data/Blank.zip': {
        'COMPOSER': [],
    },
    'unit_tests/composer_check/pass_data/Harbour Club Fixed Folder.zip': {
        'COMPOSER': [],
    },
    'unit_tests/composer_check/pass_data/Image Transformation Folder.zip': {
        'COMPOSER': [],
    },
    'unit_tests/composer_check/pass_data/SEMCO1 Fixed.zip': {
        'COMPOSER': [],
    },
    'unit_tests/document_bleed_check/fail_data/1 bleed.zip': {
        'DOCUMENT_BLEED': ['document'],
    },
    'unit_tests/document_bleed_check/fail_data/A4 Template v1.zip': {
        'DOCUMENT_BLEED': ['document'],
    },
    'unit_tests/document_bleed_check/fail_data/Hyph style inheritance.zip': {
        'DOCUMENT_BLEED': ['document'],
    },
    'unit_tests/document_bleed_check/fail_data/Not Using paragraph style.zip': {
        'DOCUMENT_BLEED': ['document'],
    },
    'unit_tests/document_bleed_check/pass_data/Blank.zip': {
        'DOCUMENT_BLEED': [],
    },
    'unit_tests/document_bleed_check/pass_data/Image Transformation Folder.zip': {
        'DOCUMENT_BLEED': [],
    },
    'unit_tests/document_bleed_check/pass_data/NewEmployeeFolder1.zip': {
        'DOCUMENT_BLEED': [],
    },
    'unit_tests/document_bleed_check/pass_data/The Harbour club.zip': {
        'DOCUMENT_BLEED': [],
    },
    # VERY LARGE SCRIPT FAILS
    'unit_tests/embedded_image_check/fail_data/3 embedded Folder.zip': {
        'EMBEDDED_IMAGE': [
            'Screen2_women_cmyk_300dpi.jpg @ 1',
            'X.ai @ 1',
            'phone_journey-start-switzerland_campaign_de.svg @ 1',
        ],
    },
    'unit_tests/embedded_image_check/fail_data/3 embedded images.zip': {
        'EMBEDDED_IMAGE': [
            'Frontify-Brand_Infrastructure-en.pdf @ 1',
            'logo_FÃ¶rderturm_original.png @ 1',
            'logo_FÃ¶rderturm_original.png @ 1',
        ],
    },
    'unit_tests/embedded_image_check/fail_data/4 embedded.zip': {
        'EMBEDDED_IMAGE': [
            'Wave_Pattern_CMYK_Gray.ai @ 1',
            'Wave_Pattern_CMYK_Gray.ai @ 2',
            'pexels-mizuno-k-12903254.png @ 1',
            'shutterstock_1151850470.png @ 2',
        ],
    },
    'unit_tests/embedded_image_check/fail_data/qr code and 1 missing image Folder.zip': {
        'EMBEDDED_IMAGE': ['QR Code15403-811472920 @ 1'],
    },
    'unit_tests/embedded_image_check/pass_data/1 missing 2 unused image.zip': {
        'EMBEDDED_IMAGE': [],
    },
    'unit_tests/embedded_image_check/pass_data/Blank.zip': {
        'EMBEDDED_IMAGE': [],
    },
    'unit_tests/embedded_image_check/pass_data/Image Transformation Folder.zip': {
        'EMBEDDED_IMAGE': [],
    },
    'unit_tests/embedded_image_check/pass_data/VOITH SINGLE.zip': {
        'EMBEDDED_IMAGE': [],
    },
    'unit_tests/fonts_included_check/fail_data/1font missing.zip': {
        'FONTS_INCLUDED': ['FuturaEF'],
    },
    # BlairITC TT
    # Montserrat is an Adobe Font (TypekitID) that isn't packaged: reported by adobe_font_check instead.
    'unit_tests/fonts_included_check/fail_data/2 font missing.zip': {
        'FONTS_INCLUDED': ['BlairITC TT'],
    },
    'unit_tests/fonts_included_check/fail_data/No Document Fonts folder.zip': {
        'FONTS_INCLUDED': ['FuturaEF', 'FuturaEF DemiBold', 'Minion Pro'],
    },
    'unit_tests/fonts_included_check/fail_data/Test-Basic-File-Template Folder.zip': {
        'FONTS_INCLUDED': ['Public Sans'],
    },
    'unit_tests/fonts_included_check/pass_data/Blank.zip': {
        'FONTS_INCLUDED': [],
    },
    'unit_tests/fonts_included_check/pass_data/Not Using paragraph style.zip': {
        'FONTS_INCLUDED': [],
    },
    'unit_tests/fonts_included_check/pass_data/The Harbour club.zip': {
        'FONTS_INCLUDED': [],
    },
    'unit_tests/fonts_included_check/pass_data/VOITH_7 overrides.zip': {
        'FONTS_INCLUDED': [],
    },
    'unit_tests/fonts_included_check/pass_data/Weird Font Family convention.zip': {
        'FONTS_INCLUDED': [],
    },
    'unit_tests/grid_alignment_check/fail_data/1 grid alignment.zip': {
        'GRID_ALIGNMENT': ['HEader 2 - Our Future @ 1'],
    },
    'unit_tests/grid_alignment_check/fail_data/2 grid alignment.zip': {
        'GRID_ALIGNMENT': ['HEader 2 - Our Future @ 1', 'Header 1 - Your Drive @ 1'],
    },
    'unit_tests/grid_alignment_check/fail_data/3 grid alignment.zip': {
        'GRID_ALIGNMENT': ['H2 @ 1', 'H3 @ 1', 'H4 @ 1'],
    },
    'unit_tests/grid_alignment_check/fail_data/The Harbour club_amsterdam-zuid_ENG Folder.zip': {
        'GRID_ALIGNMENT': ['Body Harbour Club @ 1', 'intro Harbour Club @ 1', 'kop goud @ 1', 'kop wit @ 1'],
    },
    'unit_tests/grid_alignment_check/pass_data/1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT.zip': {
        'GRID_ALIGNMENT': [],
    },
    'unit_tests/grid_alignment_check/pass_data/Blank.zip': {
        'GRID_ALIGNMENT': [],
    },
    'unit_tests/grid_alignment_check/pass_data/Image Transformation Folder.zip': {
        'GRID_ALIGNMENT': [],
    },
    'unit_tests/grid_alignment_check/pass_data/The Harbour club_amsterdam-zuid_ENG map.zip': {
        'GRID_ALIGNMENT': [],
    },
    'unit_tests/hyphenation_check/fail_data/Hyph style inheritance.zip': {
        'HYPHENATION': ['body copy:body text @ 1'],
    },
    'unit_tests/hyphenation_check/fail_data/Inherited Hyphenation.zip': {
        'HYPHENATION': ['HEader 2 - Our Future @ 1', 'Header 1 - Your Drive @ 1', 'Test style @ 2'],
    },
    'unit_tests/hyphenation_check/fail_data/Test-Basic-File-Template w HYP.zip': {
        'HYPHENATION': ['Paragraph Style 1 @ 1'],
    },
    'unit_tests/hyphenation_check/fail_data/The Harbour club.zip': {
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
    },
    'unit_tests/hyphenation_check/pass_data/Blank.zip': {
        'HYPHENATION': [],
    },
    'unit_tests/hyphenation_check/pass_data/Image Transformation Folder.zip': {
        'HYPHENATION': [],
    },
    'unit_tests/hyphenation_check/pass_data/No Hyph.zip': {
        'HYPHENATION': [],
    },
    'unit_tests/hyphenation_check/pass_data/OTF font.zip': {
        'HYPHENATION': [],
    },
    'unit_tests/hyphenation_check/pass_data/Test-Basic-File-Template Folder.zip': {
        'HYPHENATION': [],
    },
    'unit_tests/image_transformation_check/fail_data/3 err 2 warn transformation.zip': {
        'TRANSFORMATION': [
            '230209_FRO2301_NYC_15.jpg @ 2 (flip)',
            '230209_FRO2301_NYC_15.jpg @ 2 (flip)',
            'Frontify_Linkedin-Cover-Employee_1584x396.png @ 2 (skew)',
        ],
    },
    'unit_tests/image_transformation_check/fail_data/4 err 2 warn transformations.zip': {
        'TRANSFORMATION': [
            '230209_FRO2301_NYC_15.jpg @ 2 (flip)',
            '230209_FRO2301_NYC_15.jpg @ 2 (flip)',
            'Frontify_Linkedin-Cover-Employee_1584x396.png @ 2 (skew)',
        ],
    },
    # Flip (frame uf3)
    # Horizontal flip (frame uea, -1 0 0 1; was reported as a 180 degree rotation)
    'unit_tests/image_transformation_check/fail_data/Image Transformation Folder.zip': {
        'TRANSFORMATION': [
            'logo_KawaksakiMotorsCorp.USA_original.png @ 1 (flip)',
            'logo_KawaksakiMotorsCorp.USA_original.png @ 2 (flip)',
        ],
    },
    'unit_tests/image_transformation_check/fail_data/Not Using paragraph style.zip': {
        'TRANSFORMATION': [],
    },
    'unit_tests/image_transformation_check/pass_data/1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT.zip': {
        'TRANSFORMATION': [],
    },
    'unit_tests/image_transformation_check/pass_data/Test-Basic-File-Template w HYP.zip': {
        'TRANSFORMATION': [],
    },
    'unit_tests/image_transformation_check/pass_data/The Harbour club_amsterdam-zuid_ENG map.zip': {
        'TRANSFORMATION': [],
    },
    'unit_tests/image_transformation_check/pass_data/VOITH SINGLE.zip': {
        'TRANSFORMATION': [],
    },
    # .DS_STORE ISSUES #ADDS %20 on spaces in file names?
    'unit_tests/images_included_check/fail_data/1 missing 2 unused image.zip': {
        'IMAGE_INCLUDED': ['Simple_CMYK_Gradients_Fuschia copy.ai @ 1'],
        'UNUSED_IMAGE': ['Adobe Creative Cloud.png', 'email-footer-cfc-650x150.png'],
    },
    'unit_tests/images_included_check/fail_data/2 missing links.zip': {
        'IMAGE_INCLUDED': ['monobrand-main-logo-black.eps @ 1', 'person-holding-wooden-toothbrush-3737592.jpg @ 1'],
        'UNUSED_IMAGE': [],
    },
    'unit_tests/images_included_check/fail_data/Image Transformation Folder 2.zip': {
        'IMAGE_INCLUDED': ['logo_KawaksakiMotorsCorp.USA_original.png @ 2'],
        'UNUSED_IMAGE': [],
    },
    'unit_tests/images_included_check/fail_data/qr code and 1 missing image Folder.zip': {
        'IMAGE_INCLUDED': ['iStock-1226023798.jpg @ 1'],
        'UNUSED_IMAGE': [],
    },
    'unit_tests/images_included_check/pass_data/1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT.zip': {
        'IMAGE_INCLUDED': [],
        'UNUSED_IMAGE': [],
    },
    'unit_tests/images_included_check/pass_data/Blank.zip': {
        'IMAGE_INCLUDED': [],
        'UNUSED_IMAGE': [],
    },
    'unit_tests/images_included_check/pass_data/Image Transformation Folder.zip': {
        'IMAGE_INCLUDED': [],
        'UNUSED_IMAGE': [],
    },
    'unit_tests/images_included_check/pass_data/VOITH SINGLE.zip': {
        'IMAGE_INCLUDED': [],
        'UNUSED_IMAGE': [],
    },
    # Paragraph style H4 uses Optical kerning (Styles.xml: KerningMethod="$ID/Optical"); one error per
    # story that uses H4 (3 stories). Character-style kerning has no package: see testing/fixtures/test_kerning_rule.py.
    'unit_tests/kerning_check/fail_data/1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT.zip': {
        'KERNING': ['H4 @ 1', 'H4 @ 1', 'H4 @ 1'],
        'KERNING_CHAR': [],
    },
    'unit_tests/kerning_check/pass_data/Blank.zip': {
        'KERNING': [],
        'KERNING_CHAR': [],
    },
    'unit_tests/kerning_check/pass_data/Image Transformation Folder.zip': {
        'KERNING': [],
        'KERNING_CHAR': [],
    },
    'unit_tests/kerning_check/pass_data/VOITH SINGLE.zip': {
        'KERNING': [],
        'KERNING_CHAR': [],
    },
    'unit_tests/large_image_check/fail_data/1 large image.zip': {
        'LARGE_IMAGE': ['iStock-1226023798.jpg @ 1'],
    },
    'unit_tests/large_image_check/fail_data/2 large images 1 small with same name Folder.zip': {
        'LARGE_IMAGE': ['PHONE_SHAPE.psd @ 1', 'Screen2_women_cmyk_300dpi.jpg @ 1'],
    },
    'unit_tests/large_image_check/fail_data/2 large images.zip': {
        'LARGE_IMAGE': ['PHONE_SHAPE.psd @ 1', 'Screen2.psd @ 1'],
    },
    'unit_tests/large_image_check/fail_data/Large image used.zip': {
        'LARGE_IMAGE': ['large_image.tiff @ 1'],
    },
    'unit_tests/large_image_check/pass_data/1 missing 2 unused image.zip': {
        'LARGE_IMAGE': [],
    },
    'unit_tests/large_image_check/pass_data/Blank.zip': {
        'LARGE_IMAGE': [],
    },
    'unit_tests/large_image_check/pass_data/Image Transformation Folder.zip': {
        'LARGE_IMAGE': [],
    },
    'unit_tests/large_image_check/pass_data/VOITH SINGLE.zip': {
        'LARGE_IMAGE': [],
    },
    'unit_tests/linked_text_frame_check/fail_data/1 linked frame.zip': {
        'LINKED_TEXT_FRAME': ['u107 @ 1', 'uf0 @ 1'],
    },
    'unit_tests/linked_text_frame_check/fail_data/2 linked.zip': {
        'LINKED_TEXT_FRAME': ['u12e7 @ 2', 'u1300 @ 2'],
    },
    'unit_tests/linked_text_frame_check/fail_data/3 linked text boxes.zip': {
        'LINKED_TEXT_FRAME': ['u107 @ 1', 'u11e @ 1', 'uf0 @ 1'],
    },
    'unit_tests/linked_text_frame_check/fail_data/5 linked frames.zip': {
        'LINKED_TEXT_FRAME': ['u107 @ 1', 'u11e @ 1', 'u15f @ 1', 'u176 @ 1', 'uf0 @ 1'],
    },
    'unit_tests/linked_text_frame_check/pass_data/Auto Size Text box- Height Only top Down.zip': {
        'LINKED_TEXT_FRAME': [],
    },
    'unit_tests/linked_text_frame_check/pass_data/Blank.zip': {
        'LINKED_TEXT_FRAME': [],
    },
    'unit_tests/linked_text_frame_check/pass_data/Image Transformation Folder.zip': {
        'LINKED_TEXT_FRAME': [],
    },
    'unit_tests/linked_text_frame_check/pass_data/lots of auto size Folder.zip': {
        'LINKED_TEXT_FRAME': [],
    },
    'unit_tests/masterpage_check/fail_data/Container on masterpage.zip': {
        'MASTERPAGE': ['document'],
    },
    'unit_tests/masterpage_check/fail_data/Line on masterpage.zip': {
        'MASTERPAGE': ['document'],
    },
    'unit_tests/masterpage_check/fail_data/Master Page.zip': {
        'MASTERPAGE': ['document'],
    },
    'unit_tests/masterpage_check/fail_data/MasterPage with image.zip': {
        'MASTERPAGE': ['document'],
    },
    'unit_tests/masterpage_check/pass_data/Blank.zip': {
        'MASTERPAGE': [],
    },
    'unit_tests/masterpage_check/pass_data/Embedded Image.zip': {
        'MASTERPAGE': [],
    },
    'unit_tests/masterpage_check/pass_data/Employer Brand_Pullup Banner_Design 1.zip': {
        'MASTERPAGE': [],
    },
    'unit_tests/masterpage_check/pass_data/Missing two fonts.zip': {
        'MASTERPAGE': [],
    },
    'unit_tests/object_style_check/fail_data/1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT Folder.zip': {
        'OBJECT_STYLE': ['SEMCO_WHITE_LOGO.eps @ 1', 'u319f @ 1', 'u32c5 @ 1'],
    },
    'unit_tests/object_style_check/fail_data/2 obj style Folder.zip': {
        'OBJECT_STYLE': ['logo_FÃ¶rderturm_original.png @ 1', 'u102 @ 1'],
    },
    # One object syle not on textframe/image
    'unit_tests/object_style_check/fail_data/3 obj styles.zip': {
        'OBJECT_STYLE': ['pexels-mizuno-k-12903254.png @ 1', 'shutterstock_1151850470.png @ 2'],
    },
    'unit_tests/object_style_check/fail_data/4 obj style.zip': {
        'OBJECT_STYLE': ['THC zuid PNG.png @ 1', 'u43fb @ 1', 'u442a @ 1', 'u4458 @ 1'],
    },
    'unit_tests/object_style_check/pass_data/1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT.zip': {
        'OBJECT_STYLE': [],
    },
    'unit_tests/object_style_check/pass_data/Blank.zip': {
        'OBJECT_STYLE': [],
    },
    'unit_tests/object_style_check/pass_data/Image Transformation Folder.zip': {
        'OBJECT_STYLE': [],
    },
    'unit_tests/object_style_check/pass_data/The Harbour club_amsterdam-zuid_ENG map.zip': {
        'OBJECT_STYLE': [],
    },
    'unit_tests/otf_ttf_font_check/fail_data/1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT.zip': {
        'OTF_TTF_FONT': ['Times.ttc'],
    },
    'unit_tests/otf_ttf_font_check/fail_data/TTC Font Template.zip': {
        'OTF_TTF_FONT': ['Futura.ttc'],
    },
    'unit_tests/otf_ttf_font_check/pass_data/Blank.zip': {
        'OTF_TTF_FONT': [],
    },
    'unit_tests/otf_ttf_font_check/pass_data/Mixed paragraph styles.zip': {
        'OTF_TTF_FONT': [],
    },
    'unit_tests/otf_ttf_font_check/pass_data/Test-Basic-File-Template w HYP.zip': {
        'OTF_TTF_FONT': [],
    },
    'unit_tests/otf_ttf_font_check/pass_data/The Harbour club.zip': {
        'OTF_TTF_FONT': [],
    },
    'unit_tests/otf_ttf_font_check/pass_data/VOITH_7 overrides.zip': {
        'OTF_TTF_FONT': [],
    },
    'unit_tests/overrides_check/fail_data/6 overrides.zip': {
        'OVERRIDE': ['u112 @ 1', 'u112 @ 1', 'u112 @ 1', 'u112 @ 1', 'u112 @ 1', 'u112 @ 1'],
    },
    'unit_tests/overrides_check/fail_data/VOITH_7 overrides.zip': {
        'OVERRIDE': ['u116 @ 1', 'u116 @ 1', 'u12c @ 1', 'u142 @ 1', 'u142 @ 1', 'u163 @ 1', 'u179 @ 1'],
    },
    'unit_tests/overrides_check/fail_data/has overrides.zip': {
        'OVERRIDE': ['u1332 @ 2', 'u1d56 @ 1', 'u453 @ 1'],
    },
    'unit_tests/overrides_check/fail_data/with overrides.zip': {
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
    'unit_tests/overrides_check/pass_data/Blank.zip': {
        'OVERRIDE': [],
    },
    'unit_tests/overrides_check/pass_data/Flyer_TextHeavy4 Folder.zip': {
        'OVERRIDE': [],
    },
    'unit_tests/overrides_check/pass_data/Image Transformation Folder.zip': {
        'OVERRIDE': [],
    },
    'unit_tests/overrides_check/pass_data/The Harbour club.zip': {
        'OVERRIDE': [],
    },
    'unit_tests/par_check/fail_data/4_no_par_style.zip': {
        'PARAGRAPH_STYLE': ['u10e @ 1', 'u125 @ 1', 'u13c @ 1', 'uf0 @ 1'],
        'EMPTY_TEXT_FRAME': [],
    },
    'unit_tests/par_check/fail_data/No Document Fonts folder.zip': {
        'PARAGRAPH_STYLE': ['u1332 @ 2', 'u1d56 @ 1', 'u1d6d @ 2'],
        'EMPTY_TEXT_FRAME': [],
    },
    'unit_tests/par_check/fail_data/The Harbour club missing 1 style.zip': {
        'PARAGRAPH_STYLE': ['u417d @ 2'],
        'EMPTY_TEXT_FRAME': [],
    },
    'unit_tests/par_check/fail_data/Variable Font Example.zip': {
        'PARAGRAPH_STYLE': ['u112 @ 1', 'uf5 @ 1', 'ufa @ 1'],
        'EMPTY_TEXT_FRAME': [],
    },
    'unit_tests/par_check/pass_data/All_par_style.zip': {
        'PARAGRAPH_STYLE': [],
        'EMPTY_TEXT_FRAME': [],
    },
    'unit_tests/par_check/pass_data/Blank.zip': {
        'PARAGRAPH_STYLE': [],
        'EMPTY_TEXT_FRAME': [],
    },
    'unit_tests/par_check/pass_data/Test-Basic-File_with_styles.zip': {
        'PARAGRAPH_STYLE': [],
        'EMPTY_TEXT_FRAME': [],
    },
    'unit_tests/par_check/pass_data/The Harbour club.zip': {
        'PARAGRAPH_STYLE': [],
        'EMPTY_TEXT_FRAME': [],
    },
    'unit_tests/pasted_graphics_check/fail_data/A4 Template v1.zip': {
        'PASTED_GRAPHICS': ['document @ 1'],
    },
    'unit_tests/pasted_graphics_check/fail_data/NewEmployeeFolder1.zip': {
        'PASTED_GRAPHICS': ['document @ 1'],
    },
    'unit_tests/pasted_graphics_check/fail_data/Not Using paragraph style.zip': {
        'PASTED_GRAPHICS': ['document @ 1', 'document @ 2'],
    },
    'unit_tests/pasted_graphics_check/fail_data/Tietoevry_General News_Template Folder2.zip': {
        'PASTED_GRAPHICS': ['document @ 1'],
    },
    'unit_tests/pasted_graphics_check/pass_data/Blank.zip': {
        'PASTED_GRAPHICS': [],
    },
    'unit_tests/pasted_graphics_check/pass_data/Image Transformation Folder.zip': {
        'PASTED_GRAPHICS': [],
    },
    'unit_tests/pasted_graphics_check/pass_data/VOITH SINGLE.zip': {
        'PASTED_GRAPHICS': [],
    },
    'unit_tests/pasted_graphics_check/pass_data/qr code and 1 missing image Folder.zip': {
        'PASTED_GRAPHICS': [],
    },
    'unit_tests/table_check/fail_data/2 tables (table in table).zip': {
        'TABLE': ['u17a @ 1', 'u17a @ 1'],
    },
    'unit_tests/table_check/fail_data/2 tables.zip': {
        'TABLE': ['u1dad @ 2', 'u1dad @ 2'],
    },
    'unit_tests/table_check/fail_data/6 tables Folder.zip': {
        'TABLE': ['u104 @ 1', 'u146 @ 1', 'u1ce @ 1', 'u1ef @ 1', 'u210 @ 1', 'u235'],
    },
    'unit_tests/table_check/fail_data/Table.zip': {
        'TABLE': ['u12a @ 1'],
    },
    'unit_tests/table_check/pass_data/All_par_style.zip': {
        'TABLE': [],
    },
    'unit_tests/table_check/pass_data/Blank.zip': {
        'TABLE': [],
    },
    'unit_tests/table_check/pass_data/Test-Basic-File_with_styles.zip': {
        'TABLE': [],
    },
    'unit_tests/table_check/pass_data/The Harbour club.zip': {
        'TABLE': [],
    },
    'unit_tests/text_columns_check/fail_data/1 column.zip': {
        'TEXT_COLUMNS': ['u10e @ 1'],
    },
    'unit_tests/text_columns_check/fail_data/2 column error.zip': {
        'TEXT_COLUMNS': ['u112 @ 1', 'uf0 @ 1'],
    },
    'unit_tests/text_columns_check/fail_data/4 column.zip': {
        'TEXT_COLUMNS': ['u10e @ 1', 'u127 @ 1', 'u159 @ 1', 'uf0 @ 1'],
    },
    'unit_tests/text_columns_check/fail_data/columns Folder.zip': {
        'TEXT_COLUMNS': ['u10f @ 1', 'u128 @ 1', 'uf0 @ 1'],
    },
    'unit_tests/text_columns_check/pass_data/Blank.zip': {
        'TEXT_COLUMNS': [],
    },
    'unit_tests/text_columns_check/pass_data/Image Transformation Folder.zip': {
        'TEXT_COLUMNS': [],
    },
    'unit_tests/text_columns_check/pass_data/The Harbour club.zip': {
        'TEXT_COLUMNS': [],
    },
    'unit_tests/text_columns_check/pass_data/VOITH_7 overrides.zip': {
        'TEXT_COLUMNS': [],
    },
    # Used 2 variable Fonts, but we are checking Font Family so only 1 error expected
    'unit_tests/variable_font_check/fail_data/2 var fonts.zip': {
        'VARIABLE_FONT': ['Roboto Mono'],
    },
    'unit_tests/variable_font_check/fail_data/3 variable fonts with multiple weights Folder.zip': {
        'VARIABLE_FONT': ['Edu TAS Beginner', 'Playpen Sans', 'Roboto Mono'],
    },
    'unit_tests/variable_font_check/fail_data/4 var fonts Folder.zip': {
        'VARIABLE_FONT': ['Aleo', 'Alexandria', 'Cabin', 'Varta'],
    },
    'unit_tests/variable_font_check/fail_data/Variable Font Example.zip': {
        'VARIABLE_FONT': ['Public Sans'],
    },
    'unit_tests/variable_font_check/pass_data/1023_SEMCO_OTHER_3984112_Overview_FS_TEMP_RES_PRINT.zip': {
        'VARIABLE_FONT': [],
    },
    'unit_tests/variable_font_check/pass_data/Blank.zip': {
        'VARIABLE_FONT': [],
    },
    'unit_tests/variable_font_check/pass_data/Image Transformation Folder.zip': {
        'VARIABLE_FONT': [],
    },
    'unit_tests/variable_font_check/pass_data/VOITH SINGLE.zip': {
        'VARIABLE_FONT': [],
    },
}

# How many issues of each check a whole run finds.
ALL_ISSUES = {
    'end_to_end_tests/fail_data/All_err_and_warn.zip': {
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
    'end_to_end_tests/fail_data/Another Test.zip': {
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
    # Playfair Display: the text uses its Regular style, an Adobe Font (TypekitID) that isn't packaged.
    'end_to_end_tests/fail_data/Brochure_Bad.zip': {
        'ADOBE_FONT': 1,
        'COMPOSER': 1,
        'DOCUMENT_BLEED': 1,
        'FONTS_INCLUDED': 1,
        'OVERRIDE': 12,
        'PARAGRAPH_STYLE': 10,
        'TEXT_COLUMNS': 2,
        'VARIABLE_FONT': 1,
    },
    'end_to_end_tests/fail_data/Fact-Sheet-Images_Bad.zip': {
        'COMPOSER': 3,
        'FONTS_INCLUDED': 1,
        'HYPHENATION': 16,
        'OVERRIDE': 9,
        'PARAGRAPH_STYLE': 7,
    },
    'end_to_end_tests/fail_data/Flyer-Sales_Bad.zip': {
        'COMPOSER': 1,
        'DOCUMENT_BLEED': 1,
        'FONTS_INCLUDED': 1,
        'OVERRIDE': 3,
        'PARAGRAPH_STYLE': 3,
    },
    # Playfair Display: the text uses its Regular style, an Adobe Font (TypekitID) that isn't packaged.
    # Skew (frame u188)
    # Horizontal flip (frame u17f, -1 0 0 1)
    # Auto size (WidthOnly from center) is no longer an error: Frontify supports every reference point.
    'end_to_end_tests/fail_data/Full coverage errors Folder.zip': {
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
    'end_to_end_tests/fail_data/Lookbook_Bad.zip': {
        'COMPOSER': 1,
        'DOCUMENT_BLEED': 1,
        'FONTS_INCLUDED': 1,
        'OVERRIDE': 13,
        'PARAGRAPH_STYLE': 9,
    },
    # Playfair Display: the text uses its Regular style, an Adobe Font (TypekitID) that isn't packaged.
    'end_to_end_tests/fail_data/Packaging_Bad Folder.zip': {
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
    # Auto size (HeightOnly from center) is no longer an error: Frontify supports every reference point.
    'end_to_end_tests/fail_data/RollUp_Bad.zip': {
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
    'end_to_end_tests/fail_data/Sammelform-Price-Tag_Bad.zip': {
        'COMPOSER': 1,
        'FONTS_INCLUDED': 1,
        'OVERRIDE': 63,
        'PARAGRAPH_STYLE': 63,
    },
    'end_to_end_tests/fail_data/Shopping-Bag_Bad.zip': {
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
    'end_to_end_tests/fail_data/VOITH_Bad Folder.zip': {
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
    'end_to_end_tests/pass_data/Blank.zip': {},
    'end_to_end_tests/pass_data/Brochure_Good.zip': {},
    # Text uses Playfair Display Black (paragraph style Title), an Adobe Font that isn't packaged; and a
    # variable Montserrat is used through the character styles Title style / Text style.
    'end_to_end_tests/pass_data/Fact-Sheet-Images_Good.zip': {'ADOBE_FONT': 1, 'VARIABLE_FONT': 1},
    # Text uses Playfair Display Regular (Sub Header); only PlayfairDisplay-Black.ttf is packaged.
    'end_to_end_tests/pass_data/Flyer-Sales_Good.zip': {'FONTS_INCLUDED': 1},
    # Text uses Playfair Display Black (Header) and Regular (Footer), Adobe Fonts that aren't packaged.
    'end_to_end_tests/pass_data/Lookbook_Good.zip': {'ADOBE_FONT': 1},
    # Text uses Playfair Display Regular (Paragraph Style 1); only the Bold file is packaged.
    'end_to_end_tests/pass_data/Packaging_Good.zip': {'FONTS_INCLUDED': 1},
    'end_to_end_tests/pass_data/RollUp_Fixed.zip': {},
    'end_to_end_tests/pass_data/Sammelform-Price-Tag_Good.zip': {},
    'end_to_end_tests/pass_data/Shopping-Bag_Good.zip': {},
    'end_to_end_tests/pass_data/VOITH_Good.zip': {},
}
