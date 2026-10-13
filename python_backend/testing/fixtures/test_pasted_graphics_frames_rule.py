"""Pasted graphics: a graphic pasted into the document (no link) leaves an empty frame in Frontify, whatever
the frame's shape and whatever the graphic type, SVG included (docs/rules-review-2026-10-12.md)."""
import pytest

from testing.fixtures.checker_run import run_checker
from testing.fixtures.idml_builder import PackageBuilder


def pasted_contexts(tmp_path, build):
    pkg = PackageBuilder()
    build(pkg)
    return [i.detail for i in run_checker(pkg.write(tmp_path)).of('PASTED_GRAPHICS')]


@pytest.mark.parametrize('tag', ['Rectangle', 'Oval', 'Polygon'])
@pytest.mark.parametrize('graphic', ['PDF', 'EPS', 'Image', 'SVG'])
def test_pasted_graphic_in_any_frame(tmp_path, tag, graphic):
    assert pasted_contexts(tmp_path, lambda pkg: pkg.shape(tag, pasted=graphic)) == ['1 pasted graphics found.']


def test_counts_every_pasted_graphic_on_the_spread(tmp_path):
    def build(pkg):
        pkg.shape('Rectangle', pasted='PDF')
        pkg.shape('Oval', pasted='SVG')
    assert pasted_contexts(tmp_path, build) == ['2 pasted graphics found.']


def test_linked_image_and_empty_shapes_are_fine(tmp_path):
    def build(pkg):
        pkg.image('photo.jpg')
        pkg.shape('Oval')
    assert pasted_contexts(tmp_path, build) == []
