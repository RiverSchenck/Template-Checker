from typing import Union


class Success:
    def __init__(self, message: str, success_type: Union['ValidationError', 'ValidationWarning'] = "SUCCESS"):
        self.success_type = success_type.value
        self.message = message
