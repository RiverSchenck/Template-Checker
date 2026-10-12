"""Checks on placed images: included, size, embedded, transformations."""

from src.document import ParsedDocument
from src.error_handling.ErrorHandling import ValidationResult
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning, ValidationInfo
from src.helpers.page_item_transform import classify_page_item_transform, parse_item_transform, TransformKind


def images_included_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Links vs. the Links folder. Error for an image used on a page or master page that isn't in
    Links (embedded images excluded); warning for a file in Links that nothing uses; error for a
    zero-byte file in Links."""
    # Extract all the link names and their IDs from the spreads.
    # Skipping embedded because they obviously will not be included anyways
    link_name_to_id = {link.get_image_name(): link.get_rectangle_link_id()
                       for spread in doc.spreads_parser.get_spreads_obj_list()
                       for link in spread.get_links_obj_list()
                       if link.get_stored_state() != 'Embedded'}

    # Now we need to check master page so we don't get unused image errors.
    # Use None for IDs from masterspreads_parser since link_id is always null.
    master_link_name_to_id = {link.get_image_name(): None
                              for link in doc.masterspreads_parser.get_links_objs()
                              if link.get_stored_state() != 'Embedded'}

    # Combine all link names and IDs from spreads and master pages
    link_name_to_id.update(master_link_name_to_id)

    # Extract all the image names from the source folder.
    image_names = {image.get_image_name()
                   for image in doc.source_folders_parser.get_images_obj_list()}

    # Check for zero-sized images
    for image in doc.source_folders_parser.get_images_obj_list():
        if image.get_image_byte_size() == 0:
            image_name = image.get_image_name()
            print(image.get_image_byte_size())
            message = f"Image '{image_name}' has zero size. Likely a corrupted image."

            results.add_custom_error(
            message, ValidationError.ERROR)

    # Check if all link names are found in the image names.
    missing_images = set(link_name_to_id.keys()) - image_names
    if missing_images:
        for missing_image in sorted(missing_images):
            # Use the link ID if it's from spreads, None if from master spreads
            missing_link_id = link_name_to_id[missing_image]
            if missing_link_id is None:
                message = f"Link '{missing_image}' is used but not found in the Links folder (ID: None from master spreads)."
                page_id = ''
            else:
                message = f"Link '{missing_image}' (ID: {missing_link_id}) is used but not found in the Links folder."
                page_id = doc.find_page_id_from_data_id(missing_link_id)

            results.add_error(
                context=message,
                error_type=ValidationError.IMAGE_INCLUDED,
                page_id=page_id,
                # Using the image name for the identifier since link ID is None for master spreads
                identifier=missing_image,
                data_id=missing_link_id
            )

    # Check if there are any image names not used in links.
    unused_images = image_names - set(link_name_to_id.keys())
    if unused_images:
        for unused_image in sorted(unused_images):
            # Unused images would not have a corresponding link ID in this case
            message = f"Image '{unused_image}' is present in the document but not used."
            results.add_warning(
                context=message,
                warning_type=ValidationWarning.UNUSED_IMAGE,
                page_id='',
                identifier=unused_image,
                data_id='null'
            )


def large_image_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Info for each file in Links larger than 10 MB."""
    for image in doc.source_folders_parser.get_images_obj_list():
        if image.get_image_size() > 10:
            image_name = image.get_image_name()
            data_id = image.get_parent_link_data_id()
            page_id = doc.find_page_id_from_data_id(data_id) if data_id and data_id != 'null' else ''
            message = f"Image {image_name} is {image.get_image_size()}MB."
            results.add_info(
                context=message,
                info_type=ValidationInfo.LARGE_IMAGE,
                page_id=page_id,
                identifier=image_name,
                data_id=data_id
            )


def embedded_image_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """Error for each image stored inside the document (StoredState "Embedded") instead of linked."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        # Get first page's Self from spread
        pages = spread.get_pages()
        spread_page_id = pages[0].get("self", '') if pages and len(pages) > 0 else ''
        for link in spread.get_links_obj_list():
            if link.get_stored_state() == 'Embedded':
                link_id = link.get_rectangle_link_id()
                image_name = link.get_image_name()
                # Try to find the specific page_id from data_id, fallback to spread's first page
                page_id = doc.find_page_id_from_data_id(link_id) if link_id else spread_page_id
                results.add_error(
                    context=None,
                    error_type=ValidationError.EMBEDDED_IMAGE,
                    page_id=page_id,
                    identifier=image_name,
                    data_id=link_id
                )


def image_transformation_check(doc: ParsedDocument, results: ValidationResult) -> None:
    """The placed image and its frame are each judged by their end state (docs/checker-rules.md):
    mirrored -> flip error, skewed -> error, rotated only -> warning."""
    for spread in doc.spreads_parser.get_spreads_obj_list():
        # Get first page's Self from spread
        pages = spread.get_pages()
        spread_page_id = pages[0].get("self", '') if pages and len(pages) > 0 else ''
        for link in spread.get_links_obj_list():
            item_transform = link.get_item_transform()
            container_transform = link.get_container_item_transform()
            file_name = link.get_image_name()
            rectangle_id = link.get_rectangle_link_id()
            # Try to find the specific page_id from data_id, fallback to spread's first page
            page_id = doc.find_page_id_from_data_id(rectangle_id) if rectangle_id else spread_page_id
            for idx, asset in enumerate([item_transform, container_transform]):
                parsed = parse_item_transform(asset)
                if parsed is None:
                    continue
                is_image = (idx == 0)
                context = "Image inside Container" if is_image else "Image Container"
                classification = classify_page_item_transform(*parsed[:4])
                if classification.kind == TransformKind.NONE:
                    continue
                message = f"{context} {classification.message}"
                if classification.is_error:
                    results.add_error(
                        context=message,
                        error_type=ValidationError.IMAGE_TRANSFORMATION_IMAGE if is_image else ValidationError.IMAGE_TRANSFORMATION_CONTAINER,
                        page_id=page_id,
                        identifier=file_name,
                        data_id=rectangle_id
                    )
                else:
                    results.add_warning(
                        context=message,
                        warning_type=ValidationWarning.IMAGE_TRANSFORMATION_IMAGE if is_image else ValidationWarning.IMAGE_TRANSFORMATION_CONTAINER,
                        page_id=page_id,
                        identifier=file_name,
                        data_id=rectangle_id
                    )
