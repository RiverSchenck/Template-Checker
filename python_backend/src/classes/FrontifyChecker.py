import logging
import os
import shutil
import tempfile
import uuid
import zipfile
from typing import Callable, Dict, List, Optional, Tuple
from src.results.classifiers import Category, Severity, ValidationError, ValidationWarning
from src.results.layout import DocumentLayout, pages_from_spreads, text_boxes_from_stories
from src.results.results import Results
from src.results.serialize import results_json
from src.parsers.MetadataParser import MetadataParser
from src.classes.States import States
from src.checks import CHECKS, CHECKS_BY_STATE, Check
from src.model.document import Document, short_style_id
from src.model.load import load_document
from lxml import etree

from src.helpers import safe_xml
from src.helpers.package_zip import (
    DAMAGED_ARCHIVE_ERRORS, DAMAGED_IDML, MultipleIdmlError, NoIdmlError, PackageError, extract_idml,
    extract_package, read_package)
from src.helpers.pdf_previews import find_package_pdf, render_pdf_previews

logger = logging.getLogger(__name__)

# Why an upload was rejected, in words for the person who uploaded it.
NOT_A_ZIP = "The file is not a valid ZIP archive. Please zip the package folder again and re-upload."
IDML_TOO_LARGE = (f"The .idml file is too large to check: a spread is over {safe_xml.MAX_LARGE_FILE_BYTES // 2 ** 20} MB, "
                  "usually because of pasted graphics. Place them as linked images and export the .idml again.")


def incomplete_idml(missing: str) -> str:
    return f"The .idml file is incomplete: it has no {missing}. Please export it again from InDesign."

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
        self.metadata_xml_path: bool = False
        self.current_state: States = States.UNZIP_PACKAGE
        # Last state run_state_machine ran; RESULTS once every check finished
        self.last_state: Optional[States] = None
        # The parsed template the checks read; built at the end of parse_xml
        self.document: Optional[Document] = None
        # The checks, in order (an instance copy, so a test can swap one out)
        self.checks: List[Check] = list(CHECKS)
        # Intake: unzip, unpack the IDML, parse it. Each returns the next state, or EXIT on a bad upload.
        self.states: Dict[States, Callable[[], States]] = {
            States.UNZIP_PACKAGE: self.unzip_package_state,
            States.UNZIP_IDML: self.unzip_idml_state,
            States.PARSE_XML: self.parse_xml,
        }
        # What the checks found, and what the response needs about the document to show it
        self.results: Results = Results()
        self.layout: DocumentLayout = DocumentLayout()
        self.totals: Dict[Category, int] = {}
        self.output_folder: Optional[str] = None  # set once the IDML is unpacked

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
        if self.source_file_path and self.source_file_path.lower().endswith('.zip'):
            return True
        else:
            self.results.add(ValidationError.ZIP, "File uploaded is not ZIP")
            return False

    def unzip_package_state(self) -> States:
        """UNZIP_PACKAGE: check it's a zip, make this run's folder, extract what the checks read."""
        self.template_name = os.path.basename(self.source_file_path)
        self.data_folder = DATA_FOLDER
        if not self.get_zip_state():
            return States.EXIT

        if not self.cleanup_data_folder():
            return States.EXIT

        if not self.extract_zip_to_data_folder():
            return States.EXIT

        return States.UNZIP_IDML

    def cleanup_data_folder(self) -> bool:
        """Create this run's own folder (unzipped_root_path) inside the data folder. A failure here is the
        server's, not the upload's, so it raises (the run is logged as failed)."""
        os.makedirs(self.data_folder, exist_ok=True)
        self.unzipped_root_path = os.path.join(self.data_folder, str(uuid.uuid4()))
        os.makedirs(self.unzipped_root_path)
        return True

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
        except DAMAGED_ARCHIVE_ERRORS:
            self.results.add(ValidationError.ERROR, NOT_A_ZIP)
            return False
        # Anything else (disk full, permissions...) is a server fault: it raises and the run is logged as failed.
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
            self.output_folder = self.idml_output_folder
            return True
        except PackageError as e:
            self.results.add(ValidationError.ERROR, str(e))
            return False

    def parse_xml(self) -> States:
        """PARSE_XML: read the IDML's XML (spreads, fonts, styles, stories, masters, preferences) into
        self.document. Returns the first check's state, or EXIT if a required file is missing or the XML is
        damaged (malformed, a DTD, over the size cap)."""
        try:
            return self._parse_xml()
        except safe_xml.TooLargeError:
            self.results.add(ValidationError.ERROR, IDML_TOO_LARGE)
        except (etree.XMLSyntaxError, safe_xml.UnsafeXMLError):
            logger.info('Damaged XML in the .idml', exc_info=True)
            self.results.add(ValidationError.ERROR, DAMAGED_IDML)
        return States.EXIT

    def _parse_xml(self) -> States:
        document_fonts_folder_path = self.ensure_folder_exists(self.unzipped_folder_path, 'Document Fonts')
        resources = os.path.join(self.idml_output_folder, 'Resources')
        for missing, path in (("pages (Spreads folder)", os.path.join(self.idml_output_folder, 'Spreads')),
                              ("font list (Resources/Fonts.xml)", os.path.join(resources, 'Fonts.xml')),
                              ("styles (Resources/Styles.xml)", os.path.join(resources, 'Styles.xml'))):
            if not os.path.exists(path):
                self.results.add(ValidationError.ERROR, incomplete_idml(missing))
                return States.EXIT
        if not os.path.exists(os.path.join(self.idml_output_folder, 'MasterSpreads')):
            # No master spreads is valid (only the [None] master); checks see no master items.
            self.results.add(ValidationWarning.WARNING, "MasterSpreads directory does not exist")
        if not os.path.exists(os.path.join(resources, 'Preferences.xml')):
            self.results.add(ValidationError.ERROR, incomplete_idml("document settings (Resources/Preferences.xml)"))
            return States.EXIT

        self.document = load_document(self.idml_output_folder, self.package_links, document_fonts_folder_path)
        self.layout = pages_from_spreads(self.document)
        self.layout.text_boxes = text_boxes_from_stories(self.document)
        metadata = os.path.join(self.idml_output_folder, 'META-INF', 'metadata.xml')
        self.metadata_xml_path = metadata if os.path.exists(metadata) else False
        self._load_page_highlighting_data()
        return States.MASTERPAGE_CHECK

    def _load_page_highlighting_data(self):
        """Page geometry and embedded previews let the frontend highlight issues on the page."""
        try:
            page_geometry = self.document.geometry
            self.layout.geometry = page_geometry
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
            self.layout.previews = previews
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
        """Totals per results section: how many styles, text boxes, fonts and images the document has."""
        doc = self.document
        if doc.stories_exist:
            self.totals[Category.PAR_STYLE] = len({short_style_id(paragraph.style)
                                                   for story in doc.stories for paragraph in doc.paragraphs(story)})
            self.totals[Category.CHAR_STYLE] = len({short_style_id(run.style)
                                                    for story in doc.stories for _, run in doc.runs(story)})
            self.totals[Category.TEXT_BOX] = len(doc.stories)
        self.totals[Category.FONTS] = len(doc.used_fonts) + len(doc.packaged_fonts)
        self.totals[Category.IMAGES] = sum(len(spread.links) + sum(1 for item in spread.items if item.pasted)
                                           for spread in doc.spreads)

    def results_json(self) -> dict:
        """The response: every issue found, with what the frontend needs to show and highlight it."""
        return results_json(self.results, self.layout, template_name=self.template_name,
                            output_folder=self.output_folder, totals=self.totals)

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
