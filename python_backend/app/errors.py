"""The one error shape for the API: {"error": {"code", "message", "request_id", ...}}.

`code` is stable and meant for programs to branch on; `message` is for people and may change; `request_id` matches the
X-Request-ID response header and the server logs.
"""
from flask import g, jsonify


def error_body(code: str, message: str, **extra) -> dict:
    return {'error': {'code': code, 'message': message, 'request_id': g.get('request_id'), **extra}}


def api_error(status: int, code: str, message: str, **extra):
    """An error response. Never put exception text or server paths in `message`; log those instead."""
    response = jsonify(error_body(code, message, **extra))
    response.status_code = status
    response.headers['Cache-Control'] = 'no-store'
    return response
