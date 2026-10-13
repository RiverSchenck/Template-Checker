"""The analytics migration to results v2 (migrations/011_results_v2.sql, 012_results_v2_finish.sql, both run in
production for PR 5.4): stored categories end as results v2's subject kinds, and retired types stay readable."""
import os
import re
import typing

from app import analytics_api
from src.results.models import SubjectKind

MIGRATIONS = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'migrations')


def _read(name: str) -> str:
    with open(os.path.join(MIGRATIONS, name), encoding='utf-8') as f:
        return f.read()


def test_categories_end_as_the_subject_kinds_of_results_v2():
    finish = re.search(r"category IN \(([^)]*)\)", _read('012_results_v2_finish.sql')).group(1)
    assert re.findall(r"'(\w+)'", finish) == list(typing.get_args(SubjectKind))


def test_rotation_warnings_stored_under_transformation_names_stay_retired():
    assert analytics_api.describe_issue('IMAGE_TRANSFORMATION_IMAGE', 'warning') == {
        'label': 'Image Transformation Image', 'message': None, 'help_article': None}
    assert analytics_api.describe_issue('TRANSFORMATION', 'warning')['message'] is None
