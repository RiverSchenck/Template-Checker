"""Line the oracle up against the checker's golden results, check by check."""
import functools
from typing import Dict

from testing.golden.golden import load, package_path
from testing.oracle import idml_oracle as oracle

STYLE_PREFIXES = ('ParagraphStyle/$ID/', 'ParagraphStyle/', 'CharacterStyle/$ID/', 'CharacterStyle/')


def _short_style(style_id: str) -> str:
    """'ParagraphStyle/$ID/[No paragraph style]' -> '[No paragraph style]', as the oracle names styles."""
    prefix = next((p for p in STYLE_PREFIXES if style_id.startswith(p)), '')
    return style_id[len(prefix):]


def checker_items(results: dict, check: str, *kinds: str):
    """(style name, issue) for each issue of a check (results v2), about one of these subject kinds if given."""
    for issue in results['issues']:
        subject = issue['subject']
        if issue['check'] == check and (not kinds or subject['kind'] in kinds):
            yield _short_style(subject['id'] or ''), issue


def _inherited(issue: dict) -> str:
    """Where a style setting comes from, as the oracle words it (from the issue's inherited_from fact)."""
    source = (issue['facts'] or {}).get('inherited_from')
    return f'Inherited from: {source}' if source else ''


def _item(issue: dict) -> str:
    return issue['location']['item_id']


# name -> (oracle side, checker side); both produce comparable sets
CHECKS: Dict[str, tuple] = {
    'text_columns': (lambda d: {i[1] for i in oracle.text_columns(d)},
                     lambda r: {_item(i) for _, i in checker_items(r, 'TEXT_COLUMNS')}),
    'text_wrap': (lambda d: {i[1] for i in oracle.text_wrap(d)},
                  lambda r: {_item(i) for _, i in checker_items(r, 'TEXT_WRAP', 'text_frame')}),
    'text_wrap_items': (lambda d: {i[1] for i in oracle.text_wrap_items(d)},
                        lambda r: {_item(i) for _, i in checker_items(r, 'TEXT_WRAP', 'page_item')}),
    'linked_text_frames': (lambda d: {i[1] for i in oracle.linked_text_frames(d)},
                           lambda r: {_item(i) for _, i in checker_items(r, 'LINKED_TEXT_FRAME')}),
    'embedded_images': (lambda d: {i[1] for i in oracle.embedded_images(d)},
                        lambda r: {_item(i) for _, i in checker_items(r, 'EMBEDDED_IMAGE')}),
    'image_transformations': (
        lambda d: oracle.image_transformations(d),
        lambda r: {('image' if i['subject']['kind'] == 'image' else 'container', _item(i), i['facts']['kind'])
                   for _, i in checker_items(r, 'TRANSFORMATION', 'image', 'image_frame')}),
    'document_bleed': (lambda d: len(oracle.document_bleed(d)),
                       lambda r: len(list(checker_items(r, 'DOCUMENT_BLEED')))),
    'paragraph_kerning': (lambda d: {i[0] for i in oracle.paragraph_kerning(d)},
                          lambda r: {style for style, _ in checker_items(r, 'KERNING')}),
    'character_kerning': (lambda d: {i[0] for i in oracle.character_kerning(d)},
                          lambda r: {style for style, _ in checker_items(r, 'KERNING_CHAR')}),
    'composer': (lambda d: {(i[0], i[2]) for i in oracle.composer(d)},
                 lambda r: {(style, _inherited(i)) for style, i in checker_items(r, 'COMPOSER')}),
    'grid_alignment': (lambda d: {(i[0], i[2]) for i in oracle.grid_alignment(d)},
                       lambda r: {(style, _inherited(i)) for style, i in checker_items(r, 'GRID_ALIGNMENT')}),
}


@functools.lru_cache(maxsize=None)
def _idml(package: str):
    return oracle.Idml.from_package(package_path(package))


def compare(package: str, check: str):
    """(expected, actual) for one check on one package, or None when the checker rejected the package."""
    golden = load(package)
    if golden is None or golden['stopped_at'] != 'RESULTS':
        return None
    doc = _idml(package)
    if doc is None:
        return None
    expected_fn, actual_fn = CHECKS[check]
    return expected_fn(doc), actual_fn(golden['results'])
