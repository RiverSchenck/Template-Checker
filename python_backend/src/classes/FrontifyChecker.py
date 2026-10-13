import logging
import os
import shutil
import tempfile
import uuid
import zipfile
from typing import Callable, Dict, List, Optional, Tuple
from src.results.results import ValidationResult
from src.results.classifiers import Severity, ValidationError, ValidationWarning
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

logger = logging.getLogger(__name__)

# Each check unzips into its own folder here; FrontifyChecker.delete_unzipped_root_path removes it.
DATA_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'data')


class FrontifyChecker:
    """Checks one uploaded template package: unzip it, parse the IDML, run every check (src/checks), count
    totals. Results collect in self.results; app/ calls run_state_machine() and reads them."""
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
        # XML Data
        self.stories_parser: StoriesParser = None
        self.masterspreads_parser: MasterPageParser = None
        self.fonts_parser: FontsParser = None
        self.spreads_parser: SpreadsParser = None
        self.source_folders_parser: SourceFoldersParser = None
        self.preferences_parser: PreferencesParser = None
        self.stories_exist: bool = True
        self.metadata_xml_path: bool = False
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

    def get_zip_state(self) -> bool:
        """The upload must be a .zip; otherwise report it."""
        if self.source_file_path and self.source_file_path.endswith('.zip'):
            self.template_name = os.path.basename(self.source_file_path)
            return True
        else:
            self.results.add(ValidationError.ZIP, "File uploaded is not ZIP")
            return False

    def unzip_package_state(self) -> States:
        """UNZIP_PACKAGE: check it's a zip, make this run's folder, extract what the checks read."""
        self.results.template_name = os.path.basename(self.source_file_path)
        self.data_folder = DATA_FOLDER
        if not self.get_zip_state():
            return States.EXIT

        if not self.cleanup_data_folder():
            return States.EXIT

        if not self.extract_zip_to_data_folder():
            return States.EXIT

        return States.UNZIP_IDML

    def cleanup_data_folder(self) -> bool:
        """Create this run's own folder (unzipped_root_path) inside the data folder."""
        try:
            os.makedirs(self.data_folder, exist_ok=True)
            self.unzipped_root_path = os.path.join(self.data_folder, str(uuid.uuid4()))
            os.makedirs(self.unzipped_root_path)
            return True
        except Exception:
            logger.exception("Couldn't create the folder for this upload")
            self.results.add(ValidationError.ERROR, "The server couldn't prepare the upload. Try again.")
            return False

    def extract_zip_to_data_folder(self) -> bool:
        """Validate the package from the zip's directory, then extract only what the checks read (.idml,
        Document Fonts, package PDF). Links are listed, not extracted. A missing or duplicate .idml is
        reported by UNZIP_IDML."""
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
            self.results.add(ValidationError.ERROR, str(e))
            return False
        except zipfile.BadZipFile:
            self.results.add(ValidationError.ERROR,
                             "The file is not a valid ZIP archive. Please zip the package folder again and re-upload.")
            return False
        except Exception:
            logger.exception('Failed to unzip the package')
            self.results.add(ValidationError.ERROR, "Failed to unzip the file.")
            return False
        return True

    def unzip_idml_state(self) -> States:
        """UNZIP_IDML: report a missing or duplicate .idml, otherwise unpack it."""
        if self.idml_problem or not self.idml_path:
            self.results.add(ValidationError.IDML, self.idml_problem or NoIdmlError().args[0])
            return States.EXIT
        if not self.unarchive_idml_files(self.idml_path):
            return States.EXIT
        return States.PARSE_XML

    def unarchive_idml_files(self, idml_path: str) -> bool:
        """Unpack the .idml (a zip of XML files) into 'Source XML'; report and return False if it can't be."""
        self.idml_output_folder = os.path.join(
            self.unzipped_root_path, 'Source XML')
        os.makedirs(self.idml_output_folder, exist_ok=True)
        try:
            extract_idml(idml_path, self.idml_output_folder)
            self.results.idml_output_folder = self.idml_output_folder
            return True
        except PackageError as e:
            self.results.add(ValidationError.ERROR, str(e))
            return False
        except Exception:
            logger.exception('Failed to unzip the .idml')
            self.results.add(ValidationError.ERROR, "Failed to unzip the .idml file.")
            return False

    def parse_xml(self) -> States:
        """PARSE_XML: read the IDML's XML (spreads, fonts, styles, stories, masters, preferences) into
        self.document. Returns the first check's state, or EXIT if a required file is missing."""
        # Source Folders (Links, Document Fonts)
        # Init: SourceFoldersParser
        # Check if 'Document Fonts' exists, if not create it to continue code flow
        document_fonts_folder_path = self.ensure_folder_exists(
            self.unzipped_folder_path, 'Document Fonts')
        self.source_folders_parser = SourceFoldersParser(
            self.package_links, document_fonts_folder_path)

        # Spreads XML
        # Init: SpreadsParser
        # Check if Spreads directory exists
        spreads_dir = os.path.join(
            self.idml_output_folder, 'Spreads')
        if not os.path.exists(spreads_dir):
            self.results.add(ValidationError.ERROR, "Spreads directory does not exist")
            return States.EXIT

        self.spreads_parser = SpreadsParser(
            spreads_dir)
        # Set spreads_parser in results to build spread-to-page mapping
        self.results.set_spreads_parser(self.spreads_parser)
        # Fonts.XML
        # Init: FontsParser
        # Check if Fonts.XML exists
        fonts_xml_path = os.path.join(
            self.idml_output_folder, 'Resources', 'Fonts.xml')
        if not os.path.exists(fonts_xml_path):
            self.results.add(ValidationError.ERROR, "Fonts.XML does not exist")
            return States.EXIT
        self.fonts_parser = FontsParser(
            fonts_xml_path)
        # Styles.XML
        # Init: StylesParser
        # Check if Styles.xml exists
        styles_xml_path = os.path.join(
            self.idml_output_folder, 'Resources', 'Styles.xml')
        if not os.path.exists(styles_xml_path):
            self.results.add(ValidationError.ERROR, "Styles.xml file does not exist")
            return States.EXIT
        # Initialize the StylesParser
        styles_parser = StylesParser(styles_xml_path)

        # Stories XML
        # Init: StoriesParser
        # Check if Stories directory exists
        stories_dir = os.path.join(self.idml_output_folder, 'Stories')
        if not os.path.exists(stories_dir):
            self.stories_exist = False
            # Set stories_parser to None in ValidationResult
            self.results.stories_parser = None
        else:
            # Initialize the StoriesParser and extract story data
            self.stories_parser = StoriesParser(
                stories_dir, styles_parser, self.fonts_parser, self.spreads_parser)
            # Set stories_parser in ValidationResult so it's available when adding validations
            self.results.stories_parser = self.stories_parser

        # Map stories to text frames
        if self.stories_parser:
            for spread in self.spreads_parser.spreads_obj_list:
                for text_frame in spread.text_frame_obj_list:
                    # Use dictionary lookup for O(1) performance instead of O(n) search
                    story = self.stories_parser.stories_dict.get(
                        text_frame.parent_story_id)
                    if story:
                        text_frame.parent_story_obj = story
                        story.parent_text_frame_id = text_frame.frame_id
        # Map source images to links
        link_dict = {}
        for spread in self.spreads_parser.spreads_obj_list:
            for link in spread.links_obj_list:
                link_name = link.link_name
                link_dict[link_name] = link

        for image in self.source_folders_parser.images_obj_list:
            if image.get_image_name() in link_dict:
                matching_link = link_dict[image.get_image_name()]
                image.parent_link_data_id = matching_link.get_rectangle_link_id()

        # MasterSpreads XML
        # Init: MasterPageParser
        # Check if MasterSpreads directory exists
        masterspreads_dir = os.path.join(
            self.idml_output_folder, 'MasterSpreads')
        if not os.path.exists(masterspreads_dir):
            self.results.add(ValidationWarning.WARNING, "MasterSpreads directory does not exist")
            # No master spreads is valid (only the [None] master); checks see an empty master page.
            self.masterspreads_parser = MasterPageParser(None)
        else:
            self.masterspreads_parser = MasterPageParser(masterspreads_dir)

        # META-INF XML
        # Init: NA
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

        # Preferences XML
        # Init: Preferences Parser
        # Check if Styles.xml exists
        preferences_xml_path = os.path.join(
            self.idml_output_folder, 'Resources', 'Preferences.xml')
        if not os.path.exists(preferences_xml_path):
            self.results.add(ValidationError.ERROR, "Preferences.xml file does not exist")
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
            self.results.page_geometry = page_geometry
            previews = {}
            if self.metadata_xml_path:
                # XMP PageNumber is the 1-based position of the page in the document.
                page_by_index = {str(page['index']): page['page_id']
                                 for page in page_geometry.get_pages()}
                for preview in MetadataParser(self.metadata_xml_path, self.unzipped_root_path).previews_objs_list:
                    page_id = page_by_index.get(str(preview.page))
                    if page_id and preview.base_64:
                        previews[page_id] = ''.join(preview.base_64.split())
            previews.update(self._render_package_pdf_previews(page_geometry))
            self.results.page_previews = previews
        except Exception:
            # Highlighting is a nice-to-have; never fail the check because of it.
            logger.warning('Page highlighting data unavailable', exc_info=True)

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
        except Exception:
            logger.warning('PDF preview rendering skipped', exc_info=True)
            return {}

    def ensure_folder_exists(self, path, folder_name):
        """The folder_name subfolder of path, matched case-insensitively; created if it doesn't exist."""
        folder_names = sorted(f for f in os.listdir(path) if os.path.isdir(os.path.join(path, f)))
        folder_paths = [os.path.join(path, f) for f in folder_names]
        folder_names_lowercase = [f.lower() for f in folder_names]
        target_folder_name_lowercase = folder_name.lower()

        if target_folder_name_lowercase not in folder_names_lowercase:
            # If the folder does not exist (regardless of case), create it
            target_folder_path = os.path.join(path, folder_name)
            os.makedirs(target_folder_path)
            return target_folder_path
        else:
            # If it exists, find the actual path to use it (maintaining the original case)
            actual_folder_index = folder_names_lowercase.index(
                target_folder_name_lowercase)
            return folder_paths[actual_folder_index]

    def results_analytics(self):
        """Totals per category (how many styles, text boxes, fonts and images the document has)."""

        if (self.stories_exist):
            par_styles_count = self.calculate_style_total_count('paragraph')
            self.results.par_styles_count = par_styles_count
            char_styles_count = self.calculate_style_total_count('character')
            self.results.char_styles_count = char_styles_count
            text_box_count = self.stories_parser.get_stories_length()
            self.results.text_box_total_count = text_box_count
            self.results.stories_parser = self.stories_parser
        else:
            self.results.stories_parser = None

        fonts_count = self.fonts_parser.get_used_font_families_count()
        fonts_count += len(self.source_folders_parser.document_fonts)
        self.results.fonts_total_count = fonts_count

        images_count = 0
        spreads = self.spreads_parser.spreads_obj_list
        for spread in spreads:
            images_count += len(spread.links_obj_list)
            images_count += spread.pasted_graphics_num
        self.results.images_total_count = images_count

    def calculate_style_total_count(self, style_type='paragraph'):
        """Fetch all styles from documents and count unique instances."""
        unique_styles = set()
        stories_data = self.stories_parser.stories_data_list

        if style_type == 'paragraph':
            for story in stories_data:
                par_styles = story.paragraph_styles
                for style in par_styles:
                    style_id = style.normalized_style_id
                    unique_styles.add(style_id)
        elif style_type == 'character':
            for story in stories_data:
                char_styles = story.character_styles
                for style in char_styles:
                    style_id = style.normalized_style_id
                    unique_styles.add(style_id)

        return len(unique_styles)

    def get_error_types(self) -> List[str]:
        return self.results.names(Severity.ERROR)

    def get_warning_types(self) -> List[str]:
        return self.results.names(Severity.WARNING)

    def get_info_types(self) -> List[str]:
        return self.results.names(Severity.INFO)

    def set_source_file_path(self, source_path: str):
        self.source_file_path = source_path

    def get_template_name(self):
        return self.template_name

    def delete_unzipped_root_path(self) -> bool:
        """Remove this run's unzip folder. True if it was removed."""
        if not os.path.isdir(self.unzipped_root_path):
            return False
        try:
            shutil.rmtree(self.unzipped_root_path)
            return True
        except OSError:
            logger.warning("Couldn't remove %s", self.unzipped_root_path, exc_info=True)
            return False

    def zip_idml_output_folder(self) -> Optional[str]:
        """Zip the unpacked IDML XML (the "download XML" feature) into the system temp folder, outside this
        run's folder so cleanup can't race the download. Returns the zip's path, or None if it failed."""
        try:
            if not os.path.isdir(self.idml_output_folder):
                raise FileNotFoundError(f"IDML output folder does not exist: {self.idml_output_folder}")
            archive_base = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}_xml_output")
            zip_file_path = shutil.make_archive(archive_base, 'zip', self.idml_output_folder)
            if os.path.getsize(zip_file_path) == 0:
                raise FileNotFoundError(f"ZIP file is empty: {zip_file_path}")
            return zip_file_path
        except Exception:
            logger.exception('Creating the XML zip failed')
            return None
