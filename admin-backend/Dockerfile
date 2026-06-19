FROM python:3.11-slim
WORKDIR /app
COPY admin-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY admin-backend/ .
RUN mkdir -p data uploads
EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
