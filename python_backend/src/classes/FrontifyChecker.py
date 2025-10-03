import zipfile
import os
import uuid
import shutil  # to delete the __MACOSX folder after unzipping
import math
import sys
from typing import Dict, List, Union
from src.error_handling.ErrorHandling import ValidationResult, ValidationCategory
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning, ValidationInfo
from src.parsers.SourceFoldersParser import SourceFoldersParser
from src.parsers.SpreadsParser import SpreadsParser
from src.parsers.FontsParser import FontsParser
from src.parsers.MasterPageParser import MasterPageParser
from src.parsers.StylesParser import StylesParser
from src.parsers.StoriesParser import StoriesParser
from src.parsers.PreferencesParser import PreferencesParser
from src.classes.States import States


# *****************************************************************************************
# Class: FrontifyChecker
# Description: This class does the actual comparisions to execute checks. Each state is a
# single check. Parser classes do the actual parsing of XML. Here is this class is where
# the check occurs for if a state throws an error or warning.
# *****************************************************************************************
class FrontifyChecker:
    def __init__(self):
        # Source ZIP
        self.source_file_path: str = ''
        self.template_name: str = ''
        # Data
        self.data_folder: str = ''
        self.unzipped_folder_path: str = ''
        self.unzipped_root_path: str = ''
        # Unarchived IDML
        self.idml_output_folder: str = ''
        self.spreads_dir: str = ''
        # XML Data
        self.stories_parser: StoriesParser = None
        self.masterspreads_parser: MasterPageParser = None
        self.fonts_parser: FontsParser = None
        self.spreads_parser: SpreadsParser = None
        self.source_folders_parser: SourceFoldersParser = None
        self.preferences_parser: PreferencesParser = None
        self.stories_exist: bool = True
        self.metadata_xml_path: bool = False
        # Initial State for State Machine, through GUI we already called States.GET_ZIP
        self.current_state: States = States.UNZIP_PACKAGE
        # Defaults
        self.default_par_styles: List[str] = [
            "ParagraphStyle/$ID/NormalParagraphStyle", "ParagraphStyle/$ID/[No paragraph style]"]
        self.default_object_styles: List[str] = ['ObjectStyle/$ID/[None]',
                                                 'ObjectStyle/$ID/[Normal Graphics Frame]',
                                                 'ObjectStyle/$ID/[Normal Text Frame]']
        # State Machine States
        self.states: Dict[States] = {
            States.GET_ZIP: self.get_zip_state,
            States.UNZIP_PACKAGE: self.unzip_package_state,
            States.UNZIP_IDML: self.unzip_idml_state,
            States.PARSE_XML: self.parse_xml,
            States.MASTERPAGE_CHECK: self.masterpage_check,
            States.PAR_CHECK: self.par_style_check,
            States.HYPHENATION_CHECK: self.hyphenation_check,
            States.KERNING_CHECK: self.kerning_check,
            States.OVERRIDES_CHECK: self.overrides_check,
            States.FONTS_INCLUDED_CHECK: self.fonts_included_check,
            States.OTF_TTF_FONT_CHECK: self.otf_ttf_font_check,
            States.VARIABLE_FONT_CHECK: self.variable_font_check,
            States.IMAGES_INCLUDED_CHECK: self.images_included_check,
            States.LARGE_IMAGE_CHECK: self.large_image_check,
            States.EMBEDDED_IMAGE_CHECK: self.embedded_image_check,
            States.IMAGE_TRANSFORMATION_CHECK: self.image_transformation_check,
            States.TABLE_CHECK: self.table_check,
            States.AUTO_SIZE_TEXT_BOX_CHECK: self.auto_size_text_box_check,
            States.PASTED_GRAPHICS_CHECK: self.pasted_graphics_check,
            States.DOCUMENT_BLEED_CHECK: self.document_bleed_check,
            States.TEXT_COLUMNS_CHECK: self.text_columns_check,
            States.TEXT_WRAP_CHECK: self.text_wrap_check,
            States.LINKED_TEXT_FRAME_CHECK: self.linked_text_frame_check,
            States.OBJECT_STYLE_CHECK: self.object_style_check,
            States.GRID_ALIGNMENT_CHECK: self.grid_alignment_check,
            States.COMPOSER_CHECK: self.composer_check,
            States.OTHER_CHECKS: self.other_checks,
            States.RESULTS: self.results_analytics,
            States.EXIT: None,
        }
        # Validation Class
        self.results: ValidationResult = ValidationResult()

    def run_state_machine(self):
        while self.current_state:
            print(self.current_state)
            self.current_state = self.states[self.current_state]()
            if (self.current_state == States.EXIT):
                return

        print(self.current_state)

    # ========================================================================================
    # State: GET_ZIP
    # PASS Next State Transition: NA
    # FAIL States Transition: NA
    # Description: GUI acts as an event handler and calls this function.
    # ========================================================================================
    def get_zip_state(self) -> bool:
        # source_file_path = filedialog.askopenfilename(
        #     filetypes=[("Zip files", "*.zip")])
        if self.source_file_path and self.source_file_path.endswith('.zip'):
            self.template_name = os.path.basename(self.source_file_path)
            return True
        else:
            self.results.add_error(
                "File uploaded is not ZIP", ValidationError.ZIP)
            return False

    # ========================================================================================
    # State: UNZIP_PACKAGE
    # PASS Next State Transition: UNZIP_IDML
    # FAIL States Transition: RESULTS
    # Description: Deletes 'data' folder, then create 'data' folder
    # ========================================================================================
    def unzip_package_state(self) -> States:
        self.results.add_template_name(os.path.basename(self.source_file_path))
        # current_dir = os.getcwd()
        # self.data_folder = os.path.join(current_dir, 'data')
        if getattr(sys, 'frozen', False):
            # The application is frozen (packaged by PyInstaller)
            current_dir = os.path.dirname(sys.executable)
        else:
            # The application is not frozen (running as a script)
            script_dir = os.path.dirname(__file__)
            current_dir = os.path.join(script_dir, '..')

        self.data_folder = os.path.join(current_dir, 'data')
        if not self.get_zip_state():
            return States.EXIT

        if not self.cleanup_data_folder():
            return States.EXIT

        if not self.extract_zip_to_data_folder():
            return States.EXIT

        return States.UNZIP_IDML

    # ---------------------------------------------------
    # Function: cleanup_data_folder
    # Description: Deletes 'data' folder if it exists,
    # then creates a new 'data' folder. Then create a
    # unique folder for unzipping package too.
    # ---------------------------------------------------
    def cleanup_data_folder(self) -> bool:
        try:
            # Ensure the base data folder exists
            if not os.path.exists(self.data_folder):
                os.makedirs(self.data_folder)

            # Generate a unique folder name using UUID
            unique_folder_name = str(uuid.uuid4())
            unique_folder_path = os.path.join(
                self.data_folder, unique_folder_name)

            # Create the unique folder
            os.makedirs(unique_folder_path)

            # Save the unique folder path to self.unzipped_root_path
            self.unzipped_root_path = unique_folder_path

            return True
        except Exception as e:
            self.results.add_custom_error(
                f"Error creating the folders '{self.data_folder}': {str(e)}", ValidationError.ERROR)
            return False

    # ---------------------------------------------------
    # Function: find_idml_files
    # Description: searches for IDML files in a directory
    # Returns a list of idml files found.
    # ---------------------------------------------------
    def find_idml_files(self, directory) -> List[str]:
        idml_files = []
        # List all files in the given directory
        for file in os.listdir(directory):
            if file.endswith('.idml'):
                idml_files.append(os.path.join(directory, file))
        return idml_files

    # ---------------------------------------------------
    # Function: extract_zip_to_data_folder
    # Description: Extracts ZIP into unique folder. Then deletes the
    # __MACOSC folder from ZIP. Check only 1 folder in unique folder.
    # ---------------------------------------------------
    def extract_zip_to_data_folder(self) -> bool:
        try:
            with zipfile.ZipFile(self.source_file_path, 'r') as zip_ref:
                zip_ref.extractall(self.unzipped_root_path)
                # to delete the __MACOSX folder after unzipping
                macosx_dir = os.path.join(self.unzipped_root_path, '__MACOSX')
                if os.path.exists(macosx_dir):
                    shutil.rmtree(macosx_dir)

                # We need to check if the unzipped package has a root folder or not
                if len(self.find_idml_files(self.unzipped_root_path)) == 0:
                    unzipped_folder_name = next(os.walk(self.unzipped_root_path))[
                        1][0]  # Get the name of the unzipped folder
                    self.unzipped_folder_path = os.path.join(
                        self.unzipped_root_path, unzipped_folder_name)
                else:
                    self.unzipped_folder_path = self.unzipped_root_path

        except Exception as e:
            self.results.add_custom_error(
                f"Failed to unzip the file. Error: {e}", ValidationError.ERROR)
            return False

        # # Get all directories in the unique folder
        # all_dirs = [d for d in os.listdir(
        #     self.unzipped_root_path) if os.path.isdir(os.path.join(self.unzipped_root_path, d))]

        # # Check if there's only one main folder
        # if len(all_dirs) != 1:
        #     # for _dir in all_dirs: #Debug Print
        #     #     print(_dir)
        #     self.results.add_custom_error(
        #         "Multiple folders found in the provided package. Please ensure there's only one main folder after unzipping.", ValidationError.ERROR)
        #     return False
        return True

    # ========================================================================================
    # State: UNZIP_IDML
    # PASS Next State Transition: PARSE_XML
    # FAIL States Transition: RESULTS
    # Description: Searches for the .idml files in the unzipped folder,
    # ensures there's only one .idml file, and then unarchives it.
    # ========================================================================================
    def unzip_idml_state(self) -> States:

        idml_path = self.validate_idml_files()
        if not idml_path:
            return States.EXIT
        if not self.unarchive_idml_files(idml_path):
            return States.EXIT
        return States.PARSE_XML

    # ---------------------------------------------------
    # Function: validate_idml_files
    # Description: Searches for .idml files in the unzipped folder path.
    # If no .idml files are found, an error is added to the results.
    # If multiple .idml files are found, an error is added to the results.
    # If one .idml file is found, its path is returned.
    # Returns: Path of the .idml file if one is found, False otherwise.
    # ---------------------------------------------------
    def validate_idml_files(self) -> bool:
        idml_files = self.find_idml_files(self.unzipped_folder_path)

        if len(idml_files) == 0:
            self.results.add_error(
                "No .idml file found in the provided package.", ValidationError.IDML)
            return False
        elif len(idml_files) > 1:
            self.results.add_error(
                "Multiple .idml files found in the provided package. Please ensure there's only one .idml file.", ValidationError.IDML)
            return False
        return idml_files[0]

    # ---------------------------------------------------
    # Function: unarchive_idml_files
    # Description: Unarchives the provided .idml file into a designated output folder.
    # If the unarchiving is successful, a success message is added to the results.
    # If there's an error during unarchiving, an error message is added to the results.
    # Args:
    #       idml_path: Path to the .idml file to be unarchived.
    # Returns: True if unarchiving is successful, False otherwise.
    # ---------------------------------------------------
    def unarchive_idml_files(self, idml_path: str):
        self.idml_output_folder = os.path.join(
            self.unzipped_root_path, 'Source XML')
        os.makedirs(self.idml_output_folder, exist_ok=True)
        try:
            with zipfile.ZipFile(idml_path, 'r') as zip_ref:
                zip_ref.extractall(self.idml_output_folder)
            self.results.add_idml_output_folder(self.idml_output_folder)
            return True
        except Exception as e:
            self.results.add_custom_error(
                f"Failed to unzip the .idml file. Error: {e}", ValidationError.ERROR)
            return False

    # ========================================================================================
    # State: PARSE_XML
    # PASS Next State Transition:
    # FAIL States Transition: RESULTS
    # Description: Parses the XML to extract story data and paragraph styles.
    # ========================================================================================
    def parse_xml(self) -> States:
        # -----------------------------
        # Source Folders (Links, Document Fonts)
        # Init: SourceFoldersParser
        # -----------------------------
        # Check if 'Links' exists, if not create it to continue code flow
        document_links_folder_path = self.ensure_folder_exists(
            self.unzipped_folder_path, 'Links')

        # Check if 'Document Fonts' exists, if not create it to continue code flow
        document_fonts_folder_path = self.ensure_folder_exists(
            self.unzipped_folder_path, 'Document Fonts')
        self.source_folders_parser = SourceFoldersParser(
            document_links_folder_path, document_fonts_folder_path)

        # -----------------------------
        # Spreads XML
        # Init: SpreadsParser
        # -----------------------------
        # Check if Spreads directory exists
        spreads_dir = os.path.join(
            self.idml_output_folder, 'Spreads')
        if not os.path.exists(spreads_dir):
            self.results.add_custom_error(
                "Spreads directory does not exist", ValidationError.ERROR)
            return States.EXIT

        self.spreads_parser = SpreadsParser(
            spreads_dir)
        # -----------------------------
        # Fonts.XML
        # Init: FontsParser
        # -----------------------------
        # Check if Fonts.XML exists
        fonts_xml_path = os.path.join(
            self.idml_output_folder, 'Resources', 'Fonts.xml')
        if not os.path.exists(fonts_xml_path):
            self.results.add_custom_error(
                "Fonts.XML does not exist", ValidationError.ERROR)
            return States.EXIT
        self.fonts_parser = FontsParser(
            fonts_xml_path)
        # -----------------------------
        # Styles.XML
        # Init: StylesParser
        # -----------------------------
        # Check if Styles.xml exists
        styles_xml_path = os.path.join(
            self.idml_output_folder, 'Resources', 'Styles.xml')
        if not os.path.exists(styles_xml_path):
            self.results.add_custom_error(
                "Styles.xml file does not exist", ValidationError.ERROR)
            return States.EXIT
        # Initialize the StylesParser
        styles_parser = StylesParser(styles_xml_path)

        # -----------------------------
        # Stories XML
        # Init: StoriesParser
        # -----------------------------
        # Check if Stories directory exists
        stories_dir = os.path.join(self.idml_output_folder, 'Stories')
        if not os.path.exists(stories_dir):
            self.stories_exist = False
        else:
            # Initialize the StoriesParser and extract story data
            self.stories_parser = StoriesParser(
                stories_dir, styles_parser, self.fonts_parser, self.spreads_parser)

        # Map stories to text frames
        for spread in self.spreads_parser.spreads_obj_list:
            for text_frame in spread.get_text_frame_obj_list():
                story = self.stories_parser.get_story_by_id(
                    text_frame.parent_story_id)
                text_frame.add_parent_story_obj(
                    story)
                story.add_parent_text_frame_id(text_frame.get_frame_id())
        # Map source images to links
        link_dict = {}
        for spread in self.spreads_parser.spreads_obj_list:
            for link in spread.get_links_obj_list():
                link_name = link.get_link_name()
                link_dict[link_name] = link

        for image in self.source_folders_parser.get_images_obj_list():
            if image.get_image_name() in link_dict:
                matching_link = link_dict[image.get_image_name()]
                image.set_parent_link_data_id(
                    matching_link.get_rectangle_link_id())

        # -----------------------------
        # MasterSpreads XML
        # Init: MasterPageParser
        # -----------------------------
        # Check if MasterSpreads directory exists
        masterspreads_dir = os.path.join(
            self.idml_output_folder, 'MasterSpreads')
        if not os.path.exists(masterspreads_dir):
            self.results.add_warning(
                "MasterSpreads directory does not exist", ValidationWarning.WARNING)
        else:
            # Initialize the StoriesParser and extract story data
            self.masterspreads_parser = MasterPageParser(masterspreads_dir)

        # -----------------------------
        # META-INF XML
        # Init: NA
        # -----------------------------
        # Store Folder location
        meta_inf_folder = os.path.join(
            self.idml_output_folder, 'META-INF')
        if not os.path.exists(meta_inf_folder):
            self.metadata_xml_path = False
        else:
            potential_metadata_path = os.path.join(
                meta_inf_folder, 'metadata.xml')
            if os.path.exists(potential_metadata_path):
                self.metadata_xml_path = potential_metadata_path

        # -----------------------------
        # Preferences XML
        # Init: Preferences Parser
        # -----------------------------
        # Check if Styles.xml exists
        preferences_xml_path = os.path.join(
            self.idml_output_folder, 'Resources', 'Preferences.xml')
        if not os.path.exists(preferences_xml_path):
            self.results.add_custom_error(
                "Preferences.xml file does not exist", ValidationError.ERROR)
            return States.EXIT
        # Initialize the StylesParser
        self.preferences_parser = PreferencesParser(preferences_xml_path)
        return States.MASTERPAGE_CHECK

    def ensure_folder_exists(self, path, folder_name):
        # Convert all folder names in the unzipped folder path to lowercase and check if the lowercase version of the target folder exists
        folder_paths = [os.path.join(path, f) for f in os.listdir(path)
                        if os.path.isdir(os.path.join(path, f))]
        folder_names_lowercase = [f.lower() for f in os.listdir(path)
                                  if os.path.isdir(os.path.join(path, f))]
        target_folder_name_lowercase = folder_name.lower()

        if target_folder_name_lowercase not in folder_names_lowercase:
            # If the folder does not exist (regardless of case), create it
            target_folder_path = os.path.join(path, folder_name)
            os.makedirs(target_folder_path)
            # print(f"Folder '{folder_name}' created at {target_folder_path}")
            return target_folder_path
        else:
            # If it exists, find the actual path to use it (maintaining the original case)
            actual_folder_index = folder_names_lowercase.index(
                target_folder_name_lowercase)
            actual_folder_path = folder_paths[actual_folder_index]
            # print(
            #     f"Folder '{folder_name}' already exists at {actual_folder_path}")
            return actual_folder_path

    # ========================================================================================
    # State: MASTERPAGE_CHECK
    # PASS Next State Transition: PAR_CHECK
    # FAIL States Transition: IMAGES_INCLUDED_CHECK
    # Description: Checks masterspreads_parser for unexprected elements (not properties or page)
    # ========================================================================================
    def masterpage_check(self) -> States:
        # self.masterspreads_parser.print_unexpected_elements()  # Debug Print
        unexpected_elements = self.masterspreads_parser.get_unexpected_elements()
        message = ''
        if unexpected_elements:
            message = 'Elements: ' + ', '.join(unexpected_elements)

            self.results.add_error(
                context=message,
                error_type=ValidationError.MASTERPAGE,
                page=None,
                identifier=None
            )

        return States.PAR_CHECK

    # ========================================================================================
    # State: PAR_STYLE_CHECK
    # PASS Next State Transition: HYPHENATION_CHECK
    # FAIL States Transition: NA
    # Description: Checks story paragraph styles (used styles) for default InDesign par styles.
    # We are grouping standard paragraph styles together. Overrides break a style into seperate
    # parts in XML. So they are parsed as seperate, but if they are in sequence they will be
    # the same paragraph.
    # Grouped par styles are NEEDED.
    # ========================================================================================

    def par_style_check(self) -> States:
        # self.stories_parser.print_stories_data()  # Debug Print
        # Currently master page par styles are checked too, as text frames are a story. Might want to change in a phase 2.
        if not self.stories_exist:
            return States.HYPHENATION_CHECK

        for story in self.stories_parser.get_stories_data():
            page_name = story.get_page()
            story_content = story.get_story_text_content()
            story_id = story.get_story_id()
            data_id = story.get_parent_text_frame_id()
            if not story_content or story_content == '' or story_content == ' ':
                self.results.add_info(
                    context=None,
                    info_type=ValidationInfo.EMPTY_TEXT_FRAME,
                    page=page_name,
                    identifier=story_id,
                    data_id=data_id
                )
                continue
            grouped_paragraph_styles = story.get_grouped_paragraph_styles()

            if len(grouped_paragraph_styles) == 1 and grouped_paragraph_styles[0][0].get_style_id() in self.default_par_styles:
                # Process single default paragraph style differently
                # Only one style in a text box
                content = grouped_paragraph_styles[0][0].get_content()
                context_message = self.generate_context_message(
                    content, grouped_paragraph_styles, 0)
                self.results.add_error(
                    context=None,
                    error_type=ValidationError.PARAGRAPH_STYLE_TEXT_BOX,
                    page=page_name,
                    identifier=story_id,
                    data_id=data_id
                )
                continue

            # Need index for content context
            for i, grouped_styles in enumerate(grouped_paragraph_styles):
                grouped_style_id = grouped_styles[0].get_style_id()

                # Check if default paragraph styles were used
                if grouped_style_id in self.default_par_styles:

                    # Group the content of the grouped styles
                    content = ''.join(par_style.get_content()
                                      for par_style in grouped_styles)
                    # Check if content is empty or just space, we need more context as to where the issue is for end user
                    context_message = self.generate_context_message(
                        content, grouped_paragraph_styles, i)
                    message = f"{content} {context_message}"

                    self.results.add_error(
                        context=message,
                        error_type=ValidationError.PARAGRAPH_STYLE,
                        page=page_name,
                        identifier=story_id,
                        data_id=data_id
                    )

        return States.HYPHENATION_CHECK

    def generate_context_message(self, content: str, items: Union[List[List['StoryParagraphData']], List[List['StoryCharacterData']]], index: int):
        def get_content_from_item(item):
            # Extract content from a single item or a group of items
            if isinstance(item, list):
                return ''.join(par_style.get_content() for par_style in item)
            return item.get_content()

        if not content.strip():
            prev_content = get_content_from_item(
                items[index - 1]) if index > 0 else ''
            next_content = get_content_from_item(
                items[index + 1]) if index < len(items) - 1 else ''

            prev_content = prev_content.strip()
            next_content = next_content.strip()

            if prev_content:
                return f'Whitespace after text: {prev_content}'
            elif next_content:
                return f'Whitespace before text: {next_content}'
            else:
                return 'Whitespace'
        return ''

    # ========================================================================================
    # State: HYPHENATION_CHECK
    # PASS Next State Transition: OVERRIDES_CHECK
    # FAIL States Transition: NA
    # Description: Checks story paragraph styles for hyphenation enabled. The BaseProperty class
    #   parses for inheritance of hyphenation.
    # ========================================================================================

    def hyphenation_check(self) -> States:
        processed_styles = set()  # So we dont throw duplicate warnings
        hyphenated_default_styles = set()

        if not self.stories_exist:
            return States.OVERRIDES_CHECK
        for story in self.stories_parser.get_stories_data():
            data_id = story.get_parent_text_frame_id()
            for par_style in story.get_paragraph_styles():

                style_id = par_style.get_style_id()
                normalized_style_id = par_style.get_normalized_style_id()
                has_hyphenation = par_style.has_hyphenation()

                # Collect hyphenated default styles
                if (style_id in self.default_par_styles) and has_hyphenation:
                    hyphenated_default_styles.add(style_id)
                    continue

                if has_hyphenation and (style_id not in processed_styles):

                    # Format message with inheritance
                    par_style_hyph_obj = par_style.get_hyphenation_obj()
                    inherited_from = par_style_hyph_obj.get_inherited_from_value()
                    # message = f"Kerning is '{par_kerning_val}' for paragraph style: {normalized_style_id}"
                    inherited_message = f'Inherited from: {inherited_from}' if inherited_from else ''
                    # message += inherited_message

                    self.results.add_warning(
                        context=inherited_message,
                        warning_type=ValidationWarning.HYPHENATION,
                        page=None,
                        identifier=normalized_style_id,
                        data_id=data_id
                    )

                    # Add the style_id to the set
                    processed_styles.add(style_id)

        # if hyphenated_default_styles:
        #     self.results.add_warning(
        #         context='',
        #         warning_type=ValidationWarning.HYPHENATION,
        #         page=None,
        #         identifier=normalized_style_id)
        return States.OVERRIDES_CHECK

    # ========================================================================================
    # State: OVERRIDES_CHECK
    # PASS Next State Transition: FONTS_INCLUDED_CHECK
    # FAIL States Transition: NA
    # Description: Checks stories for character styles used. CharacterStyles class keeps track
    # of all additional properties or attributes used. We call a helper method to see if there
    # are any, if so, it is an override.
    # ========================================================================================
    def overrides_check(self) -> States:
        # Many overrides occur from the last or first char having an override, so showing the content isnt helpful.
        # Would be great to figure out a way to have better context in these situations
        overrides_default_par = False
        if not self.stories_exist:
            return States.KERNING_CHECK

        # Need index for content context
        for story in self.stories_parser.get_stories_data():
            page_name = story.get_page()
            story_id = story.get_story_id()
            paragraph_styles = story.get_paragraph_styles()
            data_id = story.get_parent_text_frame_id()
            for i, par_style in enumerate(paragraph_styles):

                has_overrides = par_style.has_overrides()
                style_id = par_style.get_style_id()
                if (style_id in self.default_par_styles) and has_overrides:
                    overrides_default_par = True

                elif has_overrides:
                    content = par_style.get_content()
                    context_message = self.generate_context_message(
                        content, paragraph_styles, i)
                    message = f"1. Text where issue is:  {content} {context_message} 2. Overrides: {par_style.get_overrides()}"
                    # Check if content is empty or just space, we need more context as to where the issue is for end user

                    self.results.add_warning(
                        context=message,
                        warning_type=ValidationWarning.OVERRIDE,
                        page=page_name,
                        identifier=story_id,
                        data_id=data_id
                    )

                # Now check character overrides
                char_styles = par_style.get_child_char_styles()
                for i, char_style in enumerate(char_styles):
                    if char_style.has_overrides():
                        content = char_style.get_content()

                        context_message = self.generate_context_message(
                            content, char_styles, i)
                        message = f"1. Text where issue is: {content} {context_message} 2. Overrides: {char_style.get_overrides()}"

                        self.results.add_warning(
                            context=message,
                            warning_type=ValidationWarning.OVERRIDE,
                            page=page_name,
                            identifier=story_id,
                            data_id=data_id
                        )

        # if overrides_default_par:
        #     self.results.add_warning(
        #         "Many overrides due to no paragraph style applied to text.",
        #         ValidationWarning.OVERRIDE
        #     )

        return States.KERNING_CHECK

    # ========================================================================================
    # State: KERNING_CHECK
    # PASS Next State Transition: FONTS_INCLUDED_CHECK
    # FAIL States Transition: NA
    # Description: Checks stories for character styles used and kerning. CharacterStyles class keeps track
    # of all additional properties or attributes used. We call a helper method to see if there
    # kerning non-metrics, if so, it is an override.
    # ========================================================================================
    def kerning_check(self) -> States:
        if not self.stories_exist:
            return States.FONTS_INCLUDED_CHECK

        # Need index for content context
        for story in self.stories_parser.get_stories_data():
            page_name = story.get_page()
            paragraph_styles = story.get_paragraph_styles()
            data_id = story.get_parent_text_frame_id()
            for i, par_style in enumerate(paragraph_styles):

                par_kerning_obj = par_style.get_kerning()
                par_kerning_val = par_kerning_obj.get_property_value()
                if par_kerning_val and (par_kerning_val != "Metrics"):
                    normalized_style_id = par_style.get_normalized_style_id()
                    inherited_from = par_kerning_obj.get_inherited_from_value()
                    inherited_message = f'Inherited from: {inherited_from}' if inherited_from else ''

                    self.results.add_error(
                        context=inherited_message,
                        error_type=ValidationError.KERNING,
                        page=page_name,
                        identifier=normalized_style_id,
                        data_id=data_id
                    )

                # Now check character overrides
                char_styles = par_style.get_child_char_styles()

                for i, char_style in enumerate(char_styles):
                    char_kerning_obj = char_style.get_kerning()
                    char_kerning_val = char_kerning_obj.get_property_value()
                    if char_kerning_val and (char_kerning_val != "Metrics"):
                        char_normalized_style_id = char_style.get_normalized_style_id()
                        inherited_from = char_kerning_obj.get_inherited_from_value()
                        inherited_message = f'Inherited from: {inherited_from}' if inherited_from else ''

                        self.results.add_error(
                            context=inherited_message,
                            error_type=ValidationError.KERNING_CHAR,
                            page=page_name,
                            identifier=char_normalized_style_id,
                            data_id=data_id
                        )

        return States.FONTS_INCLUDED_CHECK

    # ========================================================================================
    # State: FONTS_INCLUDED_CHECK
    # PASS Next State Transition: OTF_TTF_FONT_CHECK
    # FAIL States Transition: NA
    # Description: We get all used fonts (StoriesParser adds to FontsParser with override fonts)
    # and we get all fonts in document fonts. We compare them to see that all used fonts are
    # in the documents fonts folder.
    # ========================================================================================

    def fonts_included_check(self) -> States:
        # Currently only checking font families, not specific font.
        used_font_families_objects = self.fonts_parser.get_used_font_families()
        # skip variable fonts
        used_font_families_names = [
            font_obj.get_font_family() for font_obj in used_font_families_objects if not font_obj.is_variable_font()]

        document_font_families = [font_obj.get_font_family(
        ) for font_obj in self.source_folders_parser.get_document_fonts()]

        for used_font in used_font_families_names:
            if used_font not in document_font_families:

                # message = f"Font family '{used_font}' is used but not found in the document fonts."
                self.results.add_error(
                    context=None,
                    error_type=ValidationError.FONTS_INCLUDED,
                    page=None,
                    identifier=used_font
                )

        return States.OTF_TTF_FONT_CHECK

    # ========================================================================================
    # State: OFT_TTF_FONT_CHECK
    # PASS Next State Transition: VARIABLE_FONT_CHECK
    # FAIL States Transition: NA
    # Description: From FontsParser we can get a list of all Font objects from Fonts.XML. We
    # verify that the font type is TrueType(.TTF) or OpenTypeCFF(.OTF)
    # ========================================================================================
    def otf_ttf_font_check(self) -> States:
        # We could go further and map used fonts, to source fonts but this isn't needed because from XML we dont know fonts source (OTF, TTF, TTC). So we anyways dont get anything out of mapping.

        for font in self.source_folders_parser.get_document_fonts():
            font_extension = font.get_extension()
            if font_extension.lower() not in ['.otf', '.ttf']:
                font_family = font.get_font_family()
                message = f"Font is {font_extension}"
                self.results.add_error(
                    context=message,
                    error_type=ValidationError.OTF_TTF_FONT,
                    page=None,
                    identifier=font_family)

        return States.VARIABLE_FONT_CHECK

    # ========================================================================================
    # State: VARIABLE_FONT_CHECK
    # PASS Next State Transition: IMAGES_INCLUDED_CHECK
    # FAIL States Transition: NA
    # Description: From FontsParser we get a list of Font objects. We can call a helper function
    # to get the variable font attribute.
    # ========================================================================================
    def variable_font_check(self) -> States:
        for font_obj in self.fonts_parser.get_used_font_families():
            if font_obj.is_variable_font():
                font_family = font_obj.get_font_family()
                self.results.add_error(
                    context=None,
                    error_type=ValidationError.VARIABLE_FONT,
                    page=None,
                    identifier=font_family)

        return States.IMAGES_INCLUDED_CHECK

    # ========================================================================================
    # State: IMAGES_INCLUDED_CHECK
    # PASS Next State Transition: LARGE_IMAGE_CHECK
    # FAIL States Transition: NA
    # Description: This state checks the consistency between the images used in the document (links) and the images present in the Links folder. It performs two main checks:
    # 1. Verifies that every image used in the document (as a link) is present in the Links folder.
    #    If an image is missing, it's flagged as an error.
    # 2. Identifies any images in the Links folder that are not used in the document. These are
    #    flagged as warnings since they might be unnecessary and could increase the document's size.
    # ========================================================================================
    def images_included_check(self) -> States:
        # Extract all the link names and their IDs from the spreads.
        # Skipping embedded because they obviously will not be included anyways
        link_name_to_id = {link.get_image_name(): link.get_rectangle_link_id()
                           for spread in self.spreads_parser.get_spreads_obj_list()
                           for link in spread.get_links_obj_list()
                           if link.get_stored_state() != 'Embedded'}

        # Now we need to check master page so we don't get unused image errors.
        # Use None for IDs from masterspreads_parser since link_id is always null.
        master_link_name_to_id = {link.get_image_name(): None
                                  for link in self.masterspreads_parser.get_links_objs()
                                  if link.get_stored_state() != 'Embedded'}

        # Combine all link names and IDs from spreads and master pages
        link_name_to_id.update(master_link_name_to_id)

        # Extract all the image names from the source folder.
        image_names = {image.get_image_name()
                       for image in self.source_folders_parser.get_images_obj_list()}

        # Check for zero-sized images
        for image in self.source_folders_parser.get_images_obj_list():
            if image.get_image_byte_size() == 0:
                image_name = image.get_image_name()
                print(image.get_image_byte_size())
                message = f"Image '{image_name}' has zero size. Likely a corrupted image."

                self.results.add_custom_error(
                message, ValidationError.ERROR)

        # Check if all link names are found in the image names.
        missing_images = set(link_name_to_id.keys()) - image_names
        if missing_images:
            for missing_image in missing_images:
                # Use the link ID if it's from spreads, None if from master spreads
                missing_link_id = link_name_to_id[missing_image]
                if missing_link_id is None:
                    message = f"Link '{missing_image}' is used but not found in the Links folder (ID: None from master spreads)."
                else:
                    message = f"Link '{missing_image}' (ID: {missing_link_id}) is used but not found in the Links folder."

                self.results.add_error(
                    context=message,
                    error_type=ValidationError.IMAGE_INCLUDED,
                    page=None,
                    # Using the image name for the identifier since link ID is None for master spreads
                    identifier=missing_image,
                    data_id=missing_link_id
                )

        # Check if there are any image names not used in links.
        unused_images = image_names - set(link_name_to_id.keys())
        if unused_images:
            for unused_image in unused_images:
                # Unused images would not have a corresponding link ID in this case
                message = f"Image '{unused_image}' is present in the document but not used."
                self.results.add_warning(
                    context=message,
                    warning_type=ValidationWarning.UNUSED_IMAGE,
                    page=None,
                    identifier=unused_image,
                )

        return States.LARGE_IMAGE_CHECK

    # ========================================================================================
    # State: LARGE_IMAGE_CHECK
    # PASS Next State Transition: EMBEDDED_IMAGE_CHECK
    # FAIL States Transition: NA
    # Description: Checks each image in the source folder to determine if its size exceeds 20MB.
    # If an image is larger than 10MB, a warning is raised.
    # ========================================================================================

    def large_image_check(self) -> States:
        for image in self.source_folders_parser.get_images_obj_list():
            if image.get_image_size() > 10:
                image_name = image.get_image_name()
                data_id = image.get_parent_link_data_id()
                message = f"Image {image_name} is {image.get_image_size()}MB."
                self.results.add_info(
                    context=message,
                    info_type=ValidationInfo.LARGE_IMAGE,
                    page=None,
                    identifier=image_name,
                    data_id=data_id,
                )
        return States.EMBEDDED_IMAGE_CHECK

    # ========================================================================================
    # State: EMBEDDED_IMAGE_CHECK
    # PASS Next State Transition: IMAGE_TRANSFORMATION_CHECK
    # FAIL States Transition: NA
    # Description: Checks each link in the spreads to determine if its stored state is 'Embedded'.
    # If an image is embedded, an error is raised.
    # ========================================================================================
    def embedded_image_check(self) -> States:
        for spread in self.spreads_parser.get_spreads_obj_list():
            page = spread.get_page_name()
            for link in spread.get_links_obj_list():
                if link.get_stored_state() == 'Embedded':
                    link_id = link.get_rectangle_link_id()
                    image_name = link.get_image_name()
                    self.results.add_error(
                        context=None,
                        error_type=ValidationError.EMBEDDED_IMAGE,
                        page=page,
                        identifier=image_name,
                        data_id=link_id
                    )

        return States.IMAGE_TRANSFORMATION_CHECK

    # ========================================================================================
    # State: IMAGE_TRANSFORMATION_CHECK
    # PASS Next State Transition: RESULTS
    # FAIL States Transition: NA
    # Description:
    # This method examines each image link within the document's spreads to identify any transformations applied. It checks for:
    # - Rotations: Determines if the image or its container has been rotated and by how many degrees.
    # - Skews: Identifies any skew transformations applied to the image or its container.
    # - Flips: Checks if the image or its container has been flipped horizontally or vertically.
    # For each detected transformation, an error message (warning for rotation) is generated specifying the type of
    # transformation, the image affected, and the page where the image is located.
    # ========================================================================================
    def image_transformation_check(self) -> States:
        for spread in self.spreads_parser.get_spreads_obj_list():
            for link in spread.get_links_obj_list():
                item_transform = link.get_item_transform()
                container_transform = link.get_container_item_transform()
                file_name = link.get_image_name()
                page_name = spread.get_page_name()
                rectangle_id = link.get_rectangle_link_id()
                for idx, asset in enumerate([item_transform, container_transform]):
                    if asset:
                        a, b, c, d, e, f = map(float, asset.split())
                        context = "Image inside Container" if idx == 0 else "Image Container"
                        # Check for rotation
                        rotation_angle = math.atan2(b, a)
                        rotation_angle_degrees = math.degrees(rotation_angle)
                        # Check for horizontal flip
                        if a < 0 and d > 0 and abs(rotation_angle_degrees) != 180:
                            message = f"{context} has a horizontal flip transformation."
                            self.results.add_error(
                                context=message,
                                error_type=ValidationError.IMAGE_TRANSFORMATION,
                                page=page_name,
                                identifier=file_name,
                                data_id=rectangle_id
                            )
                        # Check for vertical flip
                        elif a > 0 and d < 0 and abs(rotation_angle_degrees) != 180:
                            message = f"{context} has a vertical flip transformation."
                            self.results.add_error(
                                context=message,
                                error_type=ValidationError.IMAGE_TRANSFORMATION,
                                page=page_name,
                                identifier=file_name,
                                data_id=rectangle_id
                            )
                        # Warning for only rotation and only flip
                        elif abs(rotation_angle_degrees) > 0.01:
                            message = f"{context} has been rotated by {rotation_angle_degrees:.2f} degrees."
                            self.results.add_warning(
                                context=message,
                                warning_type=ValidationWarning.IMAGE_TRANSFORMATION,
                                page=page_name,
                                identifier=file_name,
                                data_id=rectangle_id
                            )
                        # Check for skews
                            # or not is_rectangle
                        elif abs(b) > .01 or abs(c) > .01:
                            message = f"{context} has skew transformations. Skew factors: b={b}, c={c}"
                            self.results.add_error(
                                context=message,
                                error_type=ValidationError.IMAGE_TRANSFORMATION,
                                page=page_name,
                                identifier=file_name,
                                data_id=rectangle_id
                            )

        return States.TABLE_CHECK

    # ========================================================================================
    # State: TABLE_CHECK
    # PASS Next State Transition: PASTED_GRAPHICS_CHECK
    # FAIL States Transition: NA
    # Description: Checks every story for a table element
    # ========================================================================================
    def table_check(self) -> States:
        if not self.stories_exist:
            return States.PASTED_GRAPHICS_CHECK
        for story in self.stories_parser.get_stories_data():
            for char_style in story.get_character_styles():
                if char_style.has_table():
                    data_id = story.get_parent_text_frame_id()
                    story_id = story.get_story_id()
                    page_name = story.get_page()
                    self.results.add_error(
                        context=None,
                        error_type=ValidationError.TABLE,
                        page=page_name,
                        identifier=story_id,
                        data_id=data_id
                    )

        return States.PASTED_GRAPHICS_CHECK

    # ========================================================================================
    # State: PASTED_GRAPHICS_CHECK
    # PASS Next State Transition: BLEED_CHECK
    # FAIL States Transition: NA
    # Description: Checks for pasted graphics, by iterating through each spread. We can then
    # check the num_pasted_graphics from spreads_parser.
    # ========================================================================================
    def pasted_graphics_check(self) -> States:
        for spread in self.spreads_parser.get_spreads_obj_list():
            num_pasted_graphics = spread.get_pasted_graphics_num()
            if num_pasted_graphics > 0:
                for _ in range(num_pasted_graphics):
                    page = spread.get_page_name()
                    message = f"{spread.get_pasted_graphics_num()} pasted graphics found."
                    self.results.add_error(
                        context=message,
                        error_type=ValidationError.PASTED_GRAPHICS,
                        page=page,
                        identifier=None
                    )
                    break

        return States.DOCUMENT_BLEED_CHECK

    # ========================================================================================
    # State: BLEED_CHECK
    # PASS Next State Transition: AUTO_SIZE_TEXT_BOX_CHECK
    # FAIL States Transition: NA
    # Description: If document bleed is not '0' then error.
    # ========================================================================================
    def document_bleed_check(self) -> States:
        bleed_values = self.preferences_parser.get_document_bleed()
        print(bleed_values)
        if bleed_values is not None:
            for _, value in bleed_values.items():
                if value != '0':
                    bleed_descriptions = ', '.join(
                        f"{k}: {v}pt" for k, v in bleed_values.items())
                    message = f"{bleed_descriptions}."
                    self.results.add_warning(
                        context=message,
                        warning_type=ValidationWarning.DOCUMENT_BLEED,
                        page=None,
                        identifier=None
                    )
                    # Only need one warning
                    break

        return States.AUTO_SIZE_TEXT_BOX_CHECK

    # ========================================================================================
    # State: AUTO_SIZE_TEXT_BOX_CHECK
    # PASS Next State Transition: TEXT_COLUMNS_CHECK
    # FAIL States Transition: NA
    # Description: This check verifies that text frames within the document are not set
    # to auto-size from an unsupported reference point. The function iterates through each
    # text frame in each spread of the document. It checks the auto-sizing type of the text
    # frame and ensures that:
    # - If auto-sizing is set to 'HeightOnly', the reference point is not centered.
    # - If auto-sizing is set to 'WidthOnly', the 'No Line Breaks' option must be enabled, and
    #   the reference point cannot be centered.
    # - If auto-sizing is set to 'HeightAndWidth', the 'No Line Breaks' option must be enabled,
    #   and the sizing must be referenced from one of the corners.
    # ========================================================================================
    def auto_size_text_box_check(self) -> States:
        if not self.stories_exist:
            return States.TEXT_COLUMNS_CHECK
        for spread in self.spreads_parser.get_spreads_obj_list():
            for text_frame in spread.get_text_frame_obj_list():
                if text_frame.get_is_auto_size():
                    # Verify not auto sizing from center
                    story = text_frame.get_parent_story_obj()
                    story_page = story.get_page()
                    story_id = story.get_story_id()
                    data_id = text_frame.get_frame_id()
                    use_line_breaks = text_frame.get_use_no_line_breaks()
                    if text_frame.get_auto_sizing_type() == 'HeightOnly':
                        if text_frame.get_auto_sizing_reference_point() not in ['TopCenterPoint', 'BottomCenterPoint']:
                            message = "HeightOnly cannot autosize from center."
                            self.results.add_error(
                                context=message,
                                error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                                page=story_page,
                                identifier=story_id,
                                data_id=data_id
                            )
                    elif text_frame.get_auto_sizing_type() == 'WidthOnly':
                        if not use_line_breaks or use_line_breaks == 'false':
                            message = "'No Line Breaks' must be checked."
                            self.results.add_error(
                                message, ValidationError.AUTO_SIZE_TEXT_BOX, story_page, story_id)
                            # InDesign has weird behavior, and changes the reference point if 'No Line Breaks' is not checked. So we will just break here.
                            continue
                        if text_frame.get_auto_sizing_reference_point() not in ['LeftCenterPoint', 'RightCenterPoint']:
                            message = "WidthOnly cannot autosize from center."
                            self.results.add_error(
                                context=message,
                                error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                                page=story_page,
                                identifier=story_id,
                                data_id=data_id
                            )
                    elif text_frame.get_auto_sizing_type() == 'HeightAndWidth':
                        if not use_line_breaks or use_line_breaks == 'false':
                            message = "'No Line Breaks' must be checked."
                            self.results.add_error(
                                context=message,
                                error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                                page=story_page,
                                identifier=story_id,
                                data_id=data_id
                            )
                            # InDesign has weird behavior, and changes the reference point if 'No Line Breaks' is not checked. So we will just break here.
                            continue
                        if text_frame.get_auto_sizing_reference_point() not in ['TopLeftPoint', 'BottomLeftPoint', 'BottomRightPoint', 'TopRightPoint']:
                            message = "HeightAndWidth must auto size from corners."
                            self.results.add_error(
                                context=message,
                                error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                                page=story_page,
                                identifier=story_id,
                                data_id=data_id)
                    else:
                        message = "Only width, height, and WidthAndHeight are supported."
                        self.results.add_error(
                            context=message,
                            error_type=ValidationError.AUTO_SIZE_TEXT_BOX,
                            page=story_page,
                            identifier=story_id,
                            data_id=data_id
                        )

        return States.TEXT_COLUMNS_CHECK

    # ========================================================================================
    # State: TEXT_COLUMNS_CHECK
    # PASS Next State Transition: TEXT_WRAP_CHECK
    # FAIL States Transition: NA
    # Description: Iterate through each spread, then each text frame. If the text_frames column
    # count is larger than '1' (string) then error.
    # ========================================================================================
    def text_columns_check(self) -> States:
        if not self.stories_exist:
            return States.LINKED_TEXT_FRAME_CHECK

        # Just checking columns, not fixed width column settings
        for spread in self.spreads_parser.get_spreads_obj_list():
            for text_frame in spread.get_text_frame_obj_list():
                if text_frame.get_text_column_count() and text_frame.get_text_column_count() != '1':
                    story = text_frame.get_parent_story_obj()
                    story_id = story.get_story_id()
                    story_page = story.get_page()
                    data_id = text_frame.get_frame_id()
                    self.results.add_error(
                        context=None,
                        error_type=ValidationError.TEXT_COLUMNS,
                        page=story_page,
                        identifier=story_id,
                        data_id=data_id
                    )

        return States.TEXT_WRAP_CHECK

    # ========================================================================================
    # State: TEXT_WRAP_CHECK
    # PASS Next State Transition: LINKED_TEXT_FRAME_CHECK
    # FAIL States Transition: NA
    # Description: Iterate through each spread, then each text frame. If the text_frames wrap
    # mode is not 'None' error
    # ========================================================================================
    def text_wrap_check(self) -> States:
        if not self.stories_exist:
            return States.LINKED_TEXT_FRAME_CHECK

        for spread in self.spreads_parser.get_spreads_obj_list():
            for text_frame in spread.get_text_frame_obj_list():
                text_wrap_mode = text_frame.get_text_wrap_mode()
                if text_wrap_mode != 'None':
                    story = text_frame.get_parent_story_obj()
                    story_id = story.get_story_id()
                    story_page = story.get_page()
                    data_id = text_frame.get_frame_id()
                    message = f"Text box wrap is '{text_wrap_mode}' not None."
                    self.results.add_error(
                        context=message,
                        error_type=ValidationError.TEXT_WRAP,
                        page=story_page,
                        identifier=story_id,
                        data_id=data_id
                    )

        return States.LINKED_TEXT_FRAME_CHECK

    # ========================================================================================
    # State: LINKED_TEXT_FRAME_CHECK
    # PASS Next State Transition: OBJECT_STYLE_CHECK
    # FAIL States Transition: NA
    # Description: Iterate through each spread, then each text frame. Check
    # get_is_linked_text_frame(). If true then error.
    # ========================================================================================
    def linked_text_frame_check(self) -> States:
        if not self.stories_exist:
            return States.OBJECT_STYLE_CHECK

        for spread in self.spreads_parser.get_spreads_obj_list():
            for text_frame in spread.get_text_frame_obj_list():
                if text_frame.get_is_linked_text_frame():
                    story = text_frame.get_parent_story_obj()
                    # frame_id = text_frame.get_frame_id() TO DO
                    story_id = story.get_story_id()
                    story_content = story.get_story_text_content()
                    story_page = story.get_page()
                    data_id = text_frame.get_frame_id()
                    self.results.add_error(
                        context=None,
                        error_type=ValidationError.LINKED_TEXT_FRAME,
                        page=story_page,
                        identifier=story_id,
                        data_id=data_id
                    )

        return States.OBJECT_STYLE_CHECK

    # ========================================================================================
    # State: OBJECT_STYLE_CHECK
    # PASS Next State Transition: GRID_ALIGNMENT_CHECK
    # FAIL States Transition: NA
    # Description: Iterate through each spread, then each text frame. Check if the object style
    # is a default object style found in default_object_styles.
    # Do the same for all link objects.
    # ========================================================================================
    def object_style_check(self) -> States:
        # ONLY CHECKS TEXT FRAMES AND IMAGES

        # Check Text Frames
        for spread in self.spreads_parser.get_spreads_obj_list():
            for text_frame in spread.get_text_frame_obj_list():
                if text_frame.get_applied_object_style() not in self.default_object_styles:
                    story = text_frame.get_parent_story_obj()
                    story_page = story.get_page()
                    data_id = text_frame.get_frame_id()
                    self.results.add_error(
                        context=None,
                        error_type=ValidationError.OBJECT_STYLE_TEXT,
                        page=story_page,
                        identifier=None,
                        data_id=data_id
                    )

        for spread in self.spreads_parser.get_spreads_obj_list():
            page = spread.get_page_name()
            for link in spread.get_links_obj_list():
                rectangle_id = link.get_rectangle_link_id()
                if link.get_image_object_style() not in self.default_object_styles:
                    image_name = link.get_image_name()
                    self.results.add_error(
                        context=None,
                        error_type=ValidationError.OBJECT_STYLE_IMAGE,
                        page=page,
                        identifier=image_name,
                        data_id=rectangle_id
                    )
                if link.get_container_object_style() not in self.default_object_styles:
                    image_name = link.get_image_name()
                    self.results.add_error(
                        context=None,
                        error_type=ValidationError.OBJECT_STYLE_IMAGE,
                        page=page,
                        identifier=image_name,
                        data_id=rectangle_id
                    )

        return States.GRID_ALIGNMENT_CHECK

    # ========================================================================================
    # State: GRID_ALIGNMENT_CHECK
    # PASS Next State Transition: COMPOSER_CHECK
    # FAIL States Transition: NA
    # Description: Iterate through each story, then each USED paragraph style. If
    # get_grid_alignment() is not 'None' then throw an error.
    # ========================================================================================
    def grid_alignment_check(self) -> States:
        if not self.stories_exist:
            return States.COMPOSER_CHECK
        styles_with_errors = set()  # Only throw 1 error for a paragraph style
        for story in self.stories_parser.get_stories_data():
            for par_style in story.get_paragraph_styles():
                grid_alignment = par_style.get_grid_alignment()
                normalized_style_id = par_style.get_normalized_style_id()
                if grid_alignment != 'None' and normalized_style_id not in styles_with_errors:
                    styles_with_errors.add(normalized_style_id)
                    data_id = story.get_parent_text_frame_id()
                    # Format message with inheritance
                    par_style_grid_align_obj = par_style.get_grid_alignment_obj()
                    inherited_from = par_style_grid_align_obj.get_inherited_from_value()
                    inherited_message = f'Inherited from: {inherited_from}' if inherited_from else ''

                    self.results.add_error(
                        context=inherited_message,
                        error_type=ValidationError.GRID_ALIGNMENT,
                        page=None,
                        identifier=normalized_style_id,
                        data_id=data_id
                    )

        return States.COMPOSER_CHECK

    # ========================================================================================
    # State: COMPOSER_CHECK
    # PASS Next State Transition: OTHER_CHECKS
    # FAIL States Transition: NA
    # Description: Iterate through each story, then each USED paragraph style. If
    # get_composer() is not 'HL Single' then throw an error.
    # ========================================================================================
    def composer_check(self) -> States:
        if not self.stories_exist:
            return States.OTHER_CHECKS
        styles_with_errors = set()  # Only throw 1 error for a paragraph style
        for story in self.stories_parser.get_stories_data():
            for par_style in story.get_paragraph_styles():
                composer = par_style.get_composer()
                normalized_style_id = par_style.get_normalized_style_id()
                if composer != 'HL Single' and normalized_style_id not in styles_with_errors:
                    styles_with_errors.add(normalized_style_id)
                    data_id = story.get_parent_text_frame_id()
                    # Format message with inheritance
                    par_style_composer_obj = par_style.get_composer_obj()
                    inherited_from = par_style_composer_obj.get_inherited_from_value()
                    inherited_message = f'Inherited from: {inherited_from}' if inherited_from else ''

                    self.results.add_warning(
                        context=inherited_message,
                        warning_type=ValidationWarning.COMPOSER,
                        page=None,
                        identifier=normalized_style_id,
                        data_id=data_id
                    )

        return States.OTHER_CHECKS
    
    # ========================================================================================
    # State: OTHER_CHECKS
    # ========================================================================================
    def other_checks(self) -> States:

        # FILLTINT CHECK
        
        if not self.stories_exist:
            return States.RESULTS
        styles_with_errors = set()  # Only throw 1 error for a paragraph style
        for story in self.stories_parser.get_stories_data():
            for par_style in story.get_paragraph_styles():
                filltint = par_style.get_filltint()
                filltintobj = par_style.get_filltint_obj()
                print(filltintobj)
                normalized_style_id = par_style.get_normalized_style_id()
                if filltint not in [None, '-1', '100'] and normalized_style_id not in styles_with_errors:
                    styles_with_errors.add(normalized_style_id)
                    data_id = story.get_parent_text_frame_id()
                    # Format message with inheritance
                    par_style_filltint_obj = par_style.get_filltint_obj()
                    inherited_from = par_style_filltint_obj.get_inherited_from_value()
                    inherited_message = f'Fill Tint is: {filltint}'
                    if inherited_from:
                        inherited_message += f'; Inherited from: {inherited_from}'

                    self.results.add_error(
                        context=inherited_message,
                        error_type=ValidationError.FILL_TINT,
                        page=None,
                        identifier=normalized_style_id,
                        data_id=data_id
                    )

        return States.RESULTS

    def results_analytics(self) -> States:

        if (self.stories_exist):
            # -----Par Styles-----
            par_styles_count = self.calculate_style_total_count('paragraph')
            self.results.set_par_styles_total_count(par_styles_count)
            # -----Char Styles-----
            char_styles_count = self.calculate_style_total_count('character')
            self.results.set_char_styles_total_count(char_styles_count)
            # -----Text Box-----
            text_box_count = self.stories_parser.get_stories_length()
            self.results.set_text_box_total_count(text_box_count)
            self.results.set_stories_parser(self.stories_parser)
        else:
            self.results.set_stories_parser(None)

        # -----Fonts-----
        fonts_count = self.fonts_parser.get_used_font_families_count()
        fonts_count += len(self.source_folders_parser.get_document_fonts())
        self.results.set_fonts_total_count(fonts_count)

        # -----Images-----
        images_count = 0
        spreads = self.spreads_parser.get_spreads_obj_list()
        for spread in spreads:
            images_count += len(spread.get_links_obj_list())
            images_count += spread.get_pasted_graphics_num()
        self.results.set_images_total_count(images_count)

        return States.EXIT

    # ========================================================================================
    # Helper methods
    # ========================================================================================
    def calculate_style_total_count(self, style_type='paragraph'):
        """Fetch all styles from documents and count unique instances."""
        unique_styles = set()
        stories_data = self.stories_parser.get_stories_data()

        if style_type == 'paragraph':
            for story in stories_data:
                par_styles = story.get_paragraph_styles()
                for style in par_styles:
                    style_id = style.get_normalized_style_id()
                    unique_styles.add(style_id)
        elif style_type == 'character':
            for story in stories_data:
                char_styles = story.get_character_styles()
                for style in char_styles:
                    style_id = style.get_normalized_style_id()
                    unique_styles.add(style_id)

        return len(unique_styles)

    def set_current_state(self, state: 'States'):
        self.current_state = state

    def get_errors(self) -> List['Error']:
        return self.results.get_errors()

    def get_warnings(self) -> List['Warning']:
        return self.results.get_warnings()

    def get_infos(self) -> List['Info']:
        return self.results.get_infos()

    def get_error_types(self) -> List['ValidationError']:
        return self.results.get_error_types()

    def get_warning_types(self) -> List['ValidationWarning']:
        return self.results.get_warning_types()

    def get_info_types(self) -> List['ValidationInfo']:
        return self.results.get_info_types()

    def set_source_file_path(self, source_path: str):
        self.source_file_path = source_path

    def get_template_name(self):
        return self.template_name

    def get_unarchived_idml_path(self):
        return self.idml_output_folder

    def delete_unzipped_root_path(self):
        try:
            # Check if the path exists and is a directory
            if os.path.isdir(self.unzipped_root_path):
                # Delete the directory and all its contents
                shutil.rmtree(self.unzipped_root_path)
                return True
            else:
                return False, "Path does not exist or is not a directory."
        except Exception as e:
            # Return False and the error message if something goes wrong
            return False, f"An error occurred: {str(e)}"

    def zip_idml_output_folder(self):
        try:
            zip_file_name = "xml_output.zip"
            zip_file_path = os.path.join(os.path.dirname(
                self.unzipped_folder_path), zip_file_name)

            # Ensure the output folder exists
            if not os.path.exists(self.idml_output_folder):
                raise FileNotFoundError(
                    f"IDML output folder does not exist: {self.idml_output_folder}")

            # Create a zip file containing all the files in the specified folder
            shutil.make_archive(zip_file_path.replace(
                '.zip', ''), 'zip', self.idml_output_folder)

            # Verify the ZIP file is created
            if not os.path.isfile(zip_file_path):
                raise FileNotFoundError(
                    f"ZIP file was not created: {zip_file_path}")

            # Return the path to the created zip file
            return zip_file_path
        except Exception as e:
            # Log the error
            return None
