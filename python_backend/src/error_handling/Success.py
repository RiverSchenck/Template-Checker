from typing import Union


class Success:
    def __init__(self, message: str, success_type: Union['ValidationError', 'ValidationWarning'] = "SUCCESS"):
        self.success_type = success_type.value
        self.message = message

    def get_success_type(self):
        return self.success_type

    def get_success_formatted_message(self):
        return f"✅[{self.success_type}]: {self.message}"
