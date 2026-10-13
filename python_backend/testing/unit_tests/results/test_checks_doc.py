from src.results.catalogue import ENTRIES
from src.results.checks_doc import DOC_PATH, render


def test_committed_checks_doc_is_up_to_date():
    with open(DOC_PATH, encoding='utf-8') as f:
        assert f.read() == render(), 'run: python -m src.results.checks_doc'


def test_every_check_is_listed_with_its_title():
    doc = render()
    for entry in ENTRIES:
        assert f'`{entry.key}`' in doc
        assert entry.title in doc or not entry.is_check
