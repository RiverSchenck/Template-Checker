FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for some Python packages
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libxml2-dev \
    libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

COPY . /app

RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn

EXPOSE 80

ENV FLASK_ENV=production
ENV PORT=80
ENV DEBUG=False
ENV UPLOAD_FOLDER=/app/uploads

# Gunicorn configuration for large file uploads:
# -b 0.0.0.0:80                    : Bind to all interfaces on port 80
# --timeout 600                    : Worker timeout in seconds (10 minutes) - increased for large file processing
# --workers 2                      : Number of worker processes to handle requests
# --worker-class sync              : Synchronous worker class (good for I/O-bound operations like file uploads)
# --limit-request-line 8190        : Maximum size of HTTP request line in bytes (default is 4094, increased for large requests)
CMD ["gunicorn", "-b", "0.0.0.0:80", "--timeout", "600", "--workers", "2", "--worker-class", "sync", "--limit-request-line", "8190", "run:app"]
# WSGI HTTP server for serving Python applications
# flask python module (app.py):flask app instance app = Flask(__name__)

#BUILDING: docker build -t riverschenck/python_backend:0.0.2.RELEASE .

#LOCAL TESTING: docker container run -d -p 6969:80 riverschenck/python_backend:0.0.2.RELEASE
# -p local mapped port:actual defined app port

#LOCAL TESTING STOP: docker container stop 9858 (NUMBER IS FIRST 4 OF ID)

#PYTEST REOMOVE FROM DOCKERIGNORE:
# /testing
# /pytest.ini
# .pytest_cache/

#CREATE FLY APP fly launch

#DEPLOY/UPDATE fly deploy

#DISABLE APP fly scale count 0
