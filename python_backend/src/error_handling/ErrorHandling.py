import json
import os
from collections import defaultdict
from typing import List, Dict, Union
from src.error_handling.ValidationContext import ValidationContext
from src.error_handling.Success import Success
from src.error_handling.ValidationClassifier import ValidationError, ValidationWarning, ValidationInfo, ValidationCategory


class ValidationResult():
    def __init__(self):
        self.successes: List[Success] = []
        # Store validations directly by category -> identifier -> {errors/warnings/infos} -> [ValidationContext]
        self.validations: Dict[str, Dict[str, Dict[str, List[ValidationContext]]]] = defaultdict(
            lambda: defaultdict(lambda: {'errors': [], 'warnings': [], 'infos': []}))
        # Category counts for metadata
        self.category_counts: Dict[str, int] = defaultdict(int)
        # Classifier metadata
        self.validation_classifiers: Dict[str, dict] = {}
        self.template_name: str = None
        self.idml_output_folder: str = None
        self.stories_parser = None
        self.par_styles_count = 0
        self.char_styles_count = 0
        self.fonts_total_count = 0
        self.images_total_count = 0
        self.text_box_total_count = 0
        self.text_box_data = {}

    # -------------------------------Helper Methods-------------------------------
    @staticmethod
    def _category_to_response_key(category: ValidationCategory) -> str:
        """Convert ValidationCategory enum to response JSON key format."""
        mapping = {
            ValidationCategory.PAR_STYLE: 'par_styles',
            ValidationCategory.CHAR_STYLE: 'char_styles',
            ValidationCategory.TEXT_BOX: 'text_boxes',
            ValidationCategory.FONTS: 'fonts',
            ValidationCategory.IMAGES: 'images',
            ValidationCategory.GENERAL: 'general'
        }
        return mapping.get(category, category.value.lower())

    # -------------------------------Validation setters-------------------------------
    def add_success(self, message: str, success_type: Union['ValidationError', 'ValidationWarning']):
        success = Success(message, success_type)
        self.successes.append(success)

    def add_validation(self, validation_type: str, classifier, context: str = '',
                      page: str = '', identifier: str = 'null',
                      data_id: str = 'null', page_id: str = ''):
        """
        Unified method for adding errors, warnings, and infos.
        Stores validations directly in category-based structure.
        """
        validation = ValidationContext(context, classifier, page, identifier, data_id, page_id)

        # Get category from classifier and convert to response key
        category = classifier.category
        category_key = self._category_to_response_key(category)

        # Handle special text_box case for identifier extraction
        if category == ValidationCategory.TEXT_BOX and identifier not in self.text_box_data and self.stories_parser:
            self.extract_text_box_content(identifier)

        # Store directly in the category-based structure
        self.validations[category_key][identifier][validation_type].append(validation)

        # Track classifier metadata
        classifier_key = classifier.value
        if classifier_key not in self.validation_classifiers:
            self.validation_classifiers[classifier_key] = {
                "label": classifier.label,
                "message": classifier.message if classifier.message else "",
                "help_article": classifier.help_article if classifier.help_article else None
            }

    def add_custom_error(self, message: str, error_type: 'ValidationError', page: str = None, page_id: str = ''):
        """Add custom error with formatted message."""
        if page:
            message += f' [Page {page}]'
        self.add_validation('errors', error_type, message, page if page else '', 'null', 'null', page_id)

    def add_error(self, context: str, error_type: 'ValidationError', page: str = '', identifier='null', data_id='null', page_id: str = ''):
        """Add error validation."""
        self.add_validation('errors', error_type, context, page, identifier, data_id, page_id)

    def add_warning(self, context: str, warning_type: 'ValidationWarning', page: str = '', identifier='null', data_id='null', page_id: str = ''):
        """Add warning validation."""
        self.add_validation('warnings', warning_type, context, page, identifier, data_id, page_id)

    def add_info(self, context: str, info_type: 'ValidationInfo', page: str = '', identifier='null', data_id='null', page_id: str = ''):
        """Add info validation."""
        self.add_validation('infos', info_type, context, page, identifier, data_id, page_id)

    def add_template_name(self, template_name: str):
        self.template_name = template_name

    def add_idml_output_folder(self, idml_output_folder: str):
        self.idml_output_folder = idml_output_folder

    def add_files_from_folder(self, base_folder: str) -> Dict[str, List[Dict[str, str]]]:
        files_data = defaultdict(list)
        folders_of_interest = ['MasterSpreads', 'META-INF',
                               'Resources', 'Spreads', 'Stories', 'XML']
        for folder in folders_of_interest:
            folder_path = os.path.join(base_folder, folder)
            if os.path.exists(folder_path):
                for root, _, files in os.walk(folder_path):
                    for file in files:
                        if file.endswith('.xml'):  # Filter for .xml files
                            files_data[folder].append({
                                'name': file,
                                'path': os.path.join(root, file),
                            })
        return files_data
    # -------------------------------External Setters-------------------------------

    def set_stories_parser(self, stories_parser):
        self.stories_parser = stories_parser

    def set_fonts_total_count(self, count):
        self.fonts_total_count = count

    def set_par_styles_total_count(self, count):
        self.par_styles_count = count

    def set_char_styles_total_count(self, count):
        self.char_styles_count = count

    def set_images_total_count(self, count):
        self.images_total_count = count

    def set_text_box_total_count(self, count):
        self.text_box_total_count = count

    # -------------------------------Getters-------------------------------

    def get_errors(self) -> List[ValidationContext]:
        """Get all errors from all categories."""
        errors = []
        for category_data in self.validations.values():
            for identifier_data in category_data.values():
                errors.extend(identifier_data['errors'])
        return errors

    def get_warnings(self) -> List[ValidationContext]:
        """Get all warnings from all categories."""
        warnings = []
        for category_data in self.validations.values():
            for identifier_data in category_data.values():
                warnings.extend(identifier_data['warnings'])
        return warnings

    def get_infos(self) -> List[ValidationContext]:
        """Get all infos from all categories."""
        infos = []
        for category_data in self.validations.values():
            for identifier_data in category_data.values():
                infos.extend(identifier_data['infos'])
        return infos

    def get_error_types(self) -> List['ValidationError']:
        """Get all error types (classifier types) from all errors."""
        return [error.classifier_type for error in self.get_errors()]

    def get_warning_types(self) -> List['ValidationWarning']:
        """Get all warning types (classifier types) from all warnings."""
        return [warning.classifier_type for warning in self.get_warnings()]

    def get_info_types(self) -> List['ValidationInfo']:
        """Get all info types (classifier types) from all infos."""
        return [info.classifier_type for info in self.get_infos()]

    # -------------------------------API-------------------------------

    def extract_text_box_content(self, identifier):
        story = self.stories_parser.get_story_by_id(identifier)
        if story:
            content = story.get_content()
            page = story.get_page()
            page_id = story.get_page_id()
            self.text_box_data[identifier] = {
                "identifier": identifier, "content": content, "page": page, "page_id": page_id}

    def get_formatted_results_json(self) -> dict:
        """Build response JSON directly from self.validations structure."""
        # Build category sections dynamically from stored validations
        categories_response = {}

        # Expected categories in response
        expected_categories = ['par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general']

        for category_key in expected_categories:
            # Convert stored validations to response format
            category_validations = self.validations.get(category_key, {})
            details = {}

            for identifier, type_dict in category_validations.items():
                details[identifier] = {
                    'errors': [
                        {
                            "validationClassifier": item.classifier_type,
                            "context": item.get_formatted_message(),
                            "identifier": item.get_identifier(),
                            "page": item.get_page(),
                            "page_id": item.get_page_id(),
                            "data_id": item.get_data_id()
                        }
                        for item in type_dict['errors']
                    ],
                    'warnings': [
                        {
                            "validationClassifier": item.classifier_type,
                            "context": item.get_formatted_message(),
                            "identifier": item.get_identifier(),
                            "page": item.get_page(),
                            "page_id": item.get_page_id(),
                            "data_id": item.get_data_id()
                        }
                        for item in type_dict['warnings']
                    ],
                    'infos': [
                        {
                            "validationClassifier": item.classifier_type,
                            "context": item.get_formatted_message(),
                            "identifier": item.get_identifier(),
                            "page": item.get_page(),
                            "page_id": item.get_page_id(),
                            "data_id": item.get_data_id()
                        }
                        for item in type_dict['infos']
                    ]
                }

            # Get total count for this category
            total_count = 0
            if category_key == 'par_styles':
                total_count = self.par_styles_count
            elif category_key == 'char_styles':
                total_count = self.char_styles_count
            elif category_key == 'text_boxes':
                total_count = self.text_box_total_count
            elif category_key == 'fonts':
                total_count = self.fonts_total_count
            elif category_key == 'images':
                total_count = self.images_total_count
            elif category_key == 'general':
                total_count = 0

            categories_response[category_key] = {
                "details": details,
                "total_count": total_count
            }

        response = {
            "template_name": self.template_name if self.template_name else 'No Name',
            "output_folder": self.idml_output_folder,
            **categories_response,  # Spread all categories
            "validation_classifiers": self.validation_classifiers,
            "text_box_data": self.text_box_data
        }
        return response
