class ValidationContext:
    def __init__(self, context: str, classifier_type, page: str = '', identifier: str = 'null', data_id: str = 'null'):
        self.classifier_type = classifier_type.value
        self.page = page if page is not None else ''
        self.context = context if context is not None else ''
        self.identifier = identifier if identifier is not None else 'null'
        self.help_article = None
        self.data_id = data_id if data_id is not None else 'null'

    def get_identifier(self):
        return self.identifier

    def get_page(self):
        return self.page

    def get_type(self):
        return self.classifier_type

    def get_formatted_message(self):
        return f"{self.context}"

    def get_data_id(self):
        return self.data_id
