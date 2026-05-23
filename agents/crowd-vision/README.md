# Crowd Vision Agent

Takes a single stadium camera frame, asks Gemini 2.5 Flash (multimodal) to
extract crowd metrics, and publishes them to the bus. If it sees stampede
precursors (falling, bottlenecks, counter-flow), it also fires
`emergency.trigger` so the Commander can react.

## API

`POST /analyze`

```json
{
  "zone": "north_stand",
  "source_camera": "cam-ns-04",
  "image_url": "https://...jpg"        // or
  "image_b64": "...base64...",
  "mime_type": "image/jpeg"
}
```

## Writes

- `crowd.density` — structured metrics (zone, head_count, occupancy, velocity, pressure_index)
- `agent.decision` — audit row of what the agent saw
- `emergency.trigger` — only when a stampede precursor is detected, OR when
  `pressure_index >= 0.85` (auto-escalation in `tools.report_density`).
- Firestore `zones/<zone>` — last-known live state (dashboard reads this)

## Local development

From the repo root:

```bash
pip install -e shared -e agents/crowd-vision

export $(grep -v '^#' .env.example | xargs)
uvicorn crowd_vision_agent.main:app --reload --port 8081 --app-dir agents/crowd-vision

curl -X POST localhost:8081/analyze -H "Content-Type: application/json" -d '{
  "zone": "north_stand",
  "source_camera": "cam-ns-04",
  "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Eden_Gardens_Test_Match.jpg/1280px-Eden_Gardens_Test_Match.jpg"
}'
```

## Deploy

```bash
gcloud builds submit --config agents/crowd-vision/cloudbuild.yaml .
gcloud run deploy crowd-vision-agent \
  --image asia-south1-docker.pkg.dev/$GCP_PROJECT_ID/stadiumos/crowd-vision:latest \
  --region asia-south1 \
  --service-account stadiumos-runtime@$GCP_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars "GCP_PROJECT_ID=$GCP_PROJECT_ID,GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$GCP_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1" \
  --no-allow-unauthenticated
```
