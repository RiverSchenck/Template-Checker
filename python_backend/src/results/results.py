from collections import defaultdict
from typing import Dict, List, Optional

from src.results.ValidationContext import ValidationContext
from src.results.classifiers import Category, Classifier, Severity, all_classifiers


class ValidationResult():
    def __init__(self):
        # Store validations directly by category -> identifier -> {errors/warnings/infos} -> [ValidationContext]
        self.validations: Dict[str, Dict[str, Dict[str, List[ValidationContext]]]] = defaultdict(
            lambda: defaultdict(lambda: {'errors': [], 'warnings': [], 'infos': []}))
        # Classifier metadata
        self.validation_classifiers: Dict[str, dict] = {}
        self.template_name: str = None
        self.idml_output_folder: str = None
        self.stories_parser = None
        self.spreads_parser = None
        self.par_styles_count = 0
        self.char_styles_count = 0
        self.fonts_total_count = 0
        self.images_total_count = 0
        self.text_box_total_count = 0
        self.text_box_data = {}
        self.spread_to_pages: Dict[str, List[str]] = {}
        self.pages: Dict[str, str] = {}
        self.page_geometry = None
        # page Self -> base64 JPEG preview embedded by InDesign
        self.page_previews: Dict[str, str] = {}

    def add(self, classifier: Classifier, context: Optional[str] = '', *, page_id: str = '', identifier='null',
            data_id='null', text_content: Optional[list] = None, context_details: Optional[dict] = None) -> None:
        """Record an issue. Its severity and section come from the classifier.

        page_id: page Self (mapped to the page's name when the JSON is built)
        identifier: what the issue is grouped under (style, story, font or file name); 'null' for none
        data_id: the page item it points at, for highlighting; 'null' for none
        text_content: the text it's about. An issue at the same place as an earlier one with the same classifier
            only adds its text to that one, unless the classifier is one_per_range.
        context_details: structured data for the frontend (e.g. text, overrides, inheritedFrom)
        """
        # "No identifier" / "no item" is 'null' in the results JSON. Checks may pass None or 'null'; store one
        # form, or a None group and a 'null' group would collide in the JSON and one would overwrite the other.
        identifier = 'null' if identifier is None else identifier
        data_id = 'null' if data_id is None else data_id
        same_list = self.validations[classifier.category.value][identifier][classifier.severity.value]

        if text_content and not classifier.one_per_range:
            earlier = next((issue for issue in same_list if issue.page_id == page_id and issue.data_id == data_id
                            and issue.classifier_type == classifier.value), None)
            if earlier:
                earlier.text_content = list(dict.fromkeys(earlier.text_content + text_content))  # no repeats, in order
                return

        same_list.append(ValidationContext(context, classifier, page_id, identifier, data_id, text_content,
                                           context_details))

        # Text box issues are grouped by story; the JSON shows each story's text.
        if classifier.category == Category.TEXT_BOX and self.stories_parser and identifier not in self.text_box_data:
            self.extract_text_box_content(identifier)

        self.validation_classifiers.setdefault(classifier.value, {
            "label": classifier.label,
            "message": classifier.message or "",
            "help_article": classifier.help_article or None,
        })

    def set_spreads_parser(self, spreads_parser):
        self.spreads_parser = spreads_parser
        self._build_spread_to_pages_mapping()
        self._build_pages_mapping()

    def issues(self, severity: Optional[Severity] = None) -> List[ValidationContext]:
        """Every issue recorded (of one severity, if given), section by section."""
        severities = [severity] if severity else list(Severity)
        return [issue for by_identifier in self.validations.values() for lists in by_identifier.values()
                for s in severities for issue in lists[s.value]]

    def names(self, severity: Severity) -> List[str]:
        """The classifier name of every issue of this severity (one per issue)."""
        return [issue.classifier_type for issue in self.issues(severity)]

    def extract_text_box_content(self, identifier):
        story = self.stories_parser.get_story_by_id(identifier)
        if story:
            content = story.get_content()  # Get full story content
            page_id = story.page_id  # spread's first page; refined from the frame's position when building JSON
            page_id = page_id if page_id is not None else ""
            # page_name will be mapped later in JSON generation
            self.text_box_data[identifier] = {
                "identifier": identifier, "content": content, "page_id": page_id,
                "frame_id": story.parent_text_frame_id}

    def _build_spread_to_pages_mapping(self):
        """Build mapping of spread Self to list of page Selfs."""
        if not self.spreads_parser:
            return

        self.spread_to_pages = {}
        for spread_data in self.spreads_parser.spreads_obj_list:
            spread_self = spread_data.spread_self
            if spread_self:  # Ensure spread_self is not None or empty
                pages = spread_data.get_pages()
                # Filter out None values explicitly
                page_selves = [page["self"] for page in pages if page.get("self") is not None and page.get("self")]
                if page_selves:
                    self.spread_to_pages[spread_self] = page_selves

    def _build_pages_mapping(self):
        """Build mapping of page Self to page Name."""
        if not self.spreads_parser:
            return

        self.pages = {}
        for spread_data in self.spreads_parser.spreads_obj_list:
            pages = spread_data.get_pages()
            for page in pages:
                page_self = page.get("self")
                page_name = page.get("name", "")
                if page_self:
                    self.pages[page_self] = page_name

    @staticmethod
    def _page_of(bounds, fallback_page_id) -> str:
        """The page an item is on: from its position when known (right page of a spread), else the fallback."""
        if bounds and bounds.get("page_id"):
            return bounds["page_id"]
        return fallback_page_id if fallback_page_id is not None else ""

    def _build_validation_item_json(self, item: ValidationContext, page_to_spread: dict) -> dict:
        """Build JSON representation of a validation item, including text_content when applicable."""
        bounds = self.page_geometry.get_bounds(item.data_id) if self.page_geometry else None
        page_id = self._page_of(bounds, item.page_id)

        base_item = {
            "validationClassifier": item.classifier_type,
            "context": item.context,
            "identifier": item.identifier,
            "page_id": page_id,  # page Self (stored directly)
            "page_name": self.pages.get(page_id, "") if page_id else "",  # mapped from pages
            "spread_id": page_to_spread.get(page_id, "") if page_id else "",  # mapped from spread_to_pages
            "data_id": item.data_id
        }

        if bounds:
            base_item["bounds"] = bounds

        context_details = item.context_details
        if context_details is not None:
            base_item["context_details"] = context_details

        if item.classifier.shows_text and item.text_content:
            base_item["text_content"] = item.text_content

        return base_item

    def get_formatted_results_json(self) -> dict:
        """Build response JSON directly from self.validations structure."""
        # Build reverse lookup: page_id -> spread_id for efficient lookups
        page_to_spread = {}
        for spread_self, page_selves in self.spread_to_pages.items():
            if spread_self:  # Ensure spread_self is not None
                for page_self in page_selves:
                    if page_self:  # Ensure page_self is not None
                        page_to_spread[page_self] = spread_self

        # How many styles, frames, fonts and images the document has, per section.
        totals = {
            'par_styles': self.par_styles_count,
            'char_styles': self.char_styles_count,
            'text_boxes': self.text_box_total_count,
            'fonts': self.fonts_total_count,
            'images': self.images_total_count,
            'general': 0,
        }
        categories_response = {}

        # Expected categories in response
        for category_key in (category.value for category in Category):
            # Convert stored validations to response format
            category_validations = self.validations.get(category_key, {})
            details = {}

            for identifier, type_dict in category_validations.items():
                details[identifier] = {
                    'errors': [
                        self._build_validation_item_json(item, page_to_spread)
                        for item in type_dict['errors']
                    ],
                    'warnings': [
                        self._build_validation_item_json(item, page_to_spread)
                        for item in type_dict['warnings']
                    ],
                    'infos': [
                        self._build_validation_item_json(item, page_to_spread)
                        for item in type_dict['infos']
                    ]
                }

            categories_response[category_key] = {
                "details": details,
                "total_count": totals[category_key],
            }

        # Map page_id to page_name in text_box_data
        mapped_text_box_data = {}
        for identifier, text_box in self.text_box_data.items():
            frame_bounds = self.page_geometry.get_bounds(text_box.get("frame_id")) if self.page_geometry else None
            page_id = self._page_of(frame_bounds, text_box.get("page_id"))
            page_name = self.pages.get(page_id, "") if page_id else ""
            mapped_text_box_data[identifier] = {
                "identifier": text_box.get("identifier", ""),
                "content": text_box.get("content", ""),
                "page_id": page_id,
                "page_name": page_name
            }

        response = {
            "template_name": self.template_name if self.template_name else 'No Name',
            "output_folder": self.idml_output_folder,
            **categories_response,  # Spread all categories
            "validation_classifiers": self.validation_classifiers,
            "text_box_data": mapped_text_box_data,
            "spread_to_pages": self.spread_to_pages,
            "pages": self.pages,
            "page_layouts": self._build_page_layouts(),
            "checks": self._build_checks()
        }
        return response

    @staticmethod
    def _build_checks() -> List[dict]:
        """Every template check, so the frontend can list what passed."""
        return [
            {
                "key": classifier.name,
                "severity": classifier.severity.value,
                "label": classifier.label,
                "message": classifier.message or "",
                "help_article": classifier.help_article,
                "category": classifier.category.value,
            }
            for classifier in all_classifiers() if classifier.is_check
        ]

    def _build_page_layouts(self) -> List[dict]:
        """Pages in document order with size (points) and preview image, for issue highlighting."""
        if not self.page_geometry:
            return []
        frames = self.page_geometry.get_page_frames()
        return [
            {
                **page,
                "preview": self.page_previews.get(page["page_id"]),
                "frames": frames.get(page["page_id"], []),
            }
            for page in self.page_geometry.get_pages()
        ]
