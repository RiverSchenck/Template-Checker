"""src/results/catalogue.py: one entry per check with the only copy of its wording (plan PR 5.1, D2, D3)."""
import collections

from src.results import catalogue
from src.results.classifiers import all_classifiers


def test_every_v1_classifier_has_an_entry_of_its_severity():
    for classifier in all_classifiers():
        entry, kind = catalogue.for_v1(classifier.name)
        assert entry.severity == classifier.severity, classifier.name
        assert kind in entry.subject_kinds, classifier.name


def test_every_check_says_why_and_how_to_fix_it_for_each_kind():
    for entry in catalogue.ENTRIES:
        if entry.is_check:
            assert entry.title and entry.why and entry.help_article, entry.key
            for kind in entry.subject_kinds:
                assert entry.fix_for(kind), (entry.key, kind)


def test_merged_checks_follow_the_plan():
    merged = collections.defaultdict(set)
    for name, (key, _) in catalogue.V1_KEYS.items():
        merged[key].add(name)
    assert {key: names for key, names in merged.items() if len(names) > 1} == {
        'TEXT_WRAP': {'TEXT_WRAP', 'TEXT_WRAP_ITEM'},
        'OBJECT_STYLE': {'OBJECT_STYLE_TEXT', 'OBJECT_STYLE_IMAGE'},
        'TRANSFORMATION': {'IMAGE_TRANSFORMATION_IMAGE', 'IMAGE_TRANSFORMATION_CONTAINER', 'PAGE_ITEM_TRANSFORMATION'},
        'PARAGRAPH_STYLE': {'PARAGRAPH_STYLE', 'PARAGRAPH_STYLE_TEXT_BOX'},
    }
    # Separate fixes, separate checks (KERNING vs KERNING_CHAR, FILL_TINT vs FILL_TINT_CHAR).
    assert catalogue.for_v1('KERNING_CHAR')[0].key == 'KERNING_CHAR'
    assert catalogue.for_v1('FILL_TINT_CHAR')[0].key == 'FILL_TINT_CHAR'


def test_a_merged_check_fixes_each_kind_its_own_way():
    entry = catalogue.BY_KEY['OBJECT_STYLE']
    assert '[Basic Text Frame]' in entry.fix_for('text_frame')[0]
    assert '[Basic Graphics Frame]' in entry.fix_for('image')[0]


def test_split_v1_keys_never_share_a_title_until_results_v2():
    titles = collections.Counter(catalogue.v1_title(c.name) for c in all_classifiers()
                                 if catalogue.for_v1(c.name)[0].is_check)
    # KERNING/KERNING_CHAR, FILL_TINT/FILL_TINT_CHAR and TEXT_WRAP/TEXT_WRAP_ITEM shared their titles already.
    assert {title for title, n in titles.items() if n > 1} == {
        'Kerning isn’t set to Metrics', 'Text color tint isn’t 100%', 'Text wrap applied'}
