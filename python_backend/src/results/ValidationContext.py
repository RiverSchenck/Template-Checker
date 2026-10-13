from typing import Any, Dict, Optional


class ValidationContext:
    def __init__(self, context: str, classifier_type, page_id: str = '', identifier: str = 'null', data_id: str = 'null', text_content: list = None, context_details: Optional[Dict[str, Any]] = None):
        self.classifier = classifier_type
        self.classifier_type = classifier_type.value
        self.page_id = page_id if page_id is not None else ''  # page Self (page identifier)
        self.context = context if context is not None else ''
        self.identifier = identifier if identifier is not None else 'null'
        self.data_id = data_id if data_id is not None else 'null'
        self.text_content = text_content if text_content is not None else []
        self.context_details = context_details
