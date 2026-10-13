"""A check run, stage by stage: intake (UNZIP_PACKAGE, UNZIP_IDML), load the document (PARSE_XML), each check,
then RESULTS. The stage names are what analytics stores (src/checks/stages.py).

run() returns a RunOutcome for a package that was checked or rejected. Anything else (a server fault, a check that
crashes) raises; the StageTracker passed in says which stage it happened in.
"""
import logging
import os
import shutil
from dataclasses import dataclass, field
from typing import Dict, Iterable, Optional

from lxml import etree

from src.checks import CHECKS, Check
from src.checks.stages import States
from src.helpers import safe_xml
from src.helpers.package_zip import DAMAGED_IDML
from src.model.document import Document, short_style_id
from src.model.load import load_document
from src.pipeline.intake import Intake, Rejected, unpack_idml, unpack_package
from src.pipeline.previews import page_previews
from src.pipeline.workspace import Workspace
from src.results.results import Results
from src.results.serialize import results_v2

logger = logging.getLogger(__name__)

IDML_TOO_LARGE = (f"The .idml file is too large to check: a spread is over {safe_xml.MAX_LARGE_FILE_BYTES // 2 ** 20} MB, "
                  "usually because of pasted graphics. Place them as linked images and export the .idml again.")


def incomplete_idml(missing: str) -> str:
    return f"The .idml file is incomplete: it has no {missing}. Please export it again from InDesign."


@dataclass
class StageTracker:
    """The stage being run; RESULTS once every check ran."""
    stage: Optional[States] = None


@dataclass(frozen=True)
class Loaded:
    document: Document
    previews: Dict[str, str]    # page Self -> base64 JPEG, when asked for


def load(intake: Intake, results: Results, *, previews: bool) -> Loaded:
    """PARSE_XML: the Document for an unpacked package. Rejected when a required file is missing or the XML is
    damaged (malformed, a DTD, over the size cap)."""
    folder = intake.idml_folder
    resources = os.path.join(folder, 'Resources')
    for missing, path in (("pages (Spreads folder)", os.path.join(folder, 'Spreads')),
                          ("font list (Resources/Fonts.xml)", os.path.join(resources, 'Fonts.xml')),
                          ("styles (Resources/Styles.xml)", os.path.join(resources, 'Styles.xml'))):
        if not os.path.exists(path):
            raise Rejected(States.PARSE_XML, 'ERROR', incomplete_idml(missing))
    if not os.path.exists(os.path.join(folder, 'MasterSpreads')):
        # No master spreads is valid (only the [None] master); checks see no master items.
        results.add('WARNING', "MasterSpreads directory does not exist")
    if not os.path.exists(os.path.join(resources, 'Preferences.xml')):
        raise Rejected(States.PARSE_XML, 'ERROR', incomplete_idml("document settings (Resources/Preferences.xml)"))
    try:
        document = load_document(folder, intake.package.link_files, intake.package.fonts_folder)
    except safe_xml.TooLargeError:
        raise Rejected(States.PARSE_XML, 'ERROR', IDML_TOO_LARGE)
    except (etree.XMLSyntaxError, safe_xml.UnsafeXMLError):
        logger.info('Damaged XML in the .idml', exc_info=True)
        raise Rejected(States.PARSE_XML, 'ERROR', DAMAGED_IDML)
    return Loaded(document, page_previews(document, intake) if previews else {})


def run_check(check: Check, document: Document, results: Results) -> None:
    if check.needs_stories and not document.stories_exist:
        return
    check.run(document, results)


def count_totals(document: Document) -> Dict[str, int]:
    """Per kind of subject: how many styles, text frames, fonts and images the document has."""
    totals: Dict[str, int] = {}
    if document.stories_exist:
        totals['paragraph_style'] = len({short_style_id(paragraph.style)
                                         for story in document.stories for paragraph in document.paragraphs(story)})
        totals['character_style'] = len({short_style_id(run.style)
                                         for story in document.stories for _, run in document.runs(story)})
        totals['text_frame'] = len(document.stories)
    totals['font'] = len(document.used_fonts) + len(document.packaged_fonts)
    totals['image'] = len(document.links()) + sum(1 for _, item in document.page_items() if item.pasted)
    return totals


@dataclass(frozen=True)
class RunOutcome:
    template_name: str
    stage: States                           # RESULTS when every check ran, else the stage it was rejected at
    results: Results
    totals: Dict[str, int] = field(default_factory=dict)
    document: Optional[Document] = None
    idml_folder: Optional[str] = None       # the unpacked .idml (for the XML export), once intake got that far
    previews: Dict[str, str] = field(default_factory=dict)  # page Self -> base64 JPEG, when asked for

    @property
    def completed(self) -> bool:
        return self.stage == States.RESULTS

    def json(self) -> dict:
        """Results v2: every issue, with what the frontend needs to show and highlight it."""
        return results_v2(self.results, self.document, template_name=self.template_name, totals=self.totals,
                          previews=self.previews)


def run(zip_path: str, workspace: Workspace, *, previews: bool = True, checks: Iterable[Check] = CHECKS,
        tracker: Optional[StageTracker] = None) -> RunOutcome:
    tracker = tracker if tracker is not None else StageTracker()
    template_name = os.path.basename(zip_path)
    results = Results()
    intake = None
    try:
        tracker.stage = States.UNZIP_PACKAGE
        package = unpack_package(zip_path, workspace)
        tracker.stage = States.UNZIP_IDML
        intake = unpack_idml(package, workspace)
        tracker.stage = States.PARSE_XML
        loaded = load(intake, results, previews=previews)
    except Rejected as rejected:
        results.add(rejected.check, rejected.reason)
        return RunOutcome(template_name, rejected.stage, results, idml_folder=intake.idml_folder if intake else None)
    for check in checks:
        tracker.stage = check.state
        run_check(check, loaded.document, results)
    tracker.stage = States.RESULTS
    return RunOutcome(template_name, States.RESULTS, results, count_totals(loaded.document), loaded.document,
                      intake.idml_folder, loaded.previews)


def zip_idml(idml_folder: Optional[str], workspace: Workspace) -> Optional[str]:
    """The unpacked .idml's XML as a zip in the run's folder (the "download XML" feature): its path, or None if it
    couldn't be made (logged). The app sends it before the run's folder is removed."""
    try:
        if not idml_folder or not os.path.isdir(idml_folder):
            raise FileNotFoundError(f"IDML output folder does not exist: {idml_folder}")
        zip_path = shutil.make_archive(os.path.join(workspace.folder('export'), 'xml'), 'zip', idml_folder)
        if os.path.getsize(zip_path) == 0:
            raise FileNotFoundError(f"ZIP file is empty: {zip_path}")
        return zip_path
    except Exception:
        logger.exception('Creating the XML zip failed')
        return None
