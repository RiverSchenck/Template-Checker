class ValidationContext:
    def __init__(self, context: str, classifier_type, page_id: str = '', identifier: str = 'null', data_id: str = 'null'):
        self.classifier_type = classifier_type.value
        self.page_id = page_id if page_id is not None else ''  # page Self (page identifier)
        self.context = context if context is not None else ''
        self.identifier = identifier if identifier is not None else 'null'
        self.help_article = None
        self.data_id = data_id if data_id is not None else 'null'

    def get_identifier(self):
        return self.identifier

    def get_page_id(self):
        return self.page_id

    def get_type(self):
        return self.classifier_type

    def get_formatted_message(self):
        return f"{self.context}"

    def get_data_id(self):
        return self.data_id
