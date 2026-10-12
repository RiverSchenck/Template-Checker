import zipfile
import os
import uuid
import shutil
import sys
import traceback
from typing import Callable, Dict, List, Optional, Tuple
from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning, ValidationInfo
from src.parsers.SourceFoldersParser import SourceFoldersParser
from src.parsers.SpreadsParser import SpreadsParser
from src.parsers.FontsParser import FontsParser
from src.parsers.MasterPageParser import MasterPageParser
from src.parsers.StylesParser import StylesParser
from src.parsers.StoriesParser import StoriesParser
from src.parsers.PreferencesParser import PreferencesParser
from src.parsers.MetadataParser import MetadataParser
from src.classes.States import States
from src.checks import CHECKS, CHECKS_BY_STATE, Check
from src.document import ParsedDocument
from src.helpers.package_zip import (
    MultipleIdmlError, NoIdmlError, PackageError, extract_idml, extract_package, read_package)
from src.helpers.page_geometry import PageGeometryIndex
from src.helpers.pdf_previews import find_package_pdf, render_pdf_previews


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
        self.idml_path: str = ''
        self.idml_problem: Optional[str] = None
        self.package_links: List[Tuple[str, int]] = []  # (file name, size) in Links/
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
        # Last state run_state_machine ran; RESULTS once every check finished
        self.last_state: Optional[States] = None
        # The parsed template the checks read; built at the end of parse_xml
        self.document: Optional[ParsedDocument] = None
        # The checks, in order (an instance copy, so a test can swap one out)
        self.checks: List[Check] = list(CHECKS)
        # Intake: unzip, unpack the IDML, parse it. Each returns the next state, or EXIT on a bad upload.
        self.states: Dict[States, Callable[[], States]] = {
            States.UNZIP_PACKAGE: self.unzip_package_state,
            States.UNZIP_IDML: self.unzip_idml_state,
            States.PARSE_XML: self.parse_xml,
        }
        # Validation Class
        self.results: ValidationResult = ValidationResult()

    def run_state_machine(self):
        """Unzip and parse the package, then run every check in order and count totals.

        last_state is the step being run, so a caller can tell where a run stopped or crashed; it ends as
        RESULTS when every check ran.
        """
        while self.current_state in self.states:
            self.last_state = self.current_state
            self.current_state = self.states[self.current_state]()
            if self.current_state == States.EXIT:
                return
        if self.document is None:  # intake stopped without parsing (shouldn't happen: every path returns a state)
            return
        for check in self.checks:
            self.last_state = check.state
            self._run(check)
        self.last_state = States.RESULTS
        self.results_analytics()

    def run_check(self, state: States):
        """Run one check on the parsed document (after parse_xml), e.g. from a test."""
        self._run(CHECKS_BY_STATE[state])

    def _run(self, check: Check):
        if check.needs_stories and not self.document.stories_exist:
            return
        check.run(self.document, self.results)

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
                "File uploaded is not ZIP", ValidationError.ZIP, page_id='', identifier='null', data_id='null')
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
        except Exception:
            traceback.print_exc()
            self.results.add_custom_error(
                "The server couldn't prepare the upload. Try again.", ValidationError.ERROR)
            return False

    # ---------------------------------------------------
    # Function: extract_zip_to_data_folder
    # Description: Validates the package from the zip's directory, then
    # extracts only what the checks read (.idml, Document Fonts, package
    # PDF) into the unique folder. Links are listed, not extracted.
    # A missing or duplicate .idml is reported by the UNZIP_IDML state.
    # ---------------------------------------------------
    def extract_zip_to_data_folder(self) -> bool:
        self.idml_path = ''
        self.package_links = []
        self.idml_problem = None
        try:
            with zipfile.ZipFile(self.source_file_path, 'r') as zip_ref:
                try:
                    package = read_package(zip_ref)
                except (NoIdmlError, MultipleIdmlError) as e:
                    self.idml_problem = str(e)
                    self.unzipped_folder_path = self.unzipped_root_path
                    return True
                self.unzipped_folder_path, self.idml_path = extract_package(
                    zip_ref, package, self.unzipped_root_path)
                self.package_links = package.links
        except PackageError as e:
            self.results.add_custom_error(str(e), ValidationError.ERROR)
            return False
        except zipfile.BadZipFile:
            self.results.add_custom_error(
                "The file is not a valid ZIP archive. Please zip the package folder again and re-upload.", ValidationError.ERROR)
            return False
        except Exception:
            traceback.print_exc()
            self.results.add_custom_error(
                "Failed to unzip the file.", ValidationError.ERROR)
            return False
        return True

    # ========================================================================================
    # State: UNZIP_IDML
    # PASS Next State Transition: PARSE_XML
    # FAIL States Transition: RESULTS
    # Description: Reports a missing or duplicate .idml, otherwise unarchives it.
    # ========================================================================================
    def unzip_idml_state(self) -> States:
        if self.idml_problem or not self.idml_path:
            self.results.add_error(
                self.idml_problem or NoIdmlError().args[0], ValidationError.IDML, page_id='', identifier='null', data_id='null')
            return States.EXIT
        if not self.unarchive_idml_files(self.idml_path):
            return States.EXIT
        return States.PARSE_XML

    # ---------------------------------------------------
    # Function: unarchive_idml_files
    # Description: Unarchives the provided .idml file into a designated output folder.
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
            extract_idml(idml_path, self.idml_output_folder)
            self.results.add_idml_output_folder(self.idml_output_folder)
            return True
        except PackageError as e:
            self.results.add_custom_error(str(e), ValidationError.ERROR)
            return False
        except Exception:
            traceback.print_exc()
            self.results.add_custom_error(
                "Failed to unzip the .idml file.", ValidationError.ERROR)
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
        # Check if 'Document Fonts' exists, if not create it to continue code flow
        document_fonts_folder_path = self.ensure_folder_exists(
            self.unzipped_folder_path, 'Document Fonts')
        self.source_folders_parser = SourceFoldersParser(
            self.package_links, document_fonts_folder_path)

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
        # Set spreads_parser in results to build spread-to-page mapping
        self.results.set_spreads_parser(self.spreads_parser)
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
            # Set stories_parser to None in ValidationResult
            self.results.set_stories_parser(None)
        else:
            # Initialize the StoriesParser and extract story data
            self.stories_parser = StoriesParser(
                stories_dir, styles_parser, self.fonts_parser, self.spreads_parser)
            # Set stories_parser in ValidationResult so it's available when adding validations
            self.results.set_stories_parser(self.stories_parser)

        # Map stories to text frames
        if self.stories_parser:
            for spread in self.spreads_parser.spreads_obj_list:
                for text_frame in spread.get_text_frame_obj_list():
                    # Use dictionary lookup for O(1) performance instead of O(n) search
                    story = self.stories_parser.stories_dict.get(
                        text_frame.parent_story_id)
                    if story:
                        text_frame.add_parent_story_obj(story)
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
                "MasterSpreads directory does not exist", ValidationWarning.WARNING, page_id='', identifier='null', data_id='null')
            # No master spreads is valid (only the [None] master); checks see an empty master page.
            self.masterspreads_parser = MasterPageParser(None)
        else:
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

        self._load_page_highlighting_data()

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

        self.document = ParsedDocument(
            spreads_parser=self.spreads_parser,
            stories_parser=self.stories_parser,
            masterspreads_parser=self.masterspreads_parser,
            fonts_parser=self.fonts_parser,
            source_folders_parser=self.source_folders_parser,
            preferences_parser=self.preferences_parser,
        )

        return States.MASTERPAGE_CHECK

    def _load_page_highlighting_data(self):
        """Page geometry and embedded previews let the frontend highlight issues on the page."""
        try:
            page_geometry = PageGeometryIndex(self.idml_output_folder)
            self.results.set_page_geometry(page_geometry)
            previews = {}
            if self.metadata_xml_path:
                # XMP PageNumber is the 1-based position of the page in the document.
                page_by_index = {str(page['index']): page['page_id']
                                 for page in page_geometry.get_pages()}
                for preview in MetadataParser(self.metadata_xml_path, self.unzipped_root_path).previews_objs_list:
                    page_id = page_by_index.get(str(preview.page))
                    if page_id and preview.get_base_64():
                        previews[page_id] = ''.join(preview.get_base_64().split())
            previews.update(self._render_package_pdf_previews(page_geometry))
            self.results.set_page_previews(previews)
        except Exception as e:
            # Highlighting is a nice-to-have; never fail the check because of it.
            print(f"Page highlighting data error: {e}")

    def _render_package_pdf_previews(self, page_geometry) -> dict:
        """Sharp page previews from the package PDF, when it matches the document page for page.

        The thumbnails embedded in the IDML are tiny (about 200px wide), so highlights drawn over them
        look misaligned even when the geometry is exact.
        """
        try:
            pdf_path = find_package_pdf(self.unzipped_folder_path, self.idml_path)
            if not pdf_path:
                return {}
            return render_pdf_previews(pdf_path, page_geometry.get_pages())
        except Exception as e:
            print(f"PDF preview rendering skipped: {e}")
            return {}

    def ensure_folder_exists(self, path, folder_name):
        # Convert all folder names in the unzipped folder path to lowercase and check if the lowercase version of the target folder exists
        folder_names = sorted(f for f in os.listdir(path) if os.path.isdir(os.path.join(path, f)))
        folder_paths = [os.path.join(path, f) for f in folder_names]
        folder_names_lowercase = [f.lower() for f in folder_names]
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

    def results_analytics(self):
        """Totals per category (how many styles, text boxes, fonts and images the document has)."""

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
            import tempfile
            import time
            zip_file_name = "xml_output.zip"

            # Create ZIP in temp directory (outside of unzipped_root_path) to avoid cleanup conflicts
            temp_dir = tempfile.gettempdir()
            zip_file_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{zip_file_name}")

            # Ensure the output folder exists
            if not os.path.exists(self.idml_output_folder):
                raise FileNotFoundError(
                    f"IDML output folder does not exist: {self.idml_output_folder}")

            # Create a zip file containing all the files in the specified folder
            # make_archive creates file with .zip extension automatically
            archive_base = zip_file_path.replace('.zip', '')
            shutil.make_archive(archive_base, 'zip', self.idml_output_folder)

            # Verify the ZIP file is created and has content
            max_retries = 5
            retry_count = 0
            while retry_count < max_retries:
                if os.path.isfile(zip_file_path) and os.path.getsize(zip_file_path) > 0:
                    break
                time.sleep(0.1)  # Small delay to allow file system to catch up
                retry_count += 1

            if not os.path.isfile(zip_file_path):
                raise FileNotFoundError(
                    f"ZIP file was not created: {zip_file_path}")

            if os.path.getsize(zip_file_path) == 0:
                raise FileNotFoundError(
                    f"ZIP file is empty: {zip_file_path}")

            print(f"ZIP created successfully: {zip_file_path}, Size: {os.path.getsize(zip_file_path)} bytes")
            # Return the path to the created zip file
            return zip_file_path
        except Exception as e:
            # Log the error
            print(f"Error creating ZIP file: {e}")
            import traceback
            traceback.print_exc()
            return None
