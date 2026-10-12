from flask import Flask, g, request
from flask.logging import default_handler
from werkzeug.exceptions import RequestEntityTooLarge
from flask_cors import CORS
import logging
import os
import re
import uuid
from .errors import api_error
from .routes import main as main_blueprint

# A caller-supplied X-Request-ID is reused only if it looks like an id, so it can't inject anything into logs.
_REQUEST_ID = re.compile(r'^[A-Za-z0-9._:-]{1,128}$')


class _RequestIdFilter(logging.Filter):
    """Adds the current request's id to every log record (as record.request_id), '-' outside a request."""

    def filter(self, record):
        try:
            record.request_id = g.get('request_id', '-')
        except RuntimeError:  # no app context
            record.request_id = '-'
        return True


def create_app():
    app = Flask(__name__)

    # Configure CORS to allow requests from the frontend
    # In production: allow specific origins, in development: allow localhost
    # Get frontend URL from environment variable, with fallback
    frontend_url = os.getenv('FRONTEND_URL', 'https://template-checker.fly.dev')

    allowed_origins = [
        frontend_url,  # Frontend URL from environment
        'https://template-checker.fly.dev',  # Production frontend (fallback)
        'http://localhost:3000',  # React development server
        'http://localhost:8000',  # Local Flask server (for testing)
    ]

    CORS(app,
         origins=allowed_origins,
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', 'X-Source', 'X-Request-ID'],
         # The analytics CSV export reports how many rows matched vs. were included.
         expose_headers=['Content-Disposition', 'X-Total-Rows', 'X-Exported-Rows', 'X-Request-ID'])

    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

    # Set maximum file upload size to 200MB (safe for 256MB Fly machine; unzip needs ~2x disk)
    # Value is in bytes: 200 * 1024 * 1024 = 209715200
    app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    app.register_blueprint(main_blueprint)

    # Every response carries an X-Request-ID (the caller's, if valid, otherwise a new one) and every log line written
    # while handling it includes the id, so a failed call can be traced from the caller's report to the server logs.
    default_handler.addFilter(_RequestIdFilter())
    default_handler.setFormatter(
        logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s [request %(request_id)s]: %(message)s'))

    @app.before_request
    def assign_request_id():
        incoming = request.headers.get('X-Request-ID', '')
        g.request_id = incoming if _REQUEST_ID.match(incoming) else uuid.uuid4().hex

    @app.after_request
    def add_request_id(response):
        response.headers['X-Request-ID'] = g.get('request_id', '')
        return response

    # Error handler for file size limit exceeded
    @app.errorhandler(RequestEntityTooLarge)
    def handle_file_too_large(e):
        max_size_mb = app.config.get('MAX_CONTENT_LENGTH', 0) / (1024 * 1024)
        return api_error(
            413, 'file_too_large', f'File size exceeds the maximum allowed size of {max_size_mb:.0f}MB',
            details='Please upload a smaller file or contact support if you need to upload larger files.')

    return app
