"""Checks on placed images: included, size, embedded, transformations."""

from src.checks._report import at_link, report
from src.document import ParsedDocument
from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError, ValidationInfo, ValidationWarning
from src.helpers.page_item_transform import classify_page_item_transform, parse_item_transform


def images_included_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Links vs. the Links folder. Error for an image used on a page or master page that isn't in
    Links (embedded images excluded); warning for a file in Links that nothing uses; error for a
    zero-byte file in Links."""
    # Placed images (frame id) and master-page images (no id); embedded ones aren't expected in Links.
    link_name_to_id = {link.get_image_name(): link.get_rectangle_link_id()
                       for spread in doc.spreads_parser.spreads_obj_list
                       for link in spread.links_obj_list
                       if link.stored_state != 'Embedded'}
    link_name_to_id.update({link.get_image_name(): None
                            for link in doc.masterspreads_parser.links_obj_list
                            if link.stored_state != 'Embedded'})

    images = doc.source_folders_parser.images_obj_list
    image_names = {image.get_image_name() for image in images}

    for image in images:
        if image.image_size_bytes == 0:
            results.add_custom_error(
                f"Image '{image.get_image_name()}' has zero size. Likely a corrupted image.", ValidationError.ERROR)

    for missing_image in sorted(set(link_name_to_id) - image_names):
        link_id = link_name_to_id[missing_image]
        if link_id is None:
            message = f"Link '{missing_image}' is used but not found in the Links folder (ID: None from master spreads)."
            page_id = ''
        else:
            message = f"Link '{missing_image}' (ID: {link_id}) is used but not found in the Links folder."
            page_id = doc.find_page_id_from_data_id(link_id)
        report(results, ValidationError.IMAGE_INCLUDED, message, page_id=page_id, identifier=missing_image,
               data_id=link_id)

    for unused_image in sorted(image_names - set(link_name_to_id)):
        report(results, ValidationWarning.UNUSED_IMAGE, f"Image '{unused_image}' is present in the document but not used.",
               identifier=unused_image)


def large_image_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Info for each file in Links larger than 10 MB."""
    for image in doc.source_folders_parser.images_obj_list:
        if image.image_size_MB > 10:
            data_id = image.parent_link_data_id
            page_id = doc.find_page_id_from_data_id(data_id) if data_id and data_id != 'null' else ''
            report(results, ValidationInfo.LARGE_IMAGE, f"Image {image.get_image_name()} is {image.image_size_MB}MB.",
                   page_id=page_id, identifier=image.get_image_name(), data_id=data_id)


def embedded_image_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each image stored inside the document (StoredState "Embedded") instead of linked."""
    for spread in doc.spreads_parser.spreads_obj_list:
        for link in spread.links_obj_list:
            if link.stored_state == 'Embedded':
                report(results, ValidationError.EMBEDDED_IMAGE, **at_link(doc, spread, link))


def image_transformation_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """The placed image and its frame are each judged by their end state (docs/checker-rules.md):
    mirrored -> flip error, skewed -> error. Rotation is fine: Frontify carries it over."""
    for spread in doc.spreads_parser.spreads_obj_list:
        for link in spread.links_obj_list:
            where = at_link(doc, spread, link)
            for is_image, transform in ((True, link.item_transform), (False, link.get_container_item_transform())):
                parsed = parse_item_transform(transform)
                if parsed is None:
                    continue
                classification = classify_page_item_transform(*parsed[:4])
                if not classification.is_error:
                    continue
                subject = "Image inside Container" if is_image else "Image Container"
                classifier = ValidationError.IMAGE_TRANSFORMATION_IMAGE if is_image else ValidationError.IMAGE_TRANSFORMATION_CONTAINER
                report(results, classifier, f"{subject} {classification.message}", **where)
