# Build context: REPO ROOT.
# Example: gcloud builds submit --config agents/emergency/cloudbuild.yaml .
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

COPY shared /app/shared
COPY agents/emergency /app/emergency

RUN pip install /app/shared && pip install /app/emergency

EXPOSE 8080

CMD ["uvicorn", "emergency_agent.main:app", "--host", "0.0.0.0", "--port", "8080"]
