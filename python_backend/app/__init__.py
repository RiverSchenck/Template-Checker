from flask import Flask, jsonify
from werkzeug.exceptions import RequestEntityTooLarge
from flask_cors import CORS
import os
from .routes import main as main_blueprint


def create_app():
    app = Flask(__name__)

    # Configure CORS to allow requests from frontend and Chrome extensions
    # In production: allow specific origins, in development: allow localhost
    # Chrome extensions have chrome-extension:// origins (unique per extension)
    # Using regex pattern for chrome-extension:// origins
    allowed_origins = [
        'https://template-checker.fly.dev',  # Production frontend
        'http://localhost:3000',  # React development server
        'http://localhost:8000',  # Local Flask server (for testing)
        r'chrome-extension://.*',  # All Chrome extension origins (regex pattern)
    ]

    CORS(app,
         origins=allowed_origins,
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization', 'X-Source'])

    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

    # Set maximum file upload size to 300MB (for large template files)
    # Value is in bytes: 300 * 1024 * 1024 = 314572800
    app.config['MAX_CONTENT_LENGTH'] = 300 * 1024 * 1024  # 300MB

    # Authentication token (set via environment variable)
    # If not set, authentication is disabled
    app.config['AUTH_TOKEN'] = os.getenv('AUTH_TOKEN', None)

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    app.register_blueprint(main_blueprint)

    # Error handler for file size limit exceeded
    @app.errorhandler(RequestEntityTooLarge)
    def handle_file_too_large(e):
        max_size_mb = app.config.get('MAX_CONTENT_LENGTH', 0) / (1024 * 1024)
        return jsonify({
            'error': {
                'message': f'File size exceeds the maximum allowed size of {max_size_mb:.0f}MB',
                'details': 'Please upload a smaller file or contact support if you need to upload larger files.'
            }
        }), 413

    return app
