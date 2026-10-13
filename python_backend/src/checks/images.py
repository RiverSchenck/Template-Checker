"""Checks on placed images: included, size, embedded, transformations."""

from src.checks._report import at_link, report
from src.model import subject as subjects
from src.model.document import Document
from src.results.results import Results
from src.helpers.page_item_transform import classify_page_item_transform, parse_item_transform, transform_facts


def images_included_check(doc: Document, results: Results) -> None:
    """Links vs. the Links folder. Error for an image used on a page or master page that isn't in
    Links (embedded images excluded); warning for a file in Links that nothing uses; error for a
    zero-byte file in Links."""
    # Placed images (frame id) and master-page images (no id); embedded ones aren't expected in Links.
    link_name_to_id = {link.name: link.frame_id for _, link in doc.links() if link.stored_state != 'Embedded'}
    link_name_to_id.update({link.name: None for master in doc.masters for link in master.links
                            if link.stored_state != 'Embedded'})

    images = doc.packaged_images
    image_names = {image.name for image in images}

    for image in images:
        if image.size_bytes == 0:
            report(results, 'ERROR', f"Image '{image.name}' has zero size. Likely a corrupted image.")

    for missing_image in sorted(set(link_name_to_id) - image_names):
        link_id = link_name_to_id[missing_image]
        if link_id is None:
            message = f"Link '{missing_image}' is used but not found in the Links folder (ID: None from master spreads)."
            page_id = ''
        else:
            message = f"Link '{missing_image}' (ID: {link_id}) is used but not found in the Links folder."
            page_id = doc.page_of_item(link_id)
        report(results, 'IMAGE_INCLUDED', message, page_id=page_id, data_id=link_id,
               subject=subjects.image(missing_image))

    for unused_image in sorted(image_names - set(link_name_to_id)):
        report(results, 'UNUSED_IMAGE', f"Image '{unused_image}' is present in the document but not used.",
               subject=subjects.image(unused_image))


def large_image_check(doc: Document, results: Results) -> None:
    """Info for each file in Links larger than 10 MB."""
    for image in doc.packaged_images:
        if image.size_mb > 10:
            data_id = doc.frame_of_image(image.name)
            report(results, 'LARGE_IMAGE', f"Image {image.name} is {image.size_mb}MB.",
                   page_id=doc.page_of_item(data_id), data_id=data_id,
                   context_details={'size_mb': image.size_mb}, subject=subjects.image(image.name))


def embedded_image_check(doc: Document, results: Results) -> None:
    """Error for each image stored inside the document (StoredState "Embedded") instead of linked."""
    for spread, link in doc.links():
        if link.stored_state == 'Embedded':
            report(results, 'EMBEDDED_IMAGE', **at_link(doc, spread, link))


def image_transformation_check(doc: Document, results: Results) -> None:
    """The placed image and its frame are each judged by their end state (docs/checker-rules.md):
    mirrored -> flip error, skewed -> error. Rotation is fine: Frontify carries it over."""
    for spread, link in doc.links():
        where = at_link(doc, spread, link)
        for is_image, transform in ((True, link.graphic_transform), (False, link.frame_transform)):
            parsed = parse_item_transform(transform)
            if parsed is None:
                continue
            classification = classify_page_item_transform(*parsed[:4])
            if not classification.is_error:
                continue
            which = "Image inside Container" if is_image else "Image Container"
            about = where['subject'] if is_image else subjects.image_frame(link.frame_id, link.name)
            report(results, 'TRANSFORMATION', f"{which} {classification.message}",
                   context_details=transform_facts(classification, *parsed[:2]), **{**where, 'subject': about})
