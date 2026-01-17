import os
from dotenv import load_dotenv
from app import create_app

# Load environment variables from .env file
load_dotenv()

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    debug = os.environ.get('DEBUG', 'True').lower() in ['true', '1', 't']
    if 'gunicorn' not in os.environ.get('SERVER_SOFTWARE', ''):
        app.run(host="0.0.0.0", port=port, debug=debug)
