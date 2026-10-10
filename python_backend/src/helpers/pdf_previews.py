import base64
import io
import os
from typing import Dict, List, Optional

# Long side of a rendered page preview, in pixels. Sharp enough to read text and see frame edges,
# small enough to keep the results JSON a reasonable size.
PREVIEW_LONG_SIDE = 1400
JPEG_QUALITY = 78
# A PDF page is only used when its trim size matches the IDML page within this many points.
SIZE_TOLERANCE_PT = 1.0
# Bigger documents keep the embedded thumbnails: rendering and shipping every page would get slow and heavy.
MAX_PAGES = 30


def find_package_pdf(package_folder: str, idml_path: str) -> Optional[str]:
    """The PDF InDesign's Package command writes next to the .idml (not placed PDFs in Links/), if any."""
    try:
        pdfs = [f for f in os.listdir(package_folder)
                if f.lower().endswith('.pdf') and not f.startswith('.')]
    except OSError:
        return None
    if not pdfs:
        return None
    stem = os.path.splitext(os.path.basename(idml_path))[0].lower()
    # Prefer the PDF named like the document, then alphabetical for a stable choice.
    pdfs.sort(key=lambda f: (os.path.splitext(f)[0].lower() != stem, f.lower()))
    return os.path.join(package_folder, pdfs[0])


def render_pdf_previews(pdf_path: str, pages: List[Dict]) -> Dict[str, str]:
    """Base64 JPEG per page_id, rendered from the package PDF and cropped to each page's trim box.

    Returns {} unless the PDF is a page-for-page export of the document (same page count, same page
    sizes), since anything else (spreads, a different version, a placed asset) wouldn't line up with
    the page geometry the highlights are drawn from.
    """
    if not pages or len(pages) > MAX_PAGES:
        return {}
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(pdf_path)
    try:
        if len(pdf) != len(pages):
            return {}
        previews: Dict[str, str] = {}
        for index, page in enumerate(pages):
            pdf_page = pdf[index]
            try:
                if pdf_page.get_rotation() != 0:
                    return {}
                crop_left, crop_bottom, crop_right, crop_top = pdf_page.get_cropbox()
                trim_left, trim_bottom, trim_right, trim_top = pdf_page.get_trimbox()
                width, height = trim_right - trim_left, trim_top - trim_bottom
                if abs(width - page['width']) > SIZE_TOLERANCE_PT or abs(height - page['height']) > SIZE_TOLERANCE_PT:
                    return {}
                scale = PREVIEW_LONG_SIDE / max(width, height)
                # Crop is measured from the crop box edges; this trims bleed and slug off the render.
                crop = (
                    max(0.0, trim_left - crop_left),
                    max(0.0, trim_bottom - crop_bottom),
                    max(0.0, crop_right - trim_right),
                    max(0.0, crop_top - trim_top),
                )
                image = pdf_page.render(scale=scale, crop=crop).to_pil().convert('RGB')
            finally:
                pdf_page.close()
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=JPEG_QUALITY, optimize=True)
            previews[page['page_id']] = base64.b64encode(buffer.getvalue()).decode('ascii')
        return previews
    finally:
        pdf.close()
