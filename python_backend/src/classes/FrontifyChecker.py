"""FrontifyChecker: the check run (src/pipeline/run.py) behind the interface the app and the tests have always used.
New code calls the pipeline. This wrapper goes when the per-check tests and their helpers are replaced (plan PR 6.1).
"""
import logging
import os
import shutil
from typing import Dict, List, Optional

from src.checks import CHECKS, CHECKS_BY_STATE, Check
from src.checks.stages import States
from src.helpers.package_zip import DAMAGED_IDML  # noqa: F401 (tests import the rejection reasons from here)
from src.model.document import Document
from src.pipeline.intake import NOT_A_ZIP, Intake, Package, Rejected, unpack_idml, unpack_package  # noqa: F401
from src.pipeline.run import IDML_TOO_LARGE, StageTracker, count_totals, load, run, run_check  # noqa: F401
from src.pipeline.workspace import Workspace
from src.results.classifiers import Category, Severity
from src.results.layout import DocumentLayout
from src.results.results import Results
from src.results.serialize import results_json

logger = logging.getLogger(__name__)


class FrontifyChecker:
    """Checks one uploaded template package. Set the source file, then run_state_machine(); results collect in
    self.results. The app sets workspace (the request's run folder) and previews (whether to render page
    previews) before running."""
    def __init__(self, workspace: Optional[Workspace] = None):
        self.source_file_path: str = ''
        self.template_name: str = ''
        self.workspace: Optional[Workspace] = workspace  # made when the run starts if not given
        self.previews: bool = True
        self.checks: List[Check] = list(CHECKS)  # an instance copy, so a test can swap one out
        self._tracker = StageTracker()
        self.package: Optional[Package] = None
        self.intake: Optional[Intake] = None
        self.document: Optional[Document] = None
        self.results: Results = Results()
        self.layout: DocumentLayout = DocumentLayout()
        self.totals: Dict[Category, int] = {}
        self.output_folder: Optional[str] = None  # the unpacked .idml, once intake got that far

    @property
    def last_state(self) -> Optional[States]:
        """The stage being run, or where the run stopped or crashed; RESULTS when every check ran."""
        return self._tracker.stage

    def run_state_machine(self):
        self.template_name = os.path.basename(self.source_file_path)
        self._tracker.stage = States.UNZIP_PACKAGE  # making the run folder is part of it
        outcome = run(self.source_file_path, self._workspace(), previews=self.previews, checks=self.checks,
                      tracker=self._tracker)
        self.results, self.layout, self.totals = outcome.results, outcome.layout, outcome.totals
        self.document, self.output_folder = outcome.document, outcome.idml_folder

    # --- one stage at a time (testing/checker_setup.py) ---------------------------------------------------------

    def unzip_package_state(self) -> Optional[States]:
        self.template_name = os.path.basename(self.source_file_path)
        self._tracker.stage = States.UNZIP_PACKAGE
        try:
            self.package = unpack_package(self.source_file_path, self._workspace())
        except Rejected as rejected:
            self.results.add(rejected.classifier, rejected.reason)
            return None
        return States.UNZIP_IDML

    def unzip_idml_state(self) -> Optional[States]:
        self._tracker.stage = States.UNZIP_IDML
        try:
            self.intake = unpack_idml(self.package, self._workspace())
        except Rejected as rejected:
            self.results.add(rejected.classifier, rejected.reason)
            return None
        self.output_folder = self.intake.idml_folder
        return States.PARSE_XML

    def parse_xml(self) -> Optional[States]:
        self._tracker.stage = States.PARSE_XML
        try:
            loaded = load(self.intake, self.results, previews=self.previews)
        except Rejected as rejected:
            self.results.add(rejected.classifier, rejected.reason)
            return None
        self.document, self.layout = loaded.document, loaded.layout
        return States.MASTERPAGE_CHECK

    def run_check(self, state: States):
        """Run one check on the parsed document (after parse_xml), e.g. from a test."""
        run_check(CHECKS_BY_STATE[state], self.document, self.results)

    def results_analytics(self):
        self.totals = count_totals(self.document)

    # --- results and files ---------------------------------------------------------------------------------------

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
            if not self.output_folder or not os.path.isdir(self.output_folder):
                raise FileNotFoundError(f"IDML output folder does not exist: {self.output_folder}")
            zip_file_path = shutil.make_archive(os.path.join(self.workspace.folder('export'), 'xml'), 'zip',
                                                self.output_folder)
            if os.path.getsize(zip_file_path) == 0:
                raise FileNotFoundError(f"ZIP file is empty: {zip_file_path}")
            return zip_file_path
        except Exception:
            logger.exception('Creating the XML zip failed')
            return None

    def _workspace(self) -> Workspace:
        if self.workspace is None:
            self.workspace = Workspace.create()  # a server fault if it fails: it raises
        return self.workspace
