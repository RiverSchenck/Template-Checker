import logging
import os
import shutil
from typing import Callable, Dict, List, Optional
from src.results.classifiers import Category, Severity, ValidationError, ValidationWarning
from src.results.layout import DocumentLayout, pages_from_spreads, text_boxes_from_stories
from src.results.results import Results
from src.results.serialize import results_json
from src.checks.stages import States
from src.checks import CHECKS, CHECKS_BY_STATE, Check
from src.model.document import Document, short_style_id
from src.model.load import load_document
from lxml import etree

from src.helpers import safe_xml
from src.helpers.package_zip import DAMAGED_IDML
from src.pipeline.intake import NOT_A_ZIP, Package, Rejected, unpack_idml, unpack_package  # noqa: F401 (NOT_A_ZIP: tests)
from src.pipeline.workspace import Workspace
from src.helpers.pdf_previews import find_package_pdf, render_pdf_previews, xmp_thumbnails

logger = logging.getLogger(__name__)

# Why an upload was rejected, in words for the person who uploaded it (intake's reasons: src/pipeline/intake.py).
IDML_TOO_LARGE = (f"The .idml file is too large to check: a spread is over {safe_xml.MAX_LARGE_FILE_BYTES // 2 ** 20} MB, "
                  "usually because of pasted graphics. Place them as linked images and export the .idml again.")


def incomplete_idml(missing: str) -> str:
    return f"The .idml file is incomplete: it has no {missing}. Please export it again from InDesign."


class FrontifyChecker:
    """Checks one uploaded template package: unzip it, parse the IDML, run every check (src/checks), count
    totals. Results collect in self.results; app/ calls run_state_machine() and reads them."""
    def __init__(self, workspace: Optional[Workspace] = None):
        # Source ZIP
        self.source_file_path: str = ''
        self.template_name: str = ''
        # The run's folder (src/pipeline/workspace.py): given by the app, or made when the run starts
        self.workspace: Optional[Workspace] = workspace
        # Intake (src/pipeline/intake.py)
        self.package: Optional[Package] = None
        self.idml_output_folder: str = ''
        self.metadata_xml_path: bool = False
        self.current_state: States = States.UNZIP_PACKAGE
        # Last state run_state_machine ran; RESULTS once every check finished
        self.last_state: Optional[States] = None
        # The parsed template the checks read; built at the end of parse_xml
        self.document: Optional[Document] = None
        # The checks, in order (an instance copy, so a test can swap one out)
        self.checks: List[Check] = list(CHECKS)
        # Intake: unzip, unpack the IDML, parse it. Each returns the next state, or None on a bad upload.
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
            if self.current_state is None:  # the upload was rejected; the results say why
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

    def unzip_package_state(self) -> Optional[States]:
        """UNZIP_PACKAGE: check it's a zip and extract what the checks read into the run's folder."""
        self.template_name = os.path.basename(self.source_file_path)
        if self.workspace is None:
            self.workspace = Workspace.create()  # a server fault if it fails: it raises
        try:
            self.package = unpack_package(self.source_file_path, self.workspace)
        except Rejected as rejected:
            self.results.add(rejected.classifier, rejected.reason)
            return None
        return States.UNZIP_IDML

    def unzip_idml_state(self) -> Optional[States]:
        """UNZIP_IDML: report a missing or duplicate .idml, otherwise unpack it."""
        try:
            intake = unpack_idml(self.package, self.workspace)
        except Rejected as rejected:
            self.results.add(rejected.classifier, rejected.reason)
            return None
        self.idml_output_folder = self.output_folder = intake.idml_folder
        return States.PARSE_XML

    def parse_xml(self) -> Optional[States]:
        """PARSE_XML: read the IDML's XML (spreads, fonts, styles, stories, masters, preferences) into
        self.document. Returns the first check's state, or None if a required file is missing or the XML is
        damaged (malformed, a DTD, over the size cap)."""
        try:
            return self._parse_xml()
        except safe_xml.TooLargeError:
            self.results.add(ValidationError.ERROR, IDML_TOO_LARGE)
        except (etree.XMLSyntaxError, safe_xml.UnsafeXMLError):
            logger.info('Damaged XML in the .idml', exc_info=True)
            self.results.add(ValidationError.ERROR, DAMAGED_IDML)
        return None

    def _parse_xml(self) -> Optional[States]:
        resources = os.path.join(self.idml_output_folder, 'Resources')
        for missing, path in (("pages (Spreads folder)", os.path.join(self.idml_output_folder, 'Spreads')),
                              ("font list (Resources/Fonts.xml)", os.path.join(resources, 'Fonts.xml')),
                              ("styles (Resources/Styles.xml)", os.path.join(resources, 'Styles.xml'))):
            if not os.path.exists(path):
                self.results.add(ValidationError.ERROR, incomplete_idml(missing))
                return None
        if not os.path.exists(os.path.join(self.idml_output_folder, 'MasterSpreads')):
            # No master spreads is valid (only the [None] master); checks see no master items.
            self.results.add(ValidationWarning.WARNING, "MasterSpreads directory does not exist")
        if not os.path.exists(os.path.join(resources, 'Preferences.xml')):
            self.results.add(ValidationError.ERROR, incomplete_idml("document settings (Resources/Preferences.xml)"))
            return None

        self.document = load_document(self.idml_output_folder, self.package.link_files, self.package.fonts_folder)
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
                for page_number, thumbnail in xmp_thumbnails(self.metadata_xml_path).items():
                    page_id = page_by_index.get(page_number)
                    if page_id:
                        previews[page_id] = thumbnail
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
            pdf_path = find_package_pdf(self.package.folder, self.package.idml_path)
            if not pdf_path:
                return {}
            return render_pdf_previews(pdf_path, page_geometry.get_pages())
        except Exception:
            logger.warning('PDF preview rendering skipped', exc_info=True)
            return {}

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
        self.totals[Category.IMAGES] = len(doc.links()) + sum(1 for _, item in doc.page_items() if item.pasted)

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
        """Remove this run's folder (the unpacked package, and the XML export). True if there was one."""
        if self.workspace is None or not os.path.isdir(self.workspace.path):
            return False
        self.workspace.remove()
        return True

    def zip_idml_output_folder(self) -> Optional[str]:
        """Zip the unpacked IDML XML (the "download XML" feature) into the run's folder. Returns the zip's path,
        or None if it failed. The app sends it before the run's folder is removed."""
        try:
            if not os.path.isdir(self.idml_output_folder):
                raise FileNotFoundError(f"IDML output folder does not exist: {self.idml_output_folder}")
            archive_base = os.path.join(self.workspace.folder('export'), 'xml')
            zip_file_path = shutil.make_archive(archive_base, 'zip', self.idml_output_folder)
            if os.path.getsize(zip_file_path) == 0:
                raise FileNotFoundError(f"ZIP file is empty: {zip_file_path}")
            return zip_file_path
        except Exception:
            logger.exception('Creating the XML zip failed')
            return None
