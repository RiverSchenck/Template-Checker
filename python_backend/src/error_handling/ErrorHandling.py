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
        self.errors: Dict[str, List[ValidationContext]] = defaultdict(list)
        self.warnings: Dict[str, List[ValidationContext]] = defaultdict(list)
        self.infos: Dict[str, List[ValidationContext]] = defaultdict(list)
        self.categories = defaultdict(lambda: defaultdict(
            lambda: {'errors': [], 'warnings': [], 'infos': []}))
        self.template_name: str = None
        self.idml_output_folder: str = None
        self.stories_parser = None
        self.par_styles_count = 0
        self.char_styles_count = 0
        self.fonts_total_count = 0
        self.images_total_count = 0
        self.text_box_total_count = 0
        self.text_box_data = {}

    # -------------------------------Validation setters-------------------------------
    def add_success(self, message: str, success_type: Union['ValidationError', 'ValidationWarning']):
        success = Success(message, success_type)
        self.successes.append(success)

    def add_custom_error(self, message: str, error_type: 'ValidationError', page: str = None, page_id: str = ''):
        if page:
            message += f' [Page {page}]'
        error = ValidationContext(message, error_type, page if page else '', 'null', 'null', page_id)
        key = error_type

        if key not in self.errors:
            self.errors[key] = []
        self.errors[key].append(error)

    def add_error(self, context: str, error_type: 'ValidationError', page: str = '', identifier='null', data_id='null', page_id: str = ''):
        error = ValidationContext(
            context, error_type, page, identifier, data_id, page_id)
        key = error_type

        self.errors[key].append(error)

    def add_warning(self, context: str, warning_type: 'ValidationWarning', page: str = '', identifier='null', data_id='null', page_id: str = ''):
        error = ValidationContext(
            context, warning_type, page, identifier, data_id, page_id)
        key = warning_type

        self.warnings[key].append(error)

    def add_info(self, context: str, info_type: 'ValidationInfo', page: str = '', identifier='null', data_id='null', page_id: str = ''):
        info = ValidationContext(context, info_type, page, identifier, data_id, page_id)
        key = info_type

        self.infos[key].append(info)

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
        return [error for error_list in self.errors.values() for error in error_list]

    def get_warnings(self) -> List[ValidationContext]:
        return [warning for warning_list in self.warnings.values() for warning in warning_list]

    def get_infos(self) -> List[ValidationContext]:
        return [info for info_list in self.infos.values() for info in info_list]

    def get_error_types(self) -> List['ValidationError']:
        return [error.classifier_type for error_list in self.errors.values() for error in error_list]

    def get_warning_types(self) -> List['ValidationWarning']:
        return [warning.classifier_type for warning_list in self.warnings.values() for warning in warning_list]

    def get_info_types(self) -> List['ValidationInfo']:
        return [info.classifier_type for info_list in self.infos.values() for info in info_list]

    # -------------------------------API-------------------------------

    def extract_text_box_content(self, identifier):
        story = self.stories_parser.get_story_by_id(identifier)
        if story:
            content = story.get_content()
            page = story.get_page()
            page_id = story.get_page_id()
            self.text_box_data[identifier] = {
                "identifier": identifier, "content": content, "page": page, "page_id": page_id}

    def add_to_category(self, error, category, error_type):
        # Default identifier if not provided
        identifier = error.get('identifier', 'None')
        self.categories[category][identifier][error_type].append(error)

        if category == ValidationCategory.TEXT_BOX.value and identifier not in self.text_box_data and self.stories_parser:
            self.extract_text_box_content(identifier)

    def format_validation_details(self, validation_dict, error_type):
        for key, items in validation_dict.items():
            for item in items:
                details = {
                    "validationClassifier": key.value,
                    "context": item.get_formatted_message(),
                    "identifier": item.get_identifier(),
                    "page": item.get_page(),
                    "page_id": item.get_page_id(),
                    "data_id": item.get_data_id()
                }
                # Use key.category.value to categorize, and details includes the identifier
                self.add_to_category(details, key.category.value, error_type)

    def extract_classifiers(self, *args):
        classifiers = {}
        for validation_dict in args:
            for key in validation_dict:
                if key.value not in classifiers:
                    classifiers[key.value] = {
                        "label": key.label,
                        "message": key.message if key.message else "",
                        "help_article": key.help_article if key.help_article else None
                    }
        return classifiers

    def get_formatted_results_json(self) -> dict:
        self.format_validation_details(self.errors, 'errors')
        self.format_validation_details(self.warnings, 'warnings')
        self.format_validation_details(self.infos, 'infos')

        classifiers = self.extract_classifiers(
            self.errors, self.warnings, self.infos)

        response = {
            "template_name": self.template_name if self.template_name else 'No Name',
            "output_folder": self.idml_output_folder,
            "par_styles": {
                "details": dict(self.categories[ValidationCategory.PAR_STYLE.value]),
                "total_count": self.par_styles_count
            },
            "char_styles": {
                "details": dict(self.categories[ValidationCategory.CHAR_STYLE.value]),
                "total_count": self.char_styles_count
            },
            "text_boxes": {
                "details": dict(self.categories[ValidationCategory.TEXT_BOX.value]),
                "total_count": self.text_box_total_count
            },
            "fonts": {
                "details": dict(self.categories[ValidationCategory.FONTS.value]),
                "total_count": self.fonts_total_count
            },
            "images": {
                "details": dict(self.categories[ValidationCategory.IMAGES.value]),
                "total_count": self.images_total_count
            },
            "general": {
                "details": dict(self.categories[ValidationCategory.GENERAL.value]),
                "total_count": 0
            },
            "validation_classifiers": classifiers,
            "text_box_data": self.text_box_data
        }
        return response
