"""Page previews for the results: the thumbnails InDesign stores in the .idml, replaced by sharp renders of the
package PDF when it matches the document page for page. Only the web app asks for them (plan D6): rendering is
most of a run's time, and the summary and the XML export don't show pages."""
import logging
import os
from typing import Dict

from src.helpers.pdf_previews import find_package_pdf, render_pdf_previews, xmp_thumbnails
from src.model.document import Document
from src.pipeline.intake import Intake

logger = logging.getLogger(__name__)


def page_previews(document: Document, intake: Intake) -> Dict[str, str]:
    """Base64 JPEG per page Self. A nice-to-have: anything that goes wrong is logged and gives no preview."""
    previews: Dict[str, str] = {}
    try:
        pages = document.geometry.get_pages() if document.geometry else []
        metadata = os.path.join(intake.idml_folder, 'META-INF', 'metadata.xml')
        if os.path.exists(metadata):
            # XMP PageNumber is the 1-based position of the page in the document.
            page_by_index = {str(page['index']): page['page_id'] for page in pages}
            for page_number, thumbnail in xmp_thumbnails(metadata).items():
                if page_number in page_by_index:
                    previews[page_by_index[page_number]] = thumbnail
    except Exception:
        logger.warning('Page thumbnails unavailable', exc_info=True)
        return {}
    try:
        # The embedded thumbnails are about 200px wide, too small to line highlights up on.
        pdf_path = find_package_pdf(intake.package.folder, intake.package.idml_path)
        if pdf_path:
            previews.update(render_pdf_previews(pdf_path, pages))
    except Exception:
        logger.warning('PDF preview rendering skipped', exc_info=True)
    return previews
