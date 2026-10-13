"""The analytics migration to results v2 (migrations/011_results_v2.sql, 012_results_v2_finish.sql) rewrites stored
v1 rows with a mapping written out in SQL: it must say what the catalogue says. (The migrations themselves were run
on a local Postgres copy of the schema for PR 5.4; see the PR.)"""
import os
import re
import typing

from app import analytics_api
from src.results import catalogue
from src.results.classifiers import all_classifiers
from src.results.models import SubjectKind
from src.results.serialize import SEVERITY

MIGRATIONS = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'migrations')


def _read(name: str) -> str:
    with open(os.path.join(MIGRATIONS, name), encoding='utf-8') as f:
        return f.read()


def test_every_v1_classifier_maps_to_its_check_and_kind_at_its_severity():
    rows = re.findall(r"\('(\w+)', '(\w+)', '(\w+)', '(\w+)'\)", _read('011_results_v2.sql'))
    expected = [(c.name, SEVERITY[c.severity], *catalogue.V1_KEYS[c.name]) for c in all_classifiers()]
    assert rows == expected


def test_categories_end_as_the_subject_kinds_of_results_v2():
    finish = re.search(r"category IN \(([^)]*)\)", _read('012_results_v2_finish.sql')).group(1)
    assert re.findall(r"'(\w+)'", finish) == list(typing.get_args(SubjectKind))


def test_rotation_warnings_stored_under_transformation_names_stay_retired():
    assert analytics_api.describe_issue('IMAGE_TRANSFORMATION_IMAGE', 'warning') == {
        'label': 'Image Transformation Image', 'message': None, 'help_article': None}
    assert analytics_api.describe_issue('TRANSFORMATION', 'warning')['message'] is None
