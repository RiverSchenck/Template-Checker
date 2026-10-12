"""Run the whole checker on a package and get its issues back in an easy-to-assert shape."""
import contextlib
import io
from collections import Counter
from dataclasses import dataclass
from typing import List

from src.classes.FrontifyChecker import FrontifyChecker

CATEGORIES = ('par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general')


@dataclass
class Issue:
    severity: str        # errors / warnings / infos
    classifier: str      # e.g. TEXT_COLUMNS
    identifier: str
    data_id: str
    page_id: str
    page_name: str
    context: str


@dataclass
class CheckerRun:
    stopped_at: str
    results: dict
    issues: List[Issue]

    def classifiers(self) -> Counter:
        return Counter(i.classifier for i in self.issues)

    def of(self, classifier: str) -> List[Issue]:
        return [i for i in self.issues if i.classifier == classifier]


def run_checker(package_path: str) -> CheckerRun:
    checker = FrontifyChecker()
    checker.set_source_file_path(package_path)
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            checker.run_state_machine()
        results = checker.results.get_formatted_results_json()
    finally:
        checker.delete_unzipped_root_path()
    issues = [
        Issue(severity, item['validationClassifier'], identifier, item['data_id'], item['page_id'],
              item['page_name'], item['context'])
        for category in CATEGORIES
        for identifier, by_severity in results[category]['details'].items()
        for severity, items in by_severity.items()
        for item in items
    ]
    return CheckerRun(checker.last_state.name if checker.last_state else None, results, issues)
