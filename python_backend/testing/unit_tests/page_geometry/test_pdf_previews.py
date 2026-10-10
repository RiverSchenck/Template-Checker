import base64
import io

import pypdfium2 as pdfium
import pytest
from PIL import Image

from src.helpers.pdf_previews import PREVIEW_LONG_SIDE, find_package_pdf, render_pdf_previews


def make_pdf(path, sizes, bleed=0.0):
    """A PDF with one blank page per (width, height) in points, with `bleed` points of bleed on each side."""
    pdf = pdfium.PdfDocument.new()
    for width, height in sizes:
        page = pdf.new_page(width + 2 * bleed, height + 2 * bleed)
        if bleed:
            page.set_trimbox(bleed, bleed, bleed + width, bleed + height)
        page.close()
    pdf.save(str(path))
    pdf.close()
    return str(path)


def pages(*sizes):
    return [{'page_id': f'p{i}', 'width': w, 'height': h} for i, (w, h) in enumerate(sizes, start=1)]


def decoded_size(b64):
    return Image.open(io.BytesIO(base64.b64decode(b64))).size


def test_renders_one_preview_per_page_at_preview_size(tmp_path):
    pdf = make_pdf(tmp_path / 'doc.pdf', [(566.93, 1445.67), (300, 200)])

    previews = render_pdf_previews(pdf, pages((566.93, 1445.67), (300, 200)))

    assert set(previews) == {'p1', 'p2'}
    width, height = decoded_size(previews['p1'])
    assert height == PREVIEW_LONG_SIDE
    assert width == pytest.approx(PREVIEW_LONG_SIDE * 566.93 / 1445.67, abs=1)
    assert decoded_size(previews['p2'])[0] == PREVIEW_LONG_SIDE


def test_crops_bleed_to_the_trim_box(tmp_path):
    pdf = make_pdf(tmp_path / 'doc.pdf', [(400, 800)], bleed=9)

    previews = render_pdf_previews(pdf, pages((400, 800)))

    width, height = decoded_size(previews['p1'])
    assert width / height == pytest.approx(400 / 800, abs=0.005)


def test_skips_pdf_with_a_different_page_count(tmp_path):
    pdf = make_pdf(tmp_path / 'doc.pdf', [(300, 200)])

    assert render_pdf_previews(pdf, pages((300, 200), (300, 200))) == {}


def test_skips_pdf_with_different_page_sizes(tmp_path):
    # e.g. a spreads export, or a PDF of a different document
    pdf = make_pdf(tmp_path / 'doc.pdf', [(600, 200)])

    assert render_pdf_previews(pdf, pages((300, 200))) == {}


def test_find_package_pdf_prefers_the_document_name(tmp_path):
    for name in ('Another.pdf', 'Brochure.pdf', '._Brochure.pdf', 'Brochure.idml'):
        (tmp_path / name).write_bytes(b'')
    (tmp_path / 'Links').mkdir()
    (tmp_path / 'Links' / 'placed.pdf').write_bytes(b'')

    assert find_package_pdf(str(tmp_path), str(tmp_path / 'Brochure.idml')) == str(tmp_path / 'Brochure.pdf')


def test_find_package_pdf_returns_none_without_a_pdf(tmp_path):
    (tmp_path / 'Links').mkdir()
    (tmp_path / 'Links' / 'placed.pdf').write_bytes(b'')

    assert find_package_pdf(str(tmp_path), str(tmp_path / 'Brochure.idml')) is None
