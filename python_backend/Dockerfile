FROM python:3-alpine3.15

WORKDIR /app

COPY . /app

RUN pip install -r requirements.txt
RUN pip install gunicorn

EXPOSE 80

ENV FLASK_ENV=production
ENV PORT=80
ENV DEBUG=False
ENV UPLOAD_FOLDER=/app/uploads

CMD ["gunicorn", "-b", "0.0.0.0:80", "run:app"]  
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