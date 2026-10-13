"""Line the oracle up against the checker's golden results, check by check."""
import functools
from typing import Dict

from testing.golden.golden import TESTING_DIR, load
from testing.oracle import idml_oracle as oracle

CATEGORIES = ('par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general')


def checker_items(results: dict, *classifiers: str):
    for category in CATEGORIES:
        for identifier, by_severity in results[category]['details'].items():
            for severity in ('errors', 'warnings', 'infos'):
                for item in by_severity[severity]:
                    if item['validationClassifier'] in classifiers:
                        yield identifier, item


def _transform_kind(context: str) -> str:
    if 'flip' in context:
        return 'flip'
    return 'skew' if 'skew' in context else context


# name -> (oracle side, checker side); both produce comparable sets
CHECKS: Dict[str, tuple] = {
    'text_columns': (lambda d: {i[1] for i in oracle.text_columns(d)},
                     lambda r: {i['data_id'] for _, i in checker_items(r, 'TEXT_COLUMNS')}),
    'text_wrap': (lambda d: {i[1] for i in oracle.text_wrap(d)},
                  lambda r: {i['data_id'] for _, i in checker_items(r, 'TEXT_WRAP')}),
    'text_wrap_items': (lambda d: {i[1] for i in oracle.text_wrap_items(d)},
                        lambda r: {i['data_id'] for _, i in checker_items(r, 'TEXT_WRAP_ITEM')}),
    'linked_text_frames': (lambda d: {i[1] for i in oracle.linked_text_frames(d)},
                           lambda r: {i['data_id'] for _, i in checker_items(r, 'LINKED_TEXT_FRAME')}),
    'embedded_images': (lambda d: {i[1] for i in oracle.embedded_images(d)},
                        lambda r: {i['data_id'] for _, i in checker_items(r, 'EMBEDDED_IMAGE')}),
    'image_transformations': (
        lambda d: oracle.image_transformations(d),
        lambda r: {('image' if i['context'].startswith('Image inside') else 'container', i['data_id'],
                    _transform_kind(i['context']))
                   for _, i in checker_items(r, 'IMAGE_TRANSFORMATION_IMAGE', 'IMAGE_TRANSFORMATION_CONTAINER')}),
    'document_bleed': (lambda d: len(oracle.document_bleed(d)),
                       lambda r: len(list(checker_items(r, 'DOCUMENT_BLEED')))),
    'paragraph_kerning': (lambda d: {i[0] for i in oracle.paragraph_kerning(d)},
                          lambda r: {ident for ident, _ in checker_items(r, 'KERNING')}),
    'character_kerning': (lambda d: {i[0] for i in oracle.character_kerning(d)},
                          lambda r: {ident for ident, _ in checker_items(r, 'KERNING_CHAR')}),
    'composer': (lambda d: {(i[0], i[2]) for i in oracle.composer(d)},
                 lambda r: {(ident, i['context']) for ident, i in checker_items(r, 'COMPOSER')}),
    'grid_alignment': (lambda d: {(i[0], i[2]) for i in oracle.grid_alignment(d)},
                       lambda r: {(ident, i['context']) for ident, i in checker_items(r, 'GRID_ALIGNMENT')}),
}


@functools.lru_cache(maxsize=None)
def _idml(package: str):
    return oracle.Idml.from_package(f'{TESTING_DIR}/{package}')


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
