# Build context: REPO ROOT.
# Example: gcloud builds submit --config agents/crowd-vision/cloudbuild.yaml .
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

COPY shared /app/shared
COPY agents/crowd-vision /app/crowd-vision

RUN pip install /app/shared && pip install /app/crowd-vision

EXPOSE 8080

CMD ["uvicorn", "crowd_vision_agent.main:app", "--host", "0.0.0.0", "--port", "8080"]
