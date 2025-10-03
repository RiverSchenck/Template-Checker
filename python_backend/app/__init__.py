from flask import Flask
from flask_cors import CORS
import os
from .routes import main as main_blueprint


def create_app():
    app = Flask(__name__)
    CORS(app)

    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    app.register_blueprint(main_blueprint)

    return app
