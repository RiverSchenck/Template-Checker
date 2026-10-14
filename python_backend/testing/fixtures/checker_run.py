"""Run the whole checker on a package and get its issues (results v2) back in an easy-to-assert shape."""
from collections import Counter
from dataclasses import dataclass
from typing import List, Optional

from src.pipeline.run import run
from src.pipeline.workspace import run_workspace


@dataclass
class Issue:
    severity: str            # error / warning / info
    check: str               # e.g. TEXT_COLUMNS
    kind: str                # what it's about: paragraph_style, text_frame, image, page_item, document...
    subject: Optional[str]   # its name (style, font, file), else its id (a frame's Self)
    item_id: Optional[str]
    page_id: Optional[str]
    page_name: Optional[str]
    detail: str
    facts: Optional[dict]


@dataclass
class CheckerRun:
    stopped_at: str
    results: dict
    """Results v2."""
    issues: List[Issue]

    def checks(self) -> Counter:
        return Counter(i.check for i in self.issues)

    def of(self, check: str, kind: Optional[str] = None) -> List[Issue]:
        """The issues of a check (about this kind of thing, if given)."""
        return [i for i in self.issues if i.check == check and kind in (None, i.kind)]

    def text_of(self, subject_id: str) -> Optional[str]:
        """The text of a text frame an issue is about."""
        box = self.results['text_boxes'].get(subject_id)
        return box['content'] if box else None


def run_checker(package_path: str) -> CheckerRun:
    with run_workspace() as workspace:
        outcome = run(package_path, workspace, previews=False)
    results = outcome.json()
    # `detail` is the checker's own message for each issue (results v2 doesn't send it), in the same order.
    issues = [
        Issue(i['severity'], i['check'], i['subject']['kind'], i['subject']['name'] or i['subject']['id'],
              i['location']['item_id'], i['location']['page_id'], i['location']['page_name'], raw.context or '',
              i['facts'])
        for i, raw in zip(results['issues'], outcome.results)
    ]
    return CheckerRun(outcome.stage.name, results, issues)
